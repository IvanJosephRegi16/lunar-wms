const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://postgres:ivan@localhost:5432/Lunar" });

async function check() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'intake_barcode_pool';
  `);
  console.log(res.rows);
  const rows = await pool.query(`SELECT COUNT(*) FROM intake_barcode_pool;`);
  console.log('Total count:', rows.rows[0]);
  
  // also check if any barcode from 3 hours ago exists
  const oldScans = await pool.query(`
    SELECT * FROM intake_barcode_pool
    ORDER BY created_at ASC
    LIMIT 5;
  `);
  console.log('Oldest scans:', oldScans.rows);
  process.exit(0);
}
check();
