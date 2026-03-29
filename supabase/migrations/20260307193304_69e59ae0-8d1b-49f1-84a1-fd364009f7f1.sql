
-- Create new categories for the Japanese/Wine menu
INSERT INTO menu_categories (id, name, description, display_order, is_active) VALUES
  ('a1000001-0000-0000-0000-000000000001', 'Sashimi', 'Thin slices of fresh raw fish (5 slices)', 2, true),
  ('a1000001-0000-0000-0000-000000000002', 'Sushi Rolls - Cooked', 'Cooked sushi rolls (8 pieces)', 3, true),
  ('a1000001-0000-0000-0000-000000000003', 'Sushi Rolls - Raw', 'Uncooked raw sushi rolls (8 pieces)', 4, true),
  ('a1000001-0000-0000-0000-000000000004', 'Nigiri', 'Nigiri sushi (2 pieces)', 5, true),
  ('a1000001-0000-0000-0000-000000000005', 'White Wines', 'White wines (75cl unless specified)', 6, true);

-- SASHIMI items
INSERT INTO menu_items (id, name, description, price, category_id, is_available) VALUES
  ('b1000001-0000-0000-0000-000000000001', 'Tuna Sashimi', 'Tuna / τόνος', 10.00, 'a1000001-0000-0000-0000-000000000001', true),
  ('b1000001-0000-0000-0000-000000000002', 'Salmon Sashimi', 'Salmon / σολομός', 11.00, 'a1000001-0000-0000-0000-000000000001', true),
  ('b1000001-0000-0000-0000-000000000003', 'Sea Bass Sashimi', 'Sea bass / λαβράκι', 11.00, 'a1000001-0000-0000-0000-000000000001', true),
  ('b1000001-0000-0000-0000-000000000004', 'Octopus Sashimi', 'Octopus / χταπόδι', 11.00, 'a1000001-0000-0000-0000-000000000001', true),
  ('b1000001-0000-0000-0000-000000000005', 'Unagi Sashimi', 'Unagi / χέλι', 12.00, 'a1000001-0000-0000-0000-000000000001', true);

-- SUSHI ROLLS - COOKED
INSERT INTO menu_items (id, name, description, price, category_id, is_available, is_vegetarian) VALUES
  ('b1000002-0000-0000-0000-000000000001', 'Kappa Roll', 'Cucumber roll / αγγούρι', 8.00, 'a1000001-0000-0000-0000-000000000002', true, true),
  ('b1000002-0000-0000-0000-000000000002', 'California Roll', 'Avocado, cucumber, cream cheese, crab stick', 10.00, 'a1000001-0000-0000-0000-000000000002', true, false),
  ('b1000002-0000-0000-0000-000000000003', 'Vegetable Roll', 'Vegetable / Λαχανικά', 9.00, 'a1000001-0000-0000-0000-000000000002', true, true),
  ('b1000002-0000-0000-0000-000000000004', 'Smoked Eel Cucumber Roll', 'Smoked eel cucumber / καπνιστό χέλι αγγούρι', 14.00, 'a1000001-0000-0000-0000-000000000002', true, false),
  ('b1000002-0000-0000-0000-000000000005', 'Smoked Salmon Roll', 'Smoked salmon / καπνιστός σολομός', 11.00, 'a1000001-0000-0000-0000-000000000002', true, false),
  ('b1000002-0000-0000-0000-000000000006', 'Salmon Skin Roll', 'Salmon skin, cream cheese / δέρμα σολομού, κρεμώδες τυρί', 10.00, 'a1000001-0000-0000-0000-000000000002', true, false);

-- SUSHI ROLLS - RAW
INSERT INTO menu_items (id, name, description, price, category_id, is_available) VALUES
  ('b1000003-0000-0000-0000-000000000001', 'Tuna Roll', 'Tuna / τόνος', 11.00, 'a1000001-0000-0000-0000-000000000003', true),
  ('b1000003-0000-0000-0000-000000000002', 'Salmon Roll', 'Salmon / σολομός', 11.00, 'a1000001-0000-0000-0000-000000000003', true),
  ('b1000003-0000-0000-0000-000000000003', 'Spicy Tuna Roll', 'Spicy tuna / πικάντικος τόνος', 11.00, 'a1000001-0000-0000-0000-000000000003', true),
  ('b1000003-0000-0000-0000-000000000004', 'Salmon Avocado Cream Cheese Roll', 'Salmon avocado cream cheese / σολομός αβοκάντο', 11.00, 'a1000001-0000-0000-0000-000000000003', true),
  ('b1000003-0000-0000-0000-000000000005', 'Sashiko Roll', 'Cream cheese, salmon / κρέμα τυριού, σολομός', 12.00, 'a1000001-0000-0000-0000-000000000003', true);

-- NIGIRI
INSERT INTO menu_items (id, name, description, price, category_id, is_available) VALUES
  ('b1000004-0000-0000-0000-000000000001', 'Tuna Nigiri', 'Tuna / τόνος (2 pieces)', 5.50, 'a1000001-0000-0000-0000-000000000004', true),
  ('b1000004-0000-0000-0000-000000000002', 'Salmon Nigiri', 'Salmon / σολομός (2 pieces)', 5.50, 'a1000001-0000-0000-0000-000000000004', true),
  ('b1000004-0000-0000-0000-000000000003', 'Sea Bass Nigiri', 'Sea bass / λαβράκι (2 pieces)', 5.50, 'a1000001-0000-0000-0000-000000000004', true),
  ('b1000004-0000-0000-0000-000000000004', 'Octopus Nigiri', 'Octopus / χταπόδι (2 pieces)', 5.50, 'a1000001-0000-0000-0000-000000000004', true),
  ('b1000004-0000-0000-0000-000000000005', 'Smoked Salmon Nigiri', 'Smoked salmon / καπνιστός σολομός (2 pieces)', 5.50, 'a1000001-0000-0000-0000-000000000004', true),
  ('b1000004-0000-0000-0000-000000000006', 'Smoked Eel Nigiri', 'Smoked eel / καπνιστό χέλι (2 pieces)', 5.50, 'a1000001-0000-0000-0000-000000000004', true);

-- WHITE WINES
INSERT INTO menu_items (id, name, description, price, category_id, is_available) VALUES
  ('b1000005-0000-0000-0000-000000000001', 'House Wine 75cl', 'Tsiakkas, dry, xinisteri', 23.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000002', 'House Wine 37.5cl', 'Tsiakkas, dry, xinisteri, 37.5cl bottle', 12.50, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000003', 'House Wine 18.7cl', 'Tsiakkas, dry, xinisteri, 18.7cl', 6.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000004', 'Moschofilero Boutari 75cl', 'Dry white wine', 24.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000005', 'Moschofilero Boutari 18.7cl', 'Dry white wine, 18.7cl', 6.50, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000006', 'Vasilikon', 'Dry, xinisteri', 23.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000007', 'Persefoni', 'Dry, xinisteri', 23.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000008', 'Petritis', 'Dry white wine', 24.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000009', 'Guiseppe & Luigi Pinot Grigio', 'Dry Pinot Grigio', 24.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000010', 'Reguta Prediale', 'Dry, exotic, sauvignon blanc, chardonnay', 26.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000011', 'Tsiakkas Sauvignon Blanc', 'Dry, sauvignon blanc', 28.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000012', 'Argyrides Chardonnay', 'Chardonnay', 28.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000013', 'Argyrides Viogner', 'Viogner', 28.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000014', 'Tselepos Mantineia', 'Moschofilero', 27.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000015', 'Scaia Garganega', 'Chardonnay, Italy', 30.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000016', 'Monte di Colognola', 'Garganega, Trebbiano Soave', 31.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000017', 'Pavlides Thema', 'Assyrtiko, sauvignon blanc', 34.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000018', 'Tselepos Melisopetra', 'Dry white wine', 35.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000019', 'Gerovasiliou White', 'Dry white wine', 37.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000020', 'Gerovasiliou Malagousia', 'Malagousia grape variety', 40.00, 'a1000001-0000-0000-0000-000000000005', true),
  ('b1000005-0000-0000-0000-000000000021', 'Gerovasiliou Chardonnay', 'Premium Chardonnay', 45.00, 'a1000001-0000-0000-0000-000000000005', true);

-- Link ALL new menu items to the Sashiko branch
INSERT INTO branch_menu_items (branch_id, menu_item_id, is_available)
SELECT 'de5c7ad7-7890-4b4a-bd94-8ba2552372f3', id, true
FROM menu_items
WHERE id::text LIKE 'b1000%';
