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

    // Cascade-delete all user-related data before removing the auth user
    const tablesToClean = [
      { table: "order_items", fk: "order_id", subquery: true },
      { table: "orders", fk: "user_id" },
      { table: "reservations", fk: "user_id" },
      { table: "cashback_transactions", fk: "user_id" },
      { table: "user_addresses", fk: "user_id" },
      { table: "user_roles", fk: "user_id" },
      { table: "user_permissions", fk: "user_id" },
      { table: "push_devices", fk: "user_id" },
      { table: "saved_cards", fk: "user_id" },
      { table: "profiles", fk: "id" },
    ];

    for (const entry of tablesToClean) {
      try {
        if (entry.subquery) {
          // Delete order_items for this user's orders
          const { data: userOrders } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("user_id", uid);

          if (userOrders && userOrders.length > 0) {
            const orderIds = userOrders.map((o: any) => o.id);
            await supabaseAdmin
              .from("order_items")
              .delete()
              .in("order_id", orderIds);
          }
        } else {
          await supabaseAdmin
            .from(entry.table)
            .delete()
            .eq(entry.fk, uid);
        }
      } catch (e) {
        // Log but don't fail — table may not exist or have no rows
        console.warn(`[delete-account] Failed to clean ${entry.table}:`, e);
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
