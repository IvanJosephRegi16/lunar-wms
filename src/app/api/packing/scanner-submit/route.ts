import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

function generateTransactionId() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PKG-SCN-${year}${month}${day}-${random}`;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { articleCode, colour, configId, scans } = body;

    if (!articleCode || !colour || !configId || !scans || scans.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    const dateStr = new Date().toLocaleDateString('en-CA');
    const transactionId = generateTransactionId();

    const result = await db.transaction(async () => {
      // 1. Determine size distribution from scans
      const sizeDistribution: Record<string, number> = {};
      for (const scan of scans) {
        if (!sizeDistribution[scan.size]) sizeDistribution[scan.size] = 0;
        sizeDistribution[scan.size]++;
      }
      
      const totalPairs = scans.length;

      // 2. Validate stock for all sizes being packed
      for (const [size, qty] of Object.entries(sizeDistribution)) {
        const stockRow = await db.prepare(`
          SELECT id, closing_stock FROM daily_stock 
          WHERE article_code = ? AND colour = ? AND size = ? AND sheet_date <= ?
          ORDER BY sheet_date DESC LIMIT 1
        `).get(articleCode, colour, size, dateStr) as any;

        if (!stockRow || stockRow.closing_stock < (qty as number)) {
          throw new Error(`Insufficient stock for ${articleCode} ${colour} Size ${size}. Available: ${stockRow?.closing_stock || 0}, Required: ${qty}`);
        }
      }

      // 3. Create packing transaction
      const txRes = await db.prepare(`
        INSERT INTO packing_transactions (transaction_id, article_code, colour, config_id, num_cartons, total_pairs, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(transactionId, articleCode, colour, configId, 1, totalPairs, user.id);
      const txId = txRes.lastInsertRowid;

      // 4. Create packing items (size breakdown)
      for (const [size, qty] of Object.entries(sizeDistribution)) {
        await db.prepare(`
          INSERT INTO packing_items (transaction_id, size, quantity_per_carton, total_quantity)
          VALUES (?, ?, ?, ?)
        `).run(txId, size, qty, qty);
      }

      // 5. Deduct Stock
      for (const [size, qty] of Object.entries(sizeDistribution)) {
        const result = await db.prepare(`
          UPDATE daily_stock 
          SET outward_stock = outward_stock + ?,
              closing_stock = closing_stock - ?
          WHERE article_code = ? AND colour = ? AND size = ? AND sheet_date = ?
        `).run(qty, qty, articleCode, colour, size, dateStr);

        // If no row updated for today, we must insert a new row carrying forward yesterday's stock
        if (result.changes === 0) {
           const prevStockRow = await db.prepare(`
             SELECT closing_stock FROM daily_stock 
             WHERE article_code = ? AND colour = ? AND size = ? AND sheet_date < ?
             ORDER BY sheet_date DESC LIMIT 1
           `).get(articleCode, colour, size, dateStr) as any;
           
           const openingStock = prevStockRow ? prevStockRow.closing_stock : 0;
           const newClosing = openingStock - (qty as number);
           await db.prepare(`
             INSERT INTO daily_stock (sheet_date, article_code, colour, size, opening_stock, inward_stock, outward_stock, closing_stock)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           `).run(dateStr, articleCode, colour, size, openingStock, 0, qty, newClosing);
        }
      }

      // 6. Create Carton
      const cartonIdStr = `CRT-${transactionId}-1`;
      await db.prepare(`
        INSERT INTO cartons (carton_id, transaction_id, status)
        VALUES (?, ?, 'completed')
      `).run(cartonIdStr, txId);

      // 7. Log Scans into scan_history
      for (const scan of scans) {
        await db.prepare(`
          INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, carton_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(scan.barcode, articleCode, colour, scan.size, user.id, cartonIdStr);
      }

      return { txId, cartonId: cartonIdStr, transactionId };
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'CREATE',
      module: 'packing_scanning',
      recordId: result.txId as number,
      description: `Scanner created 1 carton (${result.cartonId}) for ${articleCode} ${colour}`
    });

    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('Scanner transaction failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
