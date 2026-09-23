-- Supabase PostgreSQL Schema Sync Script (Final Pass)
-- This script safely adds EVERY SINGLE COLUMN that exists in your local SQLite database
-- to your Supabase PostgreSQL database. 
-- It uses "IF NOT EXISTS", so it will safely skip columns you already have and only add the missing ones.

-- ==============================================================================
-- PART 1: ORDERS
-- ==============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS business_date TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cashier_user_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shift_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lifecycle_state TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kitchen_state TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_state TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_total NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_total NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tip_total NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS grand_total NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_total NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS due_total NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS hold_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS held_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sync_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sync_version INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sync_hash TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_state TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_charge NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS waiter_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS waiter_name_snapshot TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_name_snapshot TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payload_version INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;


-- ==============================================================================
-- PART 2: ORDER ITEMS
-- ==============================================================================
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS order_id UUID;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_code_snapshot TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS base_unit_price NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS final_unit_price NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS total_amount NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tax_rate NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tax_name TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_tax_inclusive INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS kitchen_station_id UUID;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS kitchen_station_name_snapshot TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS estimated_prep_minutes INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS kitchen_state TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS kitchen_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS kitchen_ready_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS kitchen_served_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS kitchen_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS kitchen_cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS payload_version INTEGER;


-- ==============================================================================
-- PART 3: PRODUCTS
-- ==============================================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lifecycle_state TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS version INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_inventory INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kitchen_printer_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS keywords TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS preparation_time INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_popular INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_suggested INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS visibility TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_order INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS payload_version INTEGER;


-- ==============================================================================
-- PART 4: CATEGORIES
-- ==============================================================================
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS display_order INTEGER;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS lifecycle_state TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS version INTEGER;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color_code TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon_name TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS visibility TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS kitchen_printer_id UUID;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS payload_version INTEGER;


-- ==============================================================================
-- PART 5: DEALS
-- ==============================================================================
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS pricing_strategy TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lifecycle_state TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS version INTEGER;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS is_customizable INTEGER;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS payload_version INTEGER;


-- ==============================================================================
-- PART 6: CUSTOMERS
-- ==============================================================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_number TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points INTEGER;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_vip INTEGER;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS payload_version INTEGER;


-- ==============================================================================
-- PART 7: USERS
-- ==============================================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pin_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS force_pin_change INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS joining_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS show_on_login INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payload_version INTEGER;


-- ==============================================================================
-- PART 8: ORDER PAYMENTS
-- ==============================================================================
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS order_id UUID;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS shift_id UUID;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS cashier_user_id UUID;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS business_date TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS payment_method_label TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS amount_received NUMERIC;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS change_returned NUMERIC;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS transaction_reference TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS approval_code TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS gateway_response TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS voided_by_user_id UUID;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS sync_status TEXT;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS payload_version INTEGER;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;


-- ==============================================================================
-- PART 9: DINING TABLES
-- ==============================================================================
ALTER TABLE public.dining_tables ADD COLUMN IF NOT EXISTS table_number TEXT;
ALTER TABLE public.dining_tables ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE public.dining_tables ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.dining_tables ADD COLUMN IF NOT EXISTS zone TEXT;
ALTER TABLE public.dining_tables ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.dining_tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.dining_tables ADD COLUMN IF NOT EXISTS payload_version INTEGER;


-- ==============================================================================
-- PART 10: APPLICATION SETTINGS
-- ==============================================================================
ALTER TABLE public.application_settings ADD COLUMN IF NOT EXISTS value TEXT;
ALTER TABLE public.application_settings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.application_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.application_settings ADD COLUMN IF NOT EXISTS category TEXT;
