const Database = require('better-sqlite3');
const db = new Database('C:/Users/Azan/AppData/Roaming/Restaurant POS/storage/database/pos.db', { readonly: true });

const SALE = `(
  o.deleted_at IS NULL
  AND (
    o.lifecycle_state = 'COMPLETED'
    OR (o.lifecycle_state = 'ACTIVE' AND UPPER(COALESCE(o.payment_state, '')) = 'PAID')
  )
)`;

const BUCKET = `
  CASE
    WHEN d.id IS NOT NULL THEN 'Deals'
    WHEN LOWER(COALESCE(c1.name, '')) LIKE '%soda%' THEN 'Soda Bar'
    WHEN LOWER(COALESCE(c1.name, '')) LIKE '%chip%'
      OR LOWER(COALESCE(c1.name, '')) LIKE '%fries%'
      OR LOWER(COALESCE(c1.name, '')) LIKE '%potato%' THEN 'Fries'
    WHEN LOWER(COALESCE(c1.name, '')) LIKE '%drink%'
      OR LOWER(COALESCE(c1.name, '')) LIKE '%beverage%'
      OR LOWER(COALESCE(c1.name, '')) LIKE '%juice%'
      OR LOWER(COALESCE(c1.name, '')) LIKE '%shake%'
      OR LOWER(COALESCE(c1.name, '')) LIKE '%limka%'
      OR LOWER(COALESCE(c1.name, '')) LIKE '%limca%' THEN 'Drinks'
    WHEN LOWER(COALESCE(c2.name, c1.name, '')) LIKE '%fast food%' THEN 'Fast Food'
    WHEN LOWER(COALESCE(c2.name, c1.name, '')) LIKE '%restaurant%' THEN 'Restaurant'
    ELSE 'Other'
  END
`;

const ITEM_NET = `
  (COALESCE(oi.subtotal, 0) - COALESCE(oi.discount_amount, 0)
    - COALESCE(
        (COALESCE(o.discount_total, 0) - COALESCE((
          SELECT SUM(COALESCE(x.discount_amount, 0)) FROM order_items x WHERE x.order_id = o.id
        ), 0))
        * ((COALESCE(oi.subtotal, 0) - COALESCE(oi.discount_amount, 0)) / NULLIF(o.subtotal, 0))
      , 0)
  )
`;

for (const biz of ['2026-09-02', '2026-09-03']) {
  const sale = db.prepare(`SELECT ROUND(SUM(subtotal-discount_total),2) net, ROUND(SUM(grand_total),2) gross, ROUND(SUM(service_charge),2) svc, ROUND(SUM(delivery_fee),2) del FROM orders o WHERE business_date=? AND ${SALE}`).get(biz);
  const cards = db.prepare(`
    SELECT ${BUCKET} as bucket, ROUND(SUM(${ITEM_NET}),2) net
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN deals d ON d.id = oi.product_id
    LEFT JOIN categories c1 ON p.category_id = c1.id
    LEFT JOIN categories c2 ON c1.parent_id = c2.id
    WHERE o.business_date = ? AND ${SALE}
    GROUP BY bucket
  `).all(biz);
  const cardSum = cards.reduce((s, r) => s + (r.net || 0), 0);
  console.log(biz, 'net', sale.net, 'cards', Math.round(cardSum * 100) / 100, 'diff', Math.round((cardSum - sale.net) * 100) / 100);
  console.log(cards);
  console.log('gross check', sale.gross, sale.net + sale.svc + sale.del);
}

db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, name) VALUES ('041', 'repair_order_sale_totals')`);
db.close();
