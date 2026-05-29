import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

const DEFAULT_MENU_VISIBILITY = {
  dashboard: true,
  users_management: true,
  scanning_intake: false,
  manual_entry: false,
  inventory_pool: true,
  carton_generation: false,
  packed_inventory: true,
  scan_history: true,
  daily_activity: false,
  live_inventory: false,
  stock_movement: false,
  v_strap_entry: false,
  reports_sheets: false,
  po_section: false,
  po_dashboard: true,
  po_create: false,
  po_pending: true,
  po_returned: true,
  po_approved: true,
  po_rejected: true,
  po_accountant: true,
  po_completed: true,
  po_history: true,
  po_payment_status: true
};

export async function GET() {
  try {
    const db = getDb();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const configKey = `menu_visibility_config_${user.role}`;
    let configRow = await db.prepare('SELECT value FROM system_settings WHERE "key" = ?').get(configKey) as { value: string } | undefined;

    // Fallback to global config if no role-specific configuration has been saved yet
    if (!configRow) {
      configRow = await db.prepare('SELECT value FROM system_settings WHERE "key" = ?').get('menu_visibility_config') as { value: string } | undefined;
    }

    let menuVisibility = DEFAULT_MENU_VISIBILITY;
    if (configRow) {
      try {
        menuVisibility = { ...DEFAULT_MENU_VISIBILITY, ...JSON.parse(configRow.value) };
      } catch {
        // use default
      }
    }

    return NextResponse.json({ user, menuVisibility });
  } catch (error: any) {
    console.error('Error in me API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
