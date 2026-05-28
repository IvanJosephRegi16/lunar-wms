const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar' });

pool.query("ALTER TABLE purchase_orders ADD COLUMN remarks TEXT DEFAULT ''")
  .then(() => {
    console.log('Column added successfully');
    pool.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    pool.end();
  });
