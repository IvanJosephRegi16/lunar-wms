import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Restrict to Admin, PM, or Supervisor
    if (user.role !== 'admin' && user.role !== 'pm' && user.role !== 'supervisor') {
      return NextResponse.json({ error: 'Only administrators, managers, or supervisors can reset inventory.' }, { status: 403 });
    }

    const { confirm } = await req.json();
    if (confirm !== 'RESET_INVENTORY') {
      return NextResponse.json({ error: 'Invalid confirmation token' }, { status: 400 });
    }

    const db = getDb();

    // Delete all records in inventory pool and associated intake tracking
    await db.prepare('DELETE FROM inventory_pool').run();
    await db.prepare('DELETE FROM intake_barcode_pool').run();
    await db.prepare('DELETE FROM inward_inventory_transactions').run();

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'INVENTORY_POOL_RESET',
      module: 'inventory_pool',
      description: 'User permanently reset the entire scanning inventory staging pool back to zero.'
    });

    return NextResponse.json({
      success: true,
      message: 'Inventory pool has been successfully reset to zero.'
    });

  } catch (error: any) {
    console.error('Inventory Reset failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
