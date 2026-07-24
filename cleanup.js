const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ivan@localhost:5432/Lunar'
});

async function runCleanup() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Starting cleanup for data BEFORE 2026-07-24 00:00:00 IST...");

    // Determine the cutoff timestamp
    const cutoff = "2026-07-24 00:00:00+05:30";

    // 1. Delete from scan_history
    let res = await client.query(`DELETE FROM scan_history WHERE created_at < $1`, [cutoff]);
    console.log(`Deleted ${res.rowCount} rows from scan_history`);

    // 2. Delete from intake_barcode_pool
    res = await client.query(`DELETE FROM intake_barcode_pool WHERE created_at < $1`, [cutoff]);
    console.log(`Deleted ${res.rowCount} rows from intake_barcode_pool`);

    // 3. Delete from inward_inventory_transactions
    res = await client.query(`DELETE FROM inward_inventory_transactions WHERE created_at < $1`, [cutoff]);
    console.log(`Deleted ${res.rowCount} rows from inward_inventory_transactions`);

    // 4. Delete from outward_scan_items (via session join)
    res = await client.query(`
      DELETE FROM outward_scan_items 
      WHERE session_id IN (
        SELECT id FROM outward_scan_sessions WHERE created_at < $1
      )
    `, [cutoff]);
    console.log(`Deleted ${res.rowCount} rows from outward_scan_items`);

    // 5. Delete from outward_scan_sessions
    res = await client.query(`DELETE FROM outward_scan_sessions WHERE created_at < $1`, [cutoff]);
    console.log(`Deleted ${res.rowCount} rows from outward_scan_sessions`);

    // 6. Delete from packed_cartons
    res = await client.query(`DELETE FROM packed_cartons WHERE created_at < $1`, [cutoff]);
    console.log(`Deleted ${res.rowCount} rows from packed_cartons`);

    await client.query("COMMIT");
    console.log("Cleanup successful!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Cleanup failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

runCleanup();
