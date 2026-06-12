const { pgPool } = require('./src/lib/db');
async function addCategory() {
  const client = await pgPool.connect();
  try {
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT ''`);
    console.log('Category column added successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}
addCategory();
