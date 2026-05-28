const { Client } = require('pg');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

async function syncUsers() {
  const dbPath = path.join(__dirname, 'data', 'stock.db');
  const sqlite = new DatabaseSync(dbPath);
  const pg = new Client({ connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar' });
  await pg.connect();

  // Get all users from SQLite
  const users = sqlite.prepare('SELECT * FROM users').all();
  console.log(`Found ${users.length} users in SQLite to sync to PostgreSQL.\n`);

  for (const u of users) {
    try {
      // Check if user already exists in PG
      const existing = await pg.query('SELECT id FROM users WHERE username = $1', [u.username]);
      if (existing.rows.length > 0) {
        console.log(`  ⏭️  User "${u.username}" already exists in PostgreSQL (id: ${existing.rows[0].id})`);
        continue;
      }

      await pg.query(
        `INSERT INTO users (username, password_hash, full_name, role, phone, plain_password, is_active, last_login, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (username) DO NOTHING`,
        [u.username, u.password_hash, u.full_name, u.role, u.phone, u.plain_password, u.is_active, u.last_login, u.created_at]
      );
      console.log(`  ✅ Synced user "${u.username}" (${u.role})`);
    } catch (err) {
      console.error(`  ❌ Failed to sync "${u.username}":`, err.message);
    }
  }

  // Also sync system_settings
  try {
    const settings = sqlite.prepare('SELECT * FROM system_settings').all();
    for (const s of settings) {
      await pg.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [s.key, s.value]
      );
    }
    console.log(`\n  ✅ Synced ${settings.length} system settings`);
  } catch (e) {
    console.log('  ⏭️  No system_settings to sync');
  }

  // Verify
  const pgUsers = await pg.query('SELECT id, username, role, is_active FROM users ORDER BY id');
  console.log('\n=== PostgreSQL Users ===');
  pgUsers.rows.forEach(r => console.log(`  id:${r.id} | ${r.username} | ${r.role} | active:${r.is_active}`));

  sqlite.close();
  await pg.end();
  console.log('\n✅ User sync complete!');
}

syncUsers().catch(err => { console.error('Sync failed:', err); process.exit(1); });
