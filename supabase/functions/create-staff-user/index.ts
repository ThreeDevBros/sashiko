import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12),
  fullName: z.string().min(1).max(100),
  role: z.enum(['manager', 'staff', 'delivery']),
  permissions: z.array(z.string()).optional(),
  branch_id: z.string().uuid().optional().nullable(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin or has manage_staff permission
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    
    const { data: permissions } = await supabaseAdmin
      .from('user_permissions')
      .select('permission')
      .eq('user_id', user.id);

    const hasStaffPermission = permissions?.some(p => p.permission === 'manage_staff');

    if (!isAdmin && !hasStaffPermission) {
      throw new Error('Insufficient permissions');
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = requestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validationResult.error.errors }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { email, password, fullName, role, permissions: userPermissions, branch_id } = validationResult.data;

    console.log('Creating user with email:', email, 'role:', role);

    // Create the user using admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      // Return more specific error message
      return new Response(
        JSON.stringify({ 
          error: createError.message || 'Failed to create user',
          details: createError 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    if (!newUser.user) {
      throw new Error('User creation failed - no user returned');
    }

    console.log('User created successfully:', newUser.user.id);

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role,
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to assign role: ' + roleError.message,
          details: roleError 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('Role assigned successfully:', role);

    // Assign permissions for managers
    if (role === 'manager' && userPermissions && userPermissions.length > 0) {
      console.log('Assigning permissions:', userPermissions);
      const permissionsToInsert = userPermissions.map(permission => ({
        user_id: newUser.user.id,
        permission,
      }));

      const { error: permError } = await supabaseAdmin
        .from('user_permissions')
        .insert(permissionsToInsert);

      if (permError) {
        console.error('Error assigning permissions:', permError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to assign permissions: ' + permError.message,
            details: permError 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      console.log('Permissions assigned successfully');
    }

    // Assign branch for staff/delivery
    if (branch_id) {
      const { error: branchError } = await supabaseAdmin
        .from('staff_branches')
        .insert({
          user_id: newUser.user.id,
          branch_id,
        });

      if (branchError) {
        console.error('Error assigning branch:', branchError);
        // Non-fatal, continue
      } else {
        console.log('Branch assigned successfully:', branch_id);
      }
    }

    console.log('Staff user creation completed:', newUser.user.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        userId: newUser.user.id,
        email: newUser.user.email,
        role 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in create-staff-user:', error);
    
    let message = 'Failed to create user';
    let status = 500;

    if (error.message === 'Unauthorized' || error.message === 'Insufficient permissions') {
      message = error.message;
      status = 403;
    } else if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
      message = 'Email already registered';
      status = 409;
    } else if (error.message) {
      message = error.message;
    }

    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      }
    );
  }
});