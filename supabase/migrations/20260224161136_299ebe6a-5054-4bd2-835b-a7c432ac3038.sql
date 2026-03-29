
-- Drop and recreate FK constraints with ON DELETE CASCADE for all tables referencing branches
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_branch_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.table_reservations DROP CONSTRAINT IF EXISTS table_reservations_branch_id_fkey;
ALTER TABLE public.table_reservations ADD CONSTRAINT table_reservations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.branch_menu_items DROP CONSTRAINT IF EXISTS branch_menu_items_branch_id_fkey;
ALTER TABLE public.branch_menu_items ADD CONSTRAINT branch_menu_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.staff_shifts DROP CONSTRAINT IF EXISTS staff_shifts_branch_id_fkey;
ALTER TABLE public.staff_shifts ADD CONSTRAINT staff_shifts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

-- Also cascade from orders to order_items and order_item_modifiers
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_item_modifiers DROP CONSTRAINT IF EXISTS order_item_modifiers_order_item_id_fkey;
ALTER TABLE public.order_item_modifiers ADD CONSTRAINT order_item_modifiers_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;

ALTER TABLE public.driver_locations DROP CONSTRAINT IF EXISTS driver_locations_order_id_fkey;
ALTER TABLE public.driver_locations ADD CONSTRAINT driver_locations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
