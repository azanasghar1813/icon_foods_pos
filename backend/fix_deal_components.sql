-- ============================================================
-- Fix script for broken deal_components (NULL product_id rows)
-- Database: pos.db
-- ============================================================

BEGIN TRANSACTION;

-- Deal 1 (D1): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '07d00ae3-fa58-4fa7-beff-dc68d36e36bc';

-- Deal 6 (D6): missing "Small Fries"
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Small Fries', target_variant_name = 'Small'
WHERE id = 'fc6e10a6-1500-4ae5-adbe-c8466b1145c7';

-- Deal 10 (D10): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '0e1451a5-baa1-411d-be22-e8af1cfe53cf';

-- Deal 12 (D12): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '40b03863-e707-445d-8a57-c88c48648a2d';

-- Deal 15 (D15): missing "Large Chicken Cheese Pasta" (qty already = 2)
UPDATE deal_components SET product_id = '0859359f-f54e-48d1-8b54-52af6a8d1971', name = 'L Chicken Cheese Pasta'
WHERE id = 'e9e7e480-4b6f-49f0-8117-8962dbd64bcf';

-- Deal 16 (D16): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '423b743c-fe0b-4079-8199-e497b92d22e0';

-- Deal 17 (D17): missing "Small Fries" and "500ml Drink"
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Small Fries', target_variant_name = 'Small'
WHERE id = '76f56909-a040-4a00-84bb-7300435fe16e';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'be014a10-845a-431d-89ca-178aa7addc2d';

-- Deal 19 (D19): missing "Small Fries" and "500ml Drink"
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Small Fries', target_variant_name = 'Small'
WHERE id = '864cce30-9ccc-4a55-b71e-f77557b0b655';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '874c800b-11e8-4155-b26a-171fef4f2bfb';

-- Deal 20 (D20): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '28ad0ba9-3e19-4e7d-a201-492a38201e60';

-- Deal 21 (D21): missing "Medium Fries" and "500ml Drink", and fix Patty Burger -> Chicken Patty Burger
UPDATE deal_components SET product_id = '680b0ce3-3db6-413e-b1b2-e4527e18da6e', name = 'Chicken Patty Burger'
WHERE id = '42cfb0df-50ef-44b4-864c-ea6d03cbcafc';
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Medium Fries', target_variant_name = 'Medium'
WHERE id = '433ef126-ea6f-437f-b4ca-dc3b0848a3d9';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '6775df66-9e6c-4e93-ae62-1196aa15c8e0';

-- Deal 22 (D22): missing "Small Fries" and "500ml Drink"
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Small Fries', target_variant_name = 'Small'
WHERE id = '01864e60-77ea-4198-a201-595f3f4548af';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'c3d8498d-ff72-4e91-9717-eb5bb8fb84c9';

-- Deal 23 (D23): missing "Small Fries" and "500ml Drink"
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Small Fries', target_variant_name = 'Small'
WHERE id = 'aa85bf63-50be-4074-8c68-fcb38bb4e28f';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'b615ba71-08f4-4aed-8a17-1e18a0eb0f9d';

-- Deal 24 (D24): missing "Small Fries" (no drink in this deal)
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Small Fries', target_variant_name = 'Small'
WHERE id = '0e28fa4e-9cc6-4c10-9eed-2185cb21d050';

-- Deal 25 (D25): missing "Medium Fries" and "500ml Drink"
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Medium Fries', target_variant_name = 'Medium'
WHERE id = '7275afdd-b44e-4ae7-ab8f-77bc11d8b193';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'c138a364-1e72-4da5-8743-955e46633ea7';

-- Deal 26 (D26): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '0eda5c08-8786-4426-a29d-a89a25af7984';

-- Deal 27 (D27): missing "Loaded Fries" and "500ml Drink"
UPDATE deal_components SET product_id = '4b21f329-8bdf-4a2e-80cf-356cdc349278', name = 'Loaded Fries'
WHERE id = 'a9cf9d55-6636-41ad-a4e9-6134996b9f33';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'b9da96db-888d-4255-91fc-c9d6eecc9901';

-- Deal 30 (D30): missing "Small Fries" and "500ml Drink"
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Small Fries', target_variant_name = 'Small'
WHERE id = 'c71599fb-20da-4bd3-ac2e-82ec5cd8d758';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'f0a0e584-0211-4d66-b83e-3aaa78acfe51';

-- Deal 31 (D31): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'ba109750-b8fa-400b-aa9b-1d2145ce17d7';

-- Deal 32 (D32): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = '8d030d4d-86a1-4435-bf87-b3fcb3a5ff25';

-- Deal 33 (D33): missing "500ml Drink"
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'a6b054f4-5c35-46a8-9d97-abd117d5abec';

-- Deal 34 (D34): missing "Medium Fries" and "500ml Drink"
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Medium Fries', target_variant_name = 'Medium'
WHERE id = 'a02a5141-995f-48d3-9969-cc8c24196c83';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'd847891f-57f0-46ec-b07c-dea327ad7dca';

-- Deal 35 (D35): missing "Large Chicken Cheese Pasta", "Small Fries", "500ml Drink"
UPDATE deal_components SET product_id = '0859359f-f54e-48d1-8b54-52af6a8d1971', name = 'L Chicken Cheese Pasta'
WHERE id = '5ba9e925-5b7a-4069-ad86-87cb740aa6f8';
UPDATE deal_components SET product_id = '67b4d075-5c3e-4128-a1d9-960384569b31', name = 'Small Fries', target_variant_name = 'Small'
WHERE id = '80e42e26-1051-4f16-981e-9a12ec52cf17';
UPDATE deal_components SET product_id = '7369baca-b85f-4f38-a40f-c0353890d718', name = '500 ml Drink'
WHERE id = 'c4d38cb2-594e-49cf-b595-92b941d25a53';

COMMIT;
