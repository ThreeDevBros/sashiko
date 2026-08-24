import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Verify the request is from an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const uid = user.id;

    // Cascade-delete all user-related data before removing the auth user.
    // Table/column names must match the real schema — a mismatch here would
    // silently leave personal data behind after "account deletion".
    const tablesToClean = [
      { table: "order_items", fk: "order_id", subquery: true },
      { table: "live_activity_tokens", fk: "user_id" },
      { table: "driver_locations", fk: "driver_id" },
      { table: "orders", fk: "user_id" },
      { table: "table_reservations", fk: "user_id" },
      { table: "user_addresses", fk: "user_id" },
      { table: "user_roles", fk: "user_id" },
      { table: "user_permissions", fk: "user_id" },
      { table: "push_device_tokens", fk: "user_id" },
      { table: "profiles", fk: "id" },
    ];

    for (const entry of tablesToClean) {
      if (entry.subquery) {
        // Delete order_items for this user's orders
        const { data: userOrders, error: ordersError } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("user_id", uid);

        if (ordersError) {
          throw new Error(`Failed to read orders during deletion: ${ordersError.message}`);
        }

        if (userOrders && userOrders.length > 0) {
          const orderIds = userOrders.map((o: any) => o.id);
          const { error: itemsError } = await supabaseAdmin
            .from("order_items")
            .delete()
            .in("order_id", orderIds);
          if (itemsError) {
            throw new Error(`Failed to clean order_items: ${itemsError.message}`);
          }
        }
      } else {
        const { error: delError } = await supabaseAdmin
          .from(entry.table)
          .delete()
          .eq(entry.fk, uid);
        if (delError) {
          throw new Error(`Failed to clean ${entry.table}: ${delError.message}`);
        }
      }
    }

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(uid);

    if (deleteError) {
      throw deleteError;
    }


    return new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
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
