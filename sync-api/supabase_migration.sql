-- Dubai Food Software: Supabase PostgreSQL Migration
-- Translates SQLite schema to PostgreSQL for Cloud Synchronization

-- ==========================================
-- 1. EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. CORE TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'CASHIER',
    is_active INTEGER NOT NULL DEFAULT 1,
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meta_key VARCHAR(255) NOT NULL UNIQUE,
    meta_value TEXT,
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    color_code VARCHAR(50),
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    product_code VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    cost NUMERIC(10,2) DEFAULT 0,
    barcode VARCHAR(255) UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    track_inventory INTEGER NOT NULL DEFAULT 0,
    kitchen_printer_id UUID,
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_number VARCHAR(255) UNIQUE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    loyalty_points INTEGER DEFAULT 0,
    is_vip INTEGER DEFAULT 0,
    notes TEXT,
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. TRANSACTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(255) NOT NULL UNIQUE,
    business_date VARCHAR(50) NOT NULL,
    branch_id VARCHAR(255) NOT NULL DEFAULT 'DEFAULT_BRANCH',
    cashier_user_id UUID NOT NULL,
    shift_id UUID,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    table_id UUID,
    order_type VARCHAR(50) NOT NULL DEFAULT 'DINE_IN',
    lifecycle_state VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    kitchen_state VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payment_state VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
    delivery_state VARCHAR(50) DEFAULT NULL,
    waiter_id UUID,
    waiter_name_snapshot VARCHAR(255),
    rider_id UUID,
    rider_name_snapshot VARCHAR(255),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    tip_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    paid_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    due_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    hold_name VARCHAR(255),
    held_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'PENDING', -- Used for immutability check (COMPLETED)
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    product_code_snapshot VARCHAR(255),
    base_unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    final_unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_name VARCHAR(50) DEFAULT 'VAT',
    is_tax_inclusive INTEGER NOT NULL DEFAULT 0,
    kitchen_station_id UUID,
    kitchen_station_name_snapshot VARCHAR(255),
    estimated_prep_minutes INTEGER DEFAULT 10,
    kitchen_state VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    payload_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. RLS & POLICIES (For Waiter Tablets hitting REST API)
-- ==========================================
-- In Phase 7, we rely on Service Role for pushes.
-- Waiter Tablets may read via public endpoints or with explicit tokens.
-- For now, allow reading for Waiters (if desired) or rely on sync-api Express proxy.
