import { getDb } from './src/lib/db';
import bcrypt from 'bcryptjs';

async function run() {
  const db = getDb();
  
  // Check current state
  const admin = await db.prepare("SELECT id, username, plain_password, password_hash FROM users WHERE username='admin'").get() as any;
  console.log('Current plain_password:', admin?.plain_password);
  console.log('admin124536 works?', bcrypt.compareSync('admin124536', admin?.password_hash));
  console.log('admin123456 works?', bcrypt.compareSync('admin123456', admin?.password_hash));

  // The Credential Card shows admin124536 as the saved password — sync the hash to it
  const correctPassword = admin.plain_password; // use exactly what is stored as plain_password
  console.log('\nSetting hash to match plain_password:', correctPassword);
  
  const newHash = bcrypt.hashSync(correctPassword, 10);
  await db.prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'").run(newHash);

  // Verify
  const updated = await db.prepare("SELECT plain_password, password_hash FROM users WHERE username='admin'").get() as any;
  console.log('\n✅ Verification:');
  console.log('  plain_password:', updated.plain_password);
  console.log('  login with plain_password works:', bcrypt.compareSync(updated.plain_password, updated.password_hash));
  console.log('  login with admin123 works:', bcrypt.compareSync('admin123', updated.password_hash));
  console.log('  login with admin123456 works:', bcrypt.compareSync('admin123456', updated.password_hash));
  console.log('  login with admin124536 works:', bcrypt.compareSync('admin124536', updated.password_hash));
}

run().catch(err => { console.error(err); process.exit(1); });
