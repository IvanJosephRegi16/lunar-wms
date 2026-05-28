import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { article, color, sizeDetails, totalPairs } = body;

    // Notice we removed configId and numCartons, because Manual Entry is INWARD ONLY now.
    if (!article || !color || !sizeDetails) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    const validSizes = ['5', '6', '7', '8', '9', '10', '11', '12'];

    await db.transaction(async () => {
      // 1. Record Inward Transactions
      for (const detail of sizeDetails) {
        const { size, totalQuantity } = detail;
        if (totalQuantity <= 0) continue;
        await db.prepare(`
          INSERT INTO inward_inventory_transactions (article_code, colour, size, quantity, operator_id, type)
          VALUES (?, ?, ?, ?, ?, 'manual')
        `).run(article, color, size, totalQuantity, user.id);
      }

      // 2. Upsert into Inventory Pool
      const checkAgg = await db.prepare(`SELECT id FROM inventory_pool WHERE article_code = ? AND colour = ?`).get(article, color) as any;
      
      if (checkAgg) {
         let updateSets = [];
         let updateParams = [];
         for (const detail of sizeDetails) {
            if (detail.totalQuantity > 0 && validSizes.includes(detail.size)) {
               updateSets.push(`size_${detail.size} = size_${detail.size} + ?`);
               updateParams.push(detail.totalQuantity);
            }
         }
         updateSets.push(`total_qty = total_qty + ?`);
         updateParams.push(totalPairs);
         updateParams.push(checkAgg.id);

         if (updateSets.length > 1) {
           await db.prepare(`
             UPDATE inventory_pool 
             SET ${updateSets.join(', ')}
             WHERE id = ?
           `).run(...updateParams);
         }
      } else {
         const cols = validSizes.map(s => `size_${s}`);
         const vals = validSizes.map(s => {
           const match = sizeDetails.find((d:any) => d.size === s);
           return match ? match.totalQuantity : 0;
         });
         
         await db.prepare(`
           INSERT INTO inventory_pool (article_code, colour, total_qty, ${cols.join(', ')})
           VALUES (?, ?, ?, ${validSizes.map(() => '?').join(', ')})
         `).run(article, color, totalPairs, ...vals);
      }

      await logAudit({
        userId: user.id,
        username: user.username,
        action: 'INWARD_MANUAL',
        module: 'inventory_pool',
        recordId: 0,
        description: `Manually added ${totalPairs} pairs of ${article} - ${color} into inventory pool`
      });

    });

    return NextResponse.json({ success: true, message: `Successfully added ${totalPairs} loose pairs to the Inventory Pool.` });
  } catch (error: any) {
    console.error('Error processing manual inward:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
