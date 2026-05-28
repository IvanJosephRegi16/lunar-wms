const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar' });

async function checkAll() {
  // Check purchase_order_items columns
  const res1 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_order_items' ORDER BY ordinal_position");
  console.log('purchase_order_items columns:');
  res1.rows.forEach(r => console.log('  -', r.column_name));

  // Check po_activity_logs columns
  const res2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'po_activity_logs' ORDER BY ordinal_position");
  console.log('\npo_activity_logs columns:');
  res2.rows.forEach(r => console.log('  -', r.column_name));

  pool.end();
}

checkAll();
