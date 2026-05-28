import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const db = getDb();
  const users = await db.prepare(`
    SELECT id, username, full_name, role, phone, plain_password, is_active, created_at, last_login
    FROM users ORDER BY id
  `).all();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json();
  const db = getDb();

  const { action } = body;

  if (action === 'create_user') {
    const hash = bcrypt.hashSync(body.password, 10);
    const r = await db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, phone, plain_password) VALUES (?,?,?,?,?,?)
    `).run(body.username, hash, body.full_name, body.role, body.phone || null, body.password);
    await logAudit({ userId: user.id, username: user.username, action: 'CREATE_USER', module: 'admin', description: `Created user: ${body.username}` });
    return NextResponse.json({ success: true, id: r.lastInsertRowid });
  }

  if (action === 'update_user') {
    const updates: string[] = [];
    const vals: any[] = [];
    if (body.username) { updates.push('username=?'); vals.push(body.username); }
    if (body.full_name) { updates.push('full_name=?'); vals.push(body.full_name); }
    if (body.role) { updates.push('role=?'); vals.push(body.role); }
    if (body.phone !== undefined) { updates.push('phone=?'); vals.push(body.phone || null); }
    if (body.is_active !== undefined) { updates.push('is_active=?'); vals.push(body.is_active ? 1 : 0); }
    if (body.password) { 
      updates.push('password_hash=?'); 
      vals.push(bcrypt.hashSync(body.password, 10)); 
      updates.push('plain_password=?'); 
      vals.push(body.password); 
    }
    vals.push(body.user_id);
    await db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals);
    await logAudit({ userId: user.id, username: user.username, action: 'UPDATE_USER', module: 'admin', description: `Updated user: ${body.user_id}` });
    return NextResponse.json({ success: true });
  }

  if (action === 'deactivate_user') {
    if (body.user_id === user.id) return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
    await db.prepare('UPDATE users SET is_active=0 WHERE id=?').run(body.user_id);
    await logAudit({ userId: user.id, username: user.username, action: 'DEACTIVATE_USER', module: 'admin', description: `Deactivated user: ${body.user_id}` });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_user') {
    if (body.user_id === user.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    try {
      // Temporarily disable foreign key checks to forcefully delete the user
      // This leaves their history (orders, entries) intact but unlinked (orphaned or NULL created_by).
      const db = getDb();
      db.exec('PRAGMA foreign_keys = OFF;');
      
      await db.prepare('DELETE FROM users WHERE id=?').run(body.user_id);
      
      db.exec('PRAGMA foreign_keys = ON;');

      await logAudit({ userId: user.id, username: user.username, action: 'DELETE_USER', module: 'admin', description: `Permanently deleted user: ${body.user_id}` });
      return NextResponse.json({ success: true });
    } catch (e: any) {
      db.exec('PRAGMA foreign_keys = ON;'); // ensure it's turned back on in case of error
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  if (action === 'get_settings') {
    const settings = await db.prepare('SELECT * FROM system_settings').all();
    return NextResponse.json({ settings });
  }

  if (action === 'update_setting') {
    await db.prepare(`INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES (?,?,CURRENT_TIMESTAMP,?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP, updated_by = EXCLUDED.updated_by`).run(body.key, body.value, user.id);
    return NextResponse.json({ success: true });
  }

  if (action === 'get_menu_visibility') {
    const role = body.role || 'operator';
    const configKey = `menu_visibility_config_${role}`;
    let configRow = await db.prepare('SELECT value FROM system_settings WHERE key = ?').get(configKey) as { value: string } | undefined;
    
    // Fallback to global if role-specific is not set yet
    if (!configRow) {
      configRow = await db.prepare('SELECT value FROM system_settings WHERE key = ?').get('menu_visibility_config') as { value: string } | undefined;
    }
    
    return NextResponse.json({ config: configRow ? JSON.parse(configRow.value) : null });
  }

  if (action === 'update_menu_visibility') {
    const role = body.role || 'operator';
    const configKey = `menu_visibility_config_${role}`;
    const valueString = JSON.stringify(body.config);

    // Get previous menu visibility configuration to calculate differences
    const configRow = await db.prepare('SELECT value FROM system_settings WHERE key = ?').get(configKey) as { value: string } | undefined;
    const prevConfig = configRow ? JSON.parse(configRow.value) : {};
    const newConfig = body.config || {};

    const changes: string[] = [];
    const allKeys = Array.from(new Set([...Object.keys(prevConfig), ...Object.keys(newConfig)]));
    for (const key of allKeys) {
      const prevVal = !!prevConfig[key];
      const newVal = !!newConfig[key];
      if (prevVal !== newVal) {
        changes.push(`${key}: ${prevVal ? 'ON' : 'OFF'} ➔ ${newVal ? 'ON' : 'OFF'}`);
      }
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const timestampIST = istTime.toISOString().replace('T', ' ').substring(0, 19) + ' IST';

    const auditDescription = changes.length > 0
      ? `Role "${role.toUpperCase()}" menu config updated. Changes: [${changes.join(', ')}] at ${timestampIST}`
      : `Role "${role.toUpperCase()}" menu config saved (no changes) at ${timestampIST}`;

    await db.prepare(`INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES (?,?,CURRENT_TIMESTAMP,?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP, updated_by = EXCLUDED.updated_by`).run(configKey, valueString, user.id);
    await logAudit({ 
      userId: user.id, 
      username: user.username, 
      action: 'UPDATE_MENU_VISIBILITY', 
      module: 'admin', 
      description: auditDescription 
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'get_login_activity') {
    const activity = await db.prepare('SELECT * FROM login_activity ORDER BY timestamp DESC LIMIT 100').all();
    return NextResponse.json({ activity });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
