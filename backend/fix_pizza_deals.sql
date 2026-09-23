-- fix_pizza_deals.sql

-- The 4 advertised flavour product IDs:
-- Tikka: 357ab2a5-f800-4b0f-8f10-6d9354060cbc
-- Fajita: 7c19a8fb-78b0-46f3-bd5f-02324f3819bb
-- Achari: 251b4d39-9a50-4244-ab14-5975121595a0
-- Tandoori: d58a0856-5511-4f27-8b18-4b61d4c8b89d
-- Target category: 9468f606-be5d-4472-932b-1bbd64b434f9 (Regular Pizza)

BEGIN TRANSACTION;

-- Deal 1 (Small Pizza)
UPDATE deal_components
SET component_type = 'CATEGORY_CHOICE',
    product_id = NULL,
    name = 'Choice of Flavour',
    target_category_id = '9468f606-be5d-4472-932b-1bbd64b434f9',
    allowed_product_ids = '357ab2a5-f800-4b0f-8f10-6d9354060cbc,7c19a8fb-78b0-46f3-bd5f-02324f3819bb,251b4d39-9a50-4244-ab14-5975121595a0,d58a0856-5511-4f27-8b18-4b61d4c8b89d',
    target_variant_name = 'Small'
WHERE id = '5d7c7593-3580-45cb-9dff-f0658bfe9def';

-- Deal 2 (Medium Pizza)
UPDATE deal_components
SET component_type = 'CATEGORY_CHOICE',
    product_id = NULL,
    name = 'Choice of Flavour',
    target_category_id = '9468f606-be5d-4472-932b-1bbd64b434f9',
    allowed_product_ids = '357ab2a5-f800-4b0f-8f10-6d9354060cbc,7c19a8fb-78b0-46f3-bd5f-02324f3819bb,251b4d39-9a50-4244-ab14-5975121595a0,d58a0856-5511-4f27-8b18-4b61d4c8b89d',
    target_variant_name = 'Medium'
WHERE id = '73ae1380-8830-4f82-bf93-fce0f3901ddd';

-- Deal 3 (Large Pizza)
UPDATE deal_components
SET component_type = 'CATEGORY_CHOICE',
    product_id = NULL,
    name = 'Choice of Flavour',
    target_category_id = '9468f606-be5d-4472-932b-1bbd64b434f9',
    allowed_product_ids = '357ab2a5-f800-4b0f-8f10-6d9354060cbc,7c19a8fb-78b0-46f3-bd5f-02324f3819bb,251b4d39-9a50-4244-ab14-5975121595a0,d58a0856-5511-4f27-8b18-4b61d4c8b89d',
    target_variant_name = 'Large'
WHERE id = 'b310a7d8-a875-4d02-a935-cdb6137184d5';

-- Deal 4 (XL Pizza)
UPDATE deal_components
SET component_type = 'CATEGORY_CHOICE',
    product_id = NULL,
    name = 'Choice of Flavour',
    target_category_id = '9468f606-be5d-4472-932b-1bbd64b434f9',
    allowed_product_ids = '357ab2a5-f800-4b0f-8f10-6d9354060cbc,7c19a8fb-78b0-46f3-bd5f-02324f3819bb,251b4d39-9a50-4244-ab14-5975121595a0,d58a0856-5511-4f27-8b18-4b61d4c8b89d',
    target_variant_name = 'XL'
WHERE id = '01b9f53c-ccf5-42f6-80aa-377a2d942e06';

-- Deal 4 (Medium Pizza)
UPDATE deal_components
SET component_type = 'CATEGORY_CHOICE',
    product_id = NULL,
    name = 'Choice of Flavour',
    target_category_id = '9468f606-be5d-4472-932b-1bbd64b434f9',
    allowed_product_ids = '357ab2a5-f800-4b0f-8f10-6d9354060cbc,7c19a8fb-78b0-46f3-bd5f-02324f3819bb,251b4d39-9a50-4244-ab14-5975121595a0,d58a0856-5511-4f27-8b18-4b61d4c8b89d',
    target_variant_name = 'Medium'
WHERE id = '73f6c29c-767f-4f5a-ab61-5df3b26c4499';

-- Deal 5 (Large Pizza)
UPDATE deal_components
SET component_type = 'CATEGORY_CHOICE',
    product_id = NULL,
    name = 'Choice of Flavour',
    target_category_id = '9468f606-be5d-4472-932b-1bbd64b434f9',
    allowed_product_ids = '357ab2a5-f800-4b0f-8f10-6d9354060cbc,7c19a8fb-78b0-46f3-bd5f-02324f3819bb,251b4d39-9a50-4244-ab14-5975121595a0,d58a0856-5511-4f27-8b18-4b61d4c8b89d',
    target_variant_name = 'Large'
WHERE id = '99f0f8a4-ae13-487f-b85f-31871a6f97dc';

-- Deal 6 (Medium Pizza)
UPDATE deal_components
SET component_type = 'CATEGORY_CHOICE',
    product_id = NULL,
    name = 'Choice of Flavour',
    target_category_id = '9468f606-be5d-4472-932b-1bbd64b434f9',
    allowed_product_ids = '357ab2a5-f800-4b0f-8f10-6d9354060cbc,7c19a8fb-78b0-46f3-bd5f-02324f3819bb,251b4d39-9a50-4244-ab14-5975121595a0,d58a0856-5511-4f27-8b18-4b61d4c8b89d',
    target_variant_name = 'Medium'
WHERE id = 'a7600b44-47be-478b-9351-1a32dbfe0699';

-- Deal 7 (Small Pizza)
UPDATE deal_components
SET component_type = 'CATEGORY_CHOICE',
    product_id = NULL,
    name = 'Choice of Flavour',
    target_category_id = '9468f606-be5d-4472-932b-1bbd64b434f9',
    allowed_product_ids = '357ab2a5-f800-4b0f-8f10-6d9354060cbc,7c19a8fb-78b0-46f3-bd5f-02324f3819bb,251b4d39-9a50-4244-ab14-5975121595a0,d58a0856-5511-4f27-8b18-4b61d4c8b89d',
    target_variant_name = 'Small'
WHERE id = 'ef84d775-e6a2-457c-808f-23a780631ae6';

COMMIT;
