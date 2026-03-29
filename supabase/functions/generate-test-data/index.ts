import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Create 3 Branches
    const branches = [
      {
        name: "Downtown Branch",
        address: "123 Main Street",
        city: "New York",
        phone: "+1-555-0101",
        opens_at: "09:00:00",
        closes_at: "22:00:00",
        is_active: true,
        delivery_radius_km: 5.0,
        latitude: 40.7128,
        longitude: -74.0060,
      },
      {
        name: "Uptown Branch",
        address: "456 Park Avenue",
        city: "New York",
        phone: "+1-555-0102",
        opens_at: "10:00:00",
        closes_at: "23:00:00",
        is_active: true,
        delivery_radius_km: 7.0,
        latitude: 40.7589,
        longitude: -73.9851,
      },
      {
        name: "Brooklyn Branch",
        address: "789 Bedford Avenue",
        city: "Brooklyn",
        phone: "+1-555-0103",
        opens_at: "08:00:00",
        closes_at: "21:00:00",
        is_active: true,
        delivery_radius_km: 4.5,
        latitude: 40.6782,
        longitude: -73.9442,
      },
    ];

    const { data: branchData, error: branchError } = await supabase
      .from("branches")
      .insert(branches)
      .select();

    if (branchError) throw branchError;

    // 2. Create Allergens
    const allergens = [
      { name: "Gluten", description: "Contains wheat, barley, or rye" },
      { name: "Dairy", description: "Contains milk products" },
      { name: "Nuts", description: "Contains tree nuts or peanuts" },
      { name: "Shellfish", description: "Contains shellfish or crustaceans" },
      { name: "Soy", description: "Contains soy products" },
      { name: "Eggs", description: "Contains eggs" },
    ];

    const { data: allergenData, error: allergenError } = await supabase
      .from("allergens")
      .insert(allergens)
      .select();

    if (allergenError) throw allergenError;

    // 3. Create 6 Categories
    const categories = [
      { name: "Appetizers", description: "Start your meal right", display_order: 1, is_active: true },
      { name: "Salads", description: "Fresh and healthy options", display_order: 2, is_active: true },
      { name: "Main Courses", description: "Hearty and satisfying", display_order: 3, is_active: true },
      { name: "Seafood", description: "From the ocean to your plate", display_order: 4, is_active: true },
      { name: "Desserts", description: "Sweet endings", display_order: 5, is_active: true },
      { name: "Beverages", description: "Drinks to complement your meal", display_order: 6, is_active: true },
    ];

    const { data: categoryData, error: categoryError } = await supabase
      .from("menu_categories")
      .insert(categories)
      .select();

    if (categoryError) throw categoryError;

    // 4. Create Modifier Groups
    const modifierGroups = [
      { name: "Spice Level", is_required: true, min_selections: 1, max_selections: 1 },
      { name: "Extra Toppings", is_required: false, min_selections: 0, max_selections: 5 },
      { name: "Size", is_required: true, min_selections: 1, max_selections: 1 },
    ];

    const { data: modifierGroupData, error: modifierGroupError } = await supabase
      .from("modifier_groups")
      .insert(modifierGroups)
      .select();

    if (modifierGroupError) throw modifierGroupError;

    // 5. Create Modifiers
    const modifiers = [
      // Spice Level
      { name: "Mild", group_id: modifierGroupData[0].id, price_adjustment: 0 },
      { name: "Medium", group_id: modifierGroupData[0].id, price_adjustment: 0 },
      { name: "Hot", group_id: modifierGroupData[0].id, price_adjustment: 0 },
      { name: "Extra Hot", group_id: modifierGroupData[0].id, price_adjustment: 1.00 },
      // Extra Toppings
      { name: "Extra Cheese", group_id: modifierGroupData[1].id, price_adjustment: 2.00 },
      { name: "Avocado", group_id: modifierGroupData[1].id, price_adjustment: 2.50 },
      { name: "Bacon", group_id: modifierGroupData[1].id, price_adjustment: 3.00 },
      { name: "Mushrooms", group_id: modifierGroupData[1].id, price_adjustment: 1.50 },
      // Size
      { name: "Small", group_id: modifierGroupData[2].id, price_adjustment: -2.00 },
      { name: "Regular", group_id: modifierGroupData[2].id, price_adjustment: 0 },
      { name: "Large", group_id: modifierGroupData[2].id, price_adjustment: 3.00 },
    ];

    const { data: modifierData, error: modifierError } = await supabase
      .from("modifiers")
      .insert(modifiers)
      .select();

    if (modifierError) throw modifierError;

    // 6. Create Menu Items (4 per category = 24 items)
    const menuItems = [];
    const menuItemsPerCategory = [
      // Appetizers
      [
        { name: "Spring Rolls", description: "Crispy vegetable spring rolls with sweet chili sauce", price: 8.99, is_vegetarian: true, is_vegan: true, calories: 250 },
        { name: "Chicken Wings", description: "Spicy buffalo wings with ranch dressing", price: 12.99, calories: 450 },
        { name: "Mozzarella Sticks", description: "Golden fried mozzarella with marinara sauce", price: 9.99, is_vegetarian: true, calories: 380 },
        { name: "Calamari", description: "Lightly breaded calamari rings with aioli", price: 14.99, calories: 320 },
      ],
      // Salads
      [
        { name: "Caesar Salad", description: "Crisp romaine with parmesan and croutons", price: 11.99, is_vegetarian: true, calories: 280 },
        { name: "Greek Salad", description: "Fresh vegetables with feta and olives", price: 10.99, is_vegetarian: true, calories: 250 },
        { name: "Cobb Salad", description: "Mixed greens with chicken, bacon, and egg", price: 14.99, calories: 420 },
        { name: "Quinoa Bowl", description: "Superfood bowl with roasted vegetables", price: 13.99, is_vegetarian: true, is_vegan: true, calories: 350 },
      ],
      // Main Courses
      [
        { name: "Grilled Steak", description: "8oz ribeye with garlic butter and fries", price: 28.99, calories: 680 },
        { name: "Pasta Carbonara", description: "Classic Italian pasta with bacon and cream", price: 16.99, calories: 520 },
        { name: "Chicken Teriyaki", description: "Grilled chicken with teriyaki glaze and rice", price: 18.99, calories: 480 },
        { name: "Vegetable Stir Fry", description: "Asian vegetables with tofu and noodles", price: 15.99, is_vegetarian: true, is_vegan: true, calories: 400 },
      ],
      // Seafood
      [
        { name: "Grilled Salmon", description: "Atlantic salmon with lemon butter sauce", price: 24.99, calories: 450 },
        { name: "Fish & Chips", description: "Beer battered cod with tartar sauce", price: 19.99, calories: 620 },
        { name: "Shrimp Scampi", description: "Garlic butter shrimp over linguine", price: 22.99, calories: 510 },
        { name: "Lobster Roll", description: "Fresh lobster in a toasted bun", price: 26.99, calories: 380 },
      ],
      // Desserts
      [
        { name: "Chocolate Lava Cake", description: "Warm chocolate cake with vanilla ice cream", price: 8.99, is_vegetarian: true, calories: 520 },
        { name: "Cheesecake", description: "New York style with berry compote", price: 7.99, is_vegetarian: true, calories: 450 },
        { name: "Tiramisu", description: "Classic Italian coffee-flavored dessert", price: 8.99, is_vegetarian: true, calories: 380 },
        { name: "Ice Cream Sundae", description: "Three scoops with toppings of choice", price: 6.99, is_vegetarian: true, calories: 420 },
      ],
      // Beverages
      [
        { name: "Fresh Orange Juice", description: "Freshly squeezed orange juice", price: 4.99, is_vegetarian: true, is_vegan: true, calories: 110 },
        { name: "Iced Tea", description: "Sweet or unsweetened", price: 3.99, is_vegetarian: true, is_vegan: true, calories: 90 },
        { name: "Cappuccino", description: "Italian coffee with steamed milk", price: 4.99, is_vegetarian: true, calories: 80 },
        { name: "Smoothie", description: "Tropical fruit blend", price: 6.99, is_vegetarian: true, is_vegan: true, calories: 220 },
      ],
    ];

    for (let i = 0; i < categoryData.length; i++) {
      for (const item of menuItemsPerCategory[i]) {
        menuItems.push({
          ...item,
          category_id: categoryData[i].id,
          is_available: true,
          is_featured: Math.random() > 0.7,
          preparation_time_mins: Math.floor(Math.random() * 20) + 10,
        });
      }
    }

    const { data: menuItemData, error: menuItemError } = await supabase
      .from("menu_items")
      .insert(menuItems)
      .select();

    if (menuItemError) throw menuItemError;

    // 7. Link menu items to branches with availability
    const branchMenuItems = [];
    for (const branch of branchData) {
      for (const item of menuItemData) {
        branchMenuItems.push({
          branch_id: branch.id,
          menu_item_id: item.id,
          is_available: Math.random() > 0.1, // 90% available
          price_override: Math.random() > 0.8 ? item.price * 1.1 : null, // 20% have price override
        });
      }
    }

    const { error: branchMenuError } = await supabase
      .from("branch_menu_items")
      .insert(branchMenuItems);

    if (branchMenuError) throw branchMenuError;

    // 8. Link allergens to menu items
    const menuItemAllergens = [];
    for (const item of menuItemData) {
      // Randomly assign 0-3 allergens to each item
      const numAllergens = Math.floor(Math.random() * 4);
      const shuffled = [...allergenData].sort(() => 0.5 - Math.random());
      const selectedAllergens = shuffled.slice(0, numAllergens);
      
      for (const allergen of selectedAllergens) {
        menuItemAllergens.push({
          menu_item_id: item.id,
          allergen_id: allergen.id,
        });
      }
    }

    if (menuItemAllergens.length > 0) {
      const { error: allergenLinkError } = await supabase
        .from("menu_item_allergens")
        .insert(menuItemAllergens);

      if (allergenLinkError) throw allergenLinkError;
    }

    // 9. Link modifiers to menu items
    const menuItemModifiers = [];
    for (const item of menuItemData) {
      // Add spice level to non-dessert and non-beverage items
      if (!item.name.includes("Ice Cream") && !item.name.includes("Juice") && !item.name.includes("Tea")) {
        menuItemModifiers.push({
          menu_item_id: item.id,
          modifier_group_id: modifierGroupData[0].id, // Spice Level
        });
      }
      
      // Add extra toppings to main courses
      if (item.category_id === categoryData[2].id) {
        menuItemModifiers.push({
          menu_item_id: item.id,
          modifier_group_id: modifierGroupData[1].id, // Extra Toppings
        });
      }
      
      // Add size to beverages
      if (item.category_id === categoryData[5].id) {
        menuItemModifiers.push({
          menu_item_id: item.id,
          modifier_group_id: modifierGroupData[2].id, // Size
        });
      }
    }

    if (menuItemModifiers.length > 0) {
      const { error: modifierLinkError } = await supabase
        .from("menu_item_modifiers")
        .insert(menuItemModifiers);

      if (modifierLinkError) throw modifierLinkError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test data generated successfully",
        stats: {
          branches: branchData.length,
          categories: categoryData.length,
          menuItems: menuItemData.length,
          allergens: allergenData.length,
          modifierGroups: modifierGroupData.length,
          modifiers: modifierData.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating test data:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
