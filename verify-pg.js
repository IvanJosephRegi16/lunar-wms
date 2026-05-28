const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar' });
  await c.connect();

  const tables = await c.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  console.log('=== TABLES IN Lunar DATABASE ===');
  tables.rows.forEach(r => console.log('  -', r.tablename));
  console.log('Total:', tables.rows.length, 'tables\n');

  const users = await c.query('SELECT id, username, role, is_active FROM users');
  console.log('=== USERS ===');
  console.log(JSON.stringify(users.rows, null, 2));

  await c.end();
})();
