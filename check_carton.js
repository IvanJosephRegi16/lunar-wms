const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ivan@localhost:5432/Lunar'
});

async function run() {
  try {
    // Check actual columns
    const colRes = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'carton_generation' 
      ORDER BY ordinal_position
    `);
    console.log('=== COLUMNS ===');
    console.log(JSON.stringify(colRes.rows, null, 2));

    // Check recent rows
    const rowRes = await pool.query(`SELECT * FROM carton_generation ORDER BY id DESC LIMIT 10`);
    console.log('=== ROWS ===');
    console.log(JSON.stringify(rowRes.rows, null, 2));

    // Check sizes
    const sizeRes = await pool.query(`SELECT * FROM carton_generation_sizes ORDER BY config_id DESC LIMIT 20`);
    console.log('=== SIZES ===');
    console.log(JSON.stringify(sizeRes.rows, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
run();
