-- migrate_bbq_platters.sql

-- 1. Remove Old Products
DELETE FROM products WHERE id IN ('52dd09ac-97aa-4ba6-946a-1855ead0bcbe', 'cfd3aea8-27df-40da-929f-7d010b00998f');

-- 2. Update Category to Deals menu context (by changing parent_id to Deals category)
UPDATE categories 
SET parent_id = 'd8435e3d-fa11-479b-bec6-54e58c197e24' 
WHERE id = '254ba2fe-7c2c-4c63-b09d-36a8f426d1b2';

-- 3. Insert Deals (Bar-B-Q Platter (Full) and Bar-B-Q Platter (Half))
INSERT INTO deals (id, code, name, description, price, pricing_strategy, lifecycle_state, version, is_customizable)
VALUES 
('d1a2c3b4-1234-5678-90ab-cdef01234567', 'BBQ-PLATTER-FULL', 'Bar-B-Q Platter (Full)', 'Includes: 4 Piece Kabab, 1 Seekh Tikka Boti, 1 Seekh Malai Boti, 1 Tikka Piece (Leg), 1 Seekh Shish Tawook, 2 Piece Kalmi Tikka, 2 Piece Naan, Yakhni Pulao', 3600.0, 'FIXED', 'ACTIVE', 1, 0),
('e5f6g7h8-1234-5678-90ab-cdef01234567', 'BBQ-PLATTER-HALF', 'Bar-B-Q Platter (Half)', 'Includes: 2 Piece Kabab, 1 Seekh Tikka Boti, 1 Kastoori Boti, 1 Tikka Piece, 2 Piece Naan, Yakhni Pulao', 2400.0, 'FIXED', 'ACTIVE', 1, 0);

-- 4. Insert Components for Full Platter ('d1a2c3b4-1234-5678-90ab-cdef01234567')
-- 4x Chicken Kabab (8e6ed195-91da-4ee1-8442-a6dc1812613f)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'd1a2c3b4-1234-5678-90ab-cdef01234567', 'Chicken Kabab', 'FIXED_PRODUCT', '8e6ed195-91da-4ee1-8442-a6dc1812613f', 4);

-- 1x Tikka Boti (454d02e0-5db6-4217-a0dd-3c52804748d5)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'd1a2c3b4-1234-5678-90ab-cdef01234567', 'Tikka Boti', 'FIXED_PRODUCT', '454d02e0-5db6-4217-a0dd-3c52804748d5', 1);

-- 1x Malai Boti (568f8f87-8597-42f3-85e0-7a0557ed9e4f)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'd1a2c3b4-1234-5678-90ab-cdef01234567', 'Malai Boti', 'FIXED_PRODUCT', '568f8f87-8597-42f3-85e0-7a0557ed9e4f', 1);

-- 1x Tikka Piece (Leg) (141899f3-fecf-45ac-ab3a-764217ce0f4a)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'd1a2c3b4-1234-5678-90ab-cdef01234567', 'Tikka Piece (Leg)', 'FIXED_PRODUCT', '141899f3-fecf-45ac-ab3a-764217ce0f4a', 1);

-- 1x Shish Tawook Boti (c8a991a4-3eb8-4374-bd96-9c07d4cca018)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'd1a2c3b4-1234-5678-90ab-cdef01234567', 'Shish Tawook Boti', 'FIXED_PRODUCT', 'c8a991a4-3eb8-4374-bd96-9c07d4cca018', 1);

-- 2x Qalmi Tikka (e243523f-c141-4d0d-a1c1-37ce5e0e9827) with target_variant_name 'Half'
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity, target_variant_name)
VALUES (lower(hex(randomblob(16))), 'd1a2c3b4-1234-5678-90ab-cdef01234567', 'Qalmi Tikka', 'FIXED_PRODUCT', 'e243523f-c141-4d0d-a1c1-37ce5e0e9827', 2, 'Half');

-- 2x Sada Naan (947c6b4f-d689-438b-acf6-1989edd4d007)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'd1a2c3b4-1234-5678-90ab-cdef01234567', 'Sada Naan', 'FIXED_PRODUCT', '947c6b4f-d689-438b-acf6-1989edd4d007', 2);

-- 1x Jangi Pulao (449cebb5-a189-4867-acb0-b9531568c6c2)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'd1a2c3b4-1234-5678-90ab-cdef01234567', 'Jangi Pulao', 'FIXED_PRODUCT', '449cebb5-a189-4867-acb0-b9531568c6c2', 1);


-- 5. Insert Components for Half Platter ('e5f6g7h8-1234-5678-90ab-cdef01234567')
-- 2x Chicken Kabab (8e6ed195-91da-4ee1-8442-a6dc1812613f)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'e5f6g7h8-1234-5678-90ab-cdef01234567', 'Chicken Kabab', 'FIXED_PRODUCT', '8e6ed195-91da-4ee1-8442-a6dc1812613f', 2);

-- 1x Tikka Boti (454d02e0-5db6-4217-a0dd-3c52804748d5)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'e5f6g7h8-1234-5678-90ab-cdef01234567', 'Tikka Boti', 'FIXED_PRODUCT', '454d02e0-5db6-4217-a0dd-3c52804748d5', 1);

-- 1x Kastoori Boti (eaba78a4-fed9-4d4a-943e-6695387be96d)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'e5f6g7h8-1234-5678-90ab-cdef01234567', 'Kastoori Boti', 'FIXED_PRODUCT', 'eaba78a4-fed9-4d4a-943e-6695387be96d', 1);

-- 1x Tikka Piece (Leg) (141899f3-fecf-45ac-ab3a-764217ce0f4a)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'e5f6g7h8-1234-5678-90ab-cdef01234567', 'Tikka Piece', 'FIXED_PRODUCT', '141899f3-fecf-45ac-ab3a-764217ce0f4a', 1);

-- 2x Sada Naan (947c6b4f-d689-438b-acf6-1989edd4d007)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'e5f6g7h8-1234-5678-90ab-cdef01234567', 'Sada Naan', 'FIXED_PRODUCT', '947c6b4f-d689-438b-acf6-1989edd4d007', 2);

-- 1x Jangi Pulao (449cebb5-a189-4867-acb0-b9531568c6c2)
INSERT INTO deal_components (id, deal_id, name, component_type, product_id, quantity)
VALUES (lower(hex(randomblob(16))), 'e5f6g7h8-1234-5678-90ab-cdef01234567', 'Jangi Pulao', 'FIXED_PRODUCT', '449cebb5-a189-4867-acb0-b9531568c6c2', 1);
