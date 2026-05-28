const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function debug() {
  const c = new Client({ connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar' });
  await c.connect();

  // Check admin user
  const res = await c.query("SELECT id, username, password_hash, plain_password, role, is_active FROM users WHERE username = 'admin'");
  const user = res.rows[0];
  console.log('Admin user in PG:', JSON.stringify(user, null, 2));

  // Test bcrypt comparison
  const testPassword = 'admin123';
  const match = await bcrypt.compare(testPassword, user.password_hash);
  console.log(`\nbcrypt.compare("${testPassword}", hash) = ${match}`);

  if (!match) {
    // Re-hash and update
    const newHash = await bcrypt.hash(testPassword, 10);
    console.log('\nGenerating fresh hash...');
    await c.query('UPDATE users SET password_hash = $1 WHERE username = $2', [newHash, 'admin']);
    console.log('Updated admin password hash in PostgreSQL.');

    // Verify
    const verify = await bcrypt.compare(testPassword, newHash);
    console.log(`Verification: bcrypt.compare("${testPassword}", newHash) = ${verify}`);
  }

  // Also fix ALL users that were synced from SQLite
  const allUsers = await c.query('SELECT id, username, plain_password, password_hash FROM users');
  for (const u of allUsers.rows) {
    if (u.username === 'admin') continue; // already fixed above
    if (u.plain_password) {
      const m = await bcrypt.compare(u.plain_password, u.password_hash);
      if (!m) {
        const h = await bcrypt.hash(u.plain_password, 10);
        await c.query('UPDATE users SET password_hash = $1 WHERE id = $2', [h, u.id]);
        console.log(`Fixed hash for user "${u.username}" (password: ${u.plain_password})`);
      } else {
        console.log(`User "${u.username}" hash OK`);
      }
    }
  }

  await c.end();
  console.log('\nDone!');
}

debug().catch(e => { console.error(e); process.exit(1); });
