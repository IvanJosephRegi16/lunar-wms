import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const db = getDb();
    
    // Fetch configurations
    const configs = await db.prepare('SELECT * FROM carton_generation ORDER BY is_custom ASC, id ASC').all() as any[];
    
    // Fetch sizes for all configs
    const sizes = await db.prepare('SELECT * FROM carton_generation_sizes').all() as any[];
    
    // Merge sizes into configs
    const mergedConfigs = configs.map(config => {
      const configSizes = sizes.filter(s => s.config_id === config.id);
      const sizeMap: Record<string, number> = {};
      configSizes.forEach(s => {
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

    if (!name || !total_pairs || !sizes || Object.keys(sizes).length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    
    // Insert new custom config
    const result = await db.transaction(async () => {
      const res = await db.prepare('INSERT INTO carton_generation (name, total_pairs, is_custom) VALUES (?, ?, 1)').run(name, total_pairs);
      const configId = res.lastInsertRowid;
      
      for (const [size, qty] of Object.entries(sizes)) {
         if (typeof qty === 'number' && qty > 0) {
           await db.prepare('INSERT INTO carton_generation_sizes (config_id, size, quantity) VALUES (?, ?, ?)').run(configId, size, qty);
         }
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
    if (error.message?.includes('unique') || error.message?.includes('duplicate key')) {
      return NextResponse.json({ error: 'Configuration name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, name, total_pairs, sizes } = body;

    if (!id || !name || !total_pairs || !sizes || Object.keys(sizes).length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    
    // Update config (allows updating any configuration)
    await db.transaction(async () => {
      await db.prepare('UPDATE carton_generation SET name = ?, total_pairs = ? WHERE id = ?').run(name, total_pairs, id);
      await db.prepare('DELETE FROM carton_generation_sizes WHERE config_id = ?').run(id);
      
      for (const [size, qty] of Object.entries(sizes)) {
         if (typeof qty === 'number' && qty > 0) {
           await db.prepare('INSERT INTO carton_generation_sizes (config_id, size, quantity) VALUES (?, ?, ?)').run(id, size, qty);
         }
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
    if (error.message?.includes('unique') || error.message?.includes('duplicate key')) {
      return NextResponse.json({ error: 'Configuration name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      await db.prepare('DELETE FROM carton_generation_sizes WHERE config_id = ?').run(id);
      await db.prepare('DELETE FROM carton_generation WHERE id = ?').run(id);
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'DELETE',
      module: 'carton_generation',
      recordId: parseInt(id),
      description: `Deleted carton generation rule with ID: ${id}`
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting custom config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
