const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ivan@localhost:5432/Lunar'
});

async function run() {
  try {
    console.log('Adding missing columns to carton_generation...');

    // Add missing columns one by one (IF NOT EXISTS)
    const migrations = [
      `ALTER TABLE carton_generation ADD COLUMN IF NOT EXISTS article_code TEXT`,
      `ALTER TABLE carton_generation ADD COLUMN IF NOT EXISTS colour TEXT`,
      `ALTER TABLE carton_generation ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0`,
      `ALTER TABLE carton_generation ADD COLUMN IF NOT EXISTS created_by INTEGER`,
    ];

    for (const sql of migrations) {
      await pool.query(sql);
      console.log('OK:', sql);
    }

    // Set is_deleted = 0 for any existing rows where it might be NULL
    await pool.query(`UPDATE carton_generation SET is_deleted = 0 WHERE is_deleted IS NULL`);
    console.log('Backfilled is_deleted = 0 for existing rows');

    // Verify
    const colRes = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'carton_generation' ORDER BY ordinal_position
    `);
    console.log('Final columns:', colRes.rows.map(r => r.column_name).join(', '));

    console.log('\nMigration complete!');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
run();
