import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

function generateTransactionId() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PKG-GEN-${year}${month}${day}-${random}`;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { configId, inventoryId, numberOfCartons } = body;

    if (!configId || !inventoryId || !numberOfCartons || numberOfCartons < 1) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();

    const result = await db.transaction(async () => {
      // 1. Fetch config and sizes
      const config = await db.prepare(`SELECT * FROM carton_generation WHERE id = ?`).get(configId) as any;
      if (!config) throw new Error('Configuration not found');

      const configSizes = await db.prepare(`SELECT size, quantity FROM carton_generation_sizes WHERE config_id = ?`).all(configId) as any[];

      // 2. Fetch inventory pool
      const aggInv = await db.prepare(`SELECT * FROM inventory_pool WHERE id = ?`).get(inventoryId) as any;
      if (!aggInv) throw new Error('Inventory pool not found');

      // 3. Validate stock for generation
      const totalPairsPerCarton = config.total_pairs;
      const totalPairsToDeduct = totalPairsPerCarton * numberOfCartons;

      for (const cs of configSizes) {
        const requiredQty = cs.quantity * numberOfCartons;
        const availableQty = aggInv[`size_${cs.size}`] || 0;
        
        if (availableQty < requiredQty) {
          throw new Error(`Insufficient pooled inventory for Size ${cs.size}. Required: ${requiredQty}, Available: ${availableQty}`);
        }
      }

      // 4. Deduct from inventory pool
      let updateSet = [];
      let params = [];
      for (const cs of configSizes) {
        updateSet.push(`size_${cs.size} = size_${cs.size} - ?`);
        params.push(cs.quantity * numberOfCartons);
      }
      updateSet.push(`total_qty = total_qty - ?`);
      params.push(totalPairsToDeduct);

      params.push(inventoryId);

      const updateQuery = `
        UPDATE inventory_pool 
        SET ${updateSet.join(', ')}
        WHERE id = ?
      `;
      await db.prepare(updateQuery).run(...params);

      // 5. Create Outward Transaction
      const transactionId = generateTransactionId();
      const txRes = await db.prepare(`
        INSERT INTO outward_transactions (transaction_id, article_code, colour, config_id, num_cartons, total_pairs, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(transactionId, aggInv.article_code, aggInv.colour, configId, numberOfCartons, totalPairsToDeduct, user.id);
      const txId = txRes.lastInsertRowid;

      // 6. Create Outward Items
      for (const cs of configSizes) {
        await db.prepare(`
          INSERT INTO outward_items (transaction_id, size, quantity_per_carton, total_quantity)
          VALUES (?, ?, ?, ?)
        `).run(txId, cs.size, cs.quantity, cs.quantity * numberOfCartons);
      }

      // 7. Create Packed Cartons
      const generatedCartons = [];
      for (let i = 1; i <= numberOfCartons; i++) {
        const cartonIdStr = `CRT-${transactionId}-${i}`;
        await db.prepare(`
          INSERT INTO packed_cartons (carton_id, transaction_id, status)
          VALUES (?, ?, 'completed')
        `).run(cartonIdStr, txId);
        generatedCartons.push(cartonIdStr);
      }

      return { txId, transactionId, generatedCartons, article: aggInv.article_code, colour: aggInv.colour };
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'CREATE',
      module: 'carton_generation',
      recordId: result.txId as number,
      description: `Generated ${numberOfCartons} cartons using pool stock for ${result.article} ${result.colour}`
    });

    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('Carton Generation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
