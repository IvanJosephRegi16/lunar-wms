import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const db = getDb();
    
    // Fetch configurations (exclude soft-deleted)
    const configs = await db.prepare('SELECT * FROM carton_generation WHERE is_deleted = 0 ORDER BY is_custom ASC, id ASC').all() as any[];
    
    // Fetch sizes for all configs
    const sizes = await db.prepare('SELECT * FROM carton_generation_sizes').all() as any[];
    
    // Merge sizes into configs
    const mergedConfigs = configs.map((config: any) => {
      const configSizes = sizes.filter((s: any) => s.config_id === config.id);
      const sizeMap: Record<string, number> = {};
      configSizes.forEach((s: any) => {
        sizeMap[s.size] = s.quantity;
      });
      return {
        ...config,
        sizes: sizeMap
      };
    });

    return NextResponse.json({ configs: mergedConfigs });
  } catch (error: any) {
    console.error('Error fetching packing configs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, total_pairs, sizes } = body;

    if (!name || !sizes || Object.keys(sizes).length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Coerce sizes to numbers (frontend may send strings from input)
    const numericSizes: Record<string, number> = {};
    let computedTotal = 0;
    for (const [size, qty] of Object.entries(sizes)) {
      const n = Number(qty) || 0;
      if (n > 0) {
        numericSizes[size] = n;
        computedTotal += n;
      }
    }

    if (computedTotal <= 0) {
      return NextResponse.json({ error: 'A Carton Configuration Rule must contain at least 1 pair.' }, { status: 400 });
    }

    const finalTotalPairs = Number(total_pairs) || computedTotal;

    // Use getDb() INSIDE the transaction callback so it picks up the transaction client via AsyncLocalStorage
    const db = getDb();
    const result = await db.transaction(async () => {
      const txDb = getDb(); // resolves to transaction adapter inside asyncLocalStorage.run()
      const res = await txDb.prepare('INSERT INTO carton_generation (name, total_pairs, is_custom) VALUES (?, ?, 1)').run(name, finalTotalPairs);
      const configId = res.lastInsertRowid;

      if (!configId) {
        throw new Error('Failed to obtain new config ID after INSERT');
      }

      for (const [size, qty] of Object.entries(numericSizes)) {
        await txDb.prepare('INSERT INTO carton_generation_sizes (config_id, size, quantity) VALUES (?, ?, ?)').run(configId, size, qty);
      }
      return configId;
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'CREATE',
      module: 'carton_generation',
      recordId: result as number,
      description: `Created custom carton generation rule: ${name}`
    });

    return NextResponse.json({ success: true, configId: result });
  } catch (error: any) {
    console.error('Error creating custom config:', error);
    if (error.message?.includes('unique') || error.message?.includes('duplicate key') || error.message?.includes('Configuration name')) {
      return NextResponse.json({ error: 'A configuration rule with this name already exists. Please use a different name.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, name, sizes } = body;

    if (!id || !name || !sizes || Object.keys(sizes).length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Coerce sizes to numbers
    const numericSizes: Record<string, number> = {};
    let computedTotal = 0;
    for (const [size, qty] of Object.entries(sizes)) {
      const n = Number(qty) || 0;
      if (n > 0) {
        numericSizes[size] = n;
        computedTotal += n;
      }
    }

    if (computedTotal <= 0) {
      return NextResponse.json({ error: 'A Carton Configuration Rule must contain at least 1 pair.' }, { status: 400 });
    }

    const db = getDb();
    await db.transaction(async () => {
      const txDb = getDb();
      await txDb.prepare('UPDATE carton_generation SET name = ?, total_pairs = ? WHERE id = ?').run(name, computedTotal, id);
      await txDb.prepare('DELETE FROM carton_generation_sizes WHERE config_id = ?').run(id);
      
      for (const [size, qty] of Object.entries(numericSizes)) {
        await txDb.prepare('INSERT INTO carton_generation_sizes (config_id, size, quantity) VALUES (?, ?, ?)').run(id, size, qty);
      }
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'UPDATE',
      module: 'carton_generation',
      recordId: parseInt(id),
      description: `Updated carton generation rule: ${name}`
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating custom config:', error);
    const msg = error.message || '';
    if (msg.includes('unique') || msg.includes('duplicate key')) {
      return NextResponse.json({ error: 'Configuration name already exists. Please use a different name.' }, { status: 400 });
    }
    if (msg.includes('foreign key') || msg.includes('violates')) {
      return NextResponse.json({ error: 'This rule is actively used by existing packed cartons and cannot be modified. Please create a new rule instead.' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing configuration ID' }, { status: 400 });
    }

    const db = getDb();
    await db.transaction(async () => {
      const txDb = getDb();
      // Soft-delete the configuration to preserve history for already-packed cartons
      await txDb.prepare('UPDATE carton_generation SET is_deleted = 1 WHERE id = ?').run(id);
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'DELETE',
      module: 'carton_generation',
      recordId: parseInt(id),
      description: `Soft-deleted carton generation rule with ID: ${id}`
    });

    return NextResponse.json({ success: true, message: 'Rule successfully deleted.' });
  } catch (error: any) {
    console.error('Error deleting custom config:', error);
    return NextResponse.json({ error: error.message || 'Error deleting rule' }, { status: 500 });
  }
}
