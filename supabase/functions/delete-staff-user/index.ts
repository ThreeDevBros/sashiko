import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callerUser) {
      throw new Error("Unauthorized");
    }

    // Check if caller is admin or manager with manage_staff permission
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    
    if (!isAdmin) {
      // Check if manager with manage_staff permission
      const isManager = callerRoles?.some((r) => r.role === "manager");
      if (!isManager) {
        throw new Error("Insufficient permissions");
      }
      const { data: perms } = await supabaseAdmin
        .from("user_permissions")
        .select("permission")
        .eq("user_id", callerUser.id)
        .eq("permission", "manage_staff");
      if (!perms || perms.length === 0) {
        throw new Error("Insufficient permissions");
      }
    }

    const { userId } = await req.json();
    if (!userId) {
      throw new Error("userId is required");
    }

    // Prevent deleting yourself
    if (userId === callerUser.id) {
      throw new Error("Cannot delete your own account");
    }

    // Verify the target user is a staff/delivery/manager (not admin)
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (targetRoles?.some((r) => r.role === "admin")) {
      throw new Error("Cannot delete admin users");
    }

    // Delete related data first (cascade should handle most, but be explicit)
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("staff_branches").delete().eq("user_id", userId);
    

    // Delete the auth user entirely so they cannot log in
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
