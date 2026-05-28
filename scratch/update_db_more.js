const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar' });

async function updateDb() {
  try {
    await pool.query("ALTER TABLE purchase_orders ADD COLUMN approved_at_date TEXT");
    console.log('Added approved_at_date');
  } catch(e) { console.log('approved_at_date error: ' + e.message); }

  try {
    await pool.query("ALTER TABLE purchase_orders ADD COLUMN approved_at_time TEXT");
    console.log('Added approved_at_time');
  } catch(e) { console.log('approved_at_time error: ' + e.message); }

  try {
    await pool.query("ALTER TABLE purchase_orders ADD COLUMN correction_notes TEXT");
    console.log('Added correction_notes');
  } catch(e) { console.log('correction_notes error: ' + e.message); }

  pool.end();
}

updateDb();
