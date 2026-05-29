import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDb, logAudit } from '@/lib/db';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();

    if (user.role === 'admin') {
      // Admins get all pending requests
      const requests = await db.prepare(
        "SELECT * FROM sidebar_access_requests WHERE status = 'pending' ORDER BY created_at DESC"
      ).all();
      return NextResponse.json({ requests, pendingCount: requests.length });
    } else {
      // Standard users get their own requests history
      const requests = await db.prepare(
        "SELECT * FROM sidebar_access_requests WHERE user_id = ? ORDER BY created_at DESC"
      ).all(user.id);
      return NextResponse.json({ requests });
    }
  } catch (error: any) {
    console.error('Failed to fetch sidebar access requests:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'request') {
      const { moduleKey, moduleName, reason } = body;
      if (!moduleKey || !moduleName) {
        return NextResponse.json({ error: 'Missing module key or name' }, { status: 400 });
      }

      // Avoid duplicate pending requests
      const existing = await db.prepare(
        "SELECT id FROM sidebar_access_requests WHERE user_id = ? AND module_key = ? AND status = 'pending'"
      ).get(user.id, moduleKey);

      if (existing) {
        return NextResponse.json({ error: 'You already have a pending request for this module.' }, { status: 400 });
      }

      // Create new request
      await db.prepare(
        `INSERT INTO sidebar_access_requests (user_id, username, role, module_key, module_name, reason) 
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(user.id, user.username, user.role, moduleKey, moduleName, reason || null);

      // Log Audit Log
      await logAudit({
        userId: user.id,
        username: user.username,
        action: 'ACCESS_REQUEST_SUBMIT',
        module: 'Administration',
        description: `Requested access to module: ${moduleName} (${moduleKey}). Reason: ${reason || 'None'}`
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'process') {
      // Admin processing of request
      if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Admins only.' }, { status: 403 });
      }

      const { requestId, status } = body;
      if (!requestId || !['approved', 'rejected'].includes(status)) {
        return NextResponse.json({ error: 'Invalid request ID or status' }, { status: 400 });
      }

      const requestRow = await db.prepare(
        "SELECT * FROM sidebar_access_requests WHERE id = ?"
      ).get(requestId) as any;

      if (!requestRow) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (requestRow.status !== 'pending') {
        return NextResponse.json({ error: 'Request has already been processed.' }, { status: 400 });
      }

      if (status === 'approved') {
        // Retrieve and mutate target role permission visibility config
        const configKey = `menu_visibility_config_${requestRow.role}`;
        let configRow = await db.prepare(
          "SELECT value FROM system_settings WHERE \"key\" = ?"
        ).get(configKey) as { value: string } | undefined;

        // Fallback check to generic menu_visibility_config if role specific hasn't been set
        if (!configRow) {
          configRow = await db.prepare(
            "SELECT value FROM system_settings WHERE \"key\" = 'menu_visibility_config'"
          ).get() as { value: string } | undefined;
        }

        let currentConfig: any = {};
        if (configRow) {
          try {
            currentConfig = JSON.parse(configRow.value);
          } catch {}
        }

        // Enable access to the target module key
        currentConfig[requestRow.module_key] = true;

        // Write configuration back to SQLite
        await db.prepare(
          "INSERT INTO system_settings (\"key\", value) VALUES (?, ?) ON CONFLICT (\"key\") DO UPDATE SET value = EXCLUDED.value"
        ).run(configKey, JSON.stringify(currentConfig));

        // Update request row status in database
        await db.prepare(
          `UPDATE sidebar_access_requests 
           SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = ?, is_notified_user = 0 
           WHERE id = ?`
        ).run(user.id, requestId);

        // Register Audit Log
        await logAudit({
          userId: user.id,
          username: user.username,
          action: 'ACCESS_REQUEST_APPROVE',
          module: 'Administration',
          description: `Approved access for role '${requestRow.role}' to module: ${requestRow.module_name} (${requestRow.module_key})`
        });
      } else {
        // Status is 'rejected'
        await db.prepare(
          `UPDATE sidebar_access_requests 
           SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, processed_by = ?, is_notified_user = 0 
           WHERE id = ?`
        ).run(user.id, requestId);

        // Register Audit Log
        await logAudit({
          userId: user.id,
          username: user.username,
          action: 'ACCESS_REQUEST_REJECT',
          module: 'Administration',
          description: `Rejected access for role '${requestRow.role}' to module: ${requestRow.module_name} (${requestRow.module_key})`
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to process sidebar access request:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
