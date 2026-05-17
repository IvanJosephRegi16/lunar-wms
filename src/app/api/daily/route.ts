import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { rollForwardStock } from '@/lib/stockEngine';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');
  const db = getDb();

  if (dateStr) {
    const sheet = await db.prepare('SELECT * FROM daily_sheets WHERE sheet_date = ?').get(dateStr);
    const entries = await db.prepare(`
      SELECT 
        ds.*,
        u.full_name as created_by_name
      FROM daily_stock ds
      LEFT JOIN users u ON ds.created_by = u.id
      WHERE ds.sheet_date = ?
      AND (
        ds.inward_stock <> 0 OR 
        ds.outward_stock <> 0 OR 
        ds.machine_return_stock <> 0 OR 
        ds.semi_finished_stock <> 0 OR
        (ds.sheet_date = '2026-05-01' AND ds.opening_stock <> 0)
      )
      ORDER BY ds.id ASC
    `).all(dateStr);

    return NextResponse.json({ sheet: sheet || { status: 'open' }, entries });
  }

  // Monthly summary
  const sheets = await db.prepare(`
    SELECT ds.sheet_date, ds.status, 
           COUNT(d.id) as entry_count, 
           SUM(d.inward_stock) as total_pairs,
           SUM(d.total_available) as sum_available,
           SUM(d.inward_stock) as sum_inward,
           SUM(d.outward_stock) as sum_outward,
           SUM(d.closing_stock) as sum_closing
    FROM daily_sheets ds
    LEFT JOIN daily_stock d ON ds.sheet_date = d.sheet_date
    GROUP BY ds.sheet_date
    ORDER BY ds.sheet_date ASC
  `).all();

  return NextResponse.json({ sheets });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 
    sheet_date, article_code, colour, size, 
    opening_stock, inward_stock, outward_stock, 
    machine_return_stock, semi_finished_stock, remarks,
    forceSave, isEditing 
  } = await req.json();
  
  const db = getDb();

  const sheet = await db.prepare('SELECT status FROM daily_sheets WHERE sheet_date = ?').get(sheet_date) as any;
  if (sheet && sheet.status === 'locked' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Sheet is locked.' }, { status: 403 });
  }

  // Same-Day Duplicate Check (Article + Color) - ONLY for the current date!
  if (!forceSave && !isEditing) {
    const duplicateExists = await db.prepare(`
      SELECT id FROM daily_stock 
      WHERE sheet_date = ? AND article_code = ? AND colour = ?
    `).get(sheet_date, article_code, colour);

    if (duplicateExists) {
      return NextResponse.json({ 
        warning: true, 
        message: 'This article and color already exists for this date. Please check before saving.' 
      }, { status: 409 });
    }
  }

  // Default opening stock is the one provided (useful for May 1)
  let finalOpeningStock = Number(opening_stock || 0);

  // Dynamic Lookup: Only if NOT May 1 and NOT editing (which would overwrite manually)
  if (sheet_date !== '2026-05-01') {
    const lastTransaction = await db.prepare(`
      SELECT closing_stock FROM daily_stock 
      WHERE article_code = ? AND colour = ? AND size = ? AND sheet_date < ?
      ORDER BY sheet_date DESC LIMIT 1
    `).get(article_code, colour, size, sheet_date) as any;

    if (lastTransaction) {
      finalOpeningStock = lastTransaction.closing_stock || 0;
    }
  }

  // Check if this specific size entry already exists
  const existing = await db.prepare(`
    SELECT * FROM daily_stock 
    WHERE sheet_date = ? AND article_code = ? AND colour = ? AND size = ?
  `).get(sheet_date, article_code, colour, size) as any;

  if (existing) {
    // Normal Update
    await db.prepare(`
      UPDATE daily_stock
      SET 
        opening_stock = ?, inward_stock = ?, outward_stock = ?, 
        machine_return_stock = ?, semi_finished_stock = ?, remarks = ?,
        is_duplicate = ?,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalOpeningStock, Number(inward_stock||0), Number(outward_stock||0), Number(machine_return_stock||0), Number(semi_finished_stock||0), remarks || null, forceSave ? 1 : 0, user.id, existing.id);
  } else {
    // New Entry
    await db.prepare(`
      INSERT INTO daily_stock (sheet_date, article_code, colour, size, opening_stock, inward_stock, outward_stock, machine_return_stock, semi_finished_stock, remarks, is_duplicate, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sheet_date, article_code, colour, size, finalOpeningStock, Number(inward_stock||0), Number(outward_stock||0), Number(machine_return_stock||0), Number(semi_finished_stock||0), remarks || null, forceSave ? 1 : 0, user.id);
  }

  // Roll it forward down the calendar
  await rollForwardStock(article_code, colour, size, sheet_date);

  await logAudit({ userId: user.id, username: user.username, action: 'SAVE_STOCK', module: 'daily_stock', description: `Saved stock for ${article_code} ${colour} Size-${size} on ${sheet_date}` });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const article_code = searchParams.get('article_code');
  const colour = searchParams.get('colour');
  const date = searchParams.get('date');
  const isGlobal = searchParams.get('global') === 'true';
  
  const db = getDb();

  if (id) {
    // Single row deletion (legacy support)
    const entry = await db.prepare('SELECT * FROM daily_stock WHERE id = ?').get(id) as any;
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const sheet = await db.prepare('SELECT status FROM daily_sheets WHERE sheet_date = ?').get(entry.sheet_date) as any;
    if (sheet && sheet.status === 'locked' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Sheet is locked.' }, { status: 403 });
    }

    await db.prepare('DELETE FROM daily_stock WHERE id = ?').run(id);
    await rollForwardStock(entry.article_code, entry.colour, entry.size, entry.sheet_date);
    await logAudit({ userId: user.id, username: user.username, action: 'DELETE_STOCK', module: 'daily_stock', description: `Deleted stock entry ${entry.article_code} ${entry.colour} Size-${entry.size} on ${entry.sheet_date}` });
    return NextResponse.json({ success: true });
  }

  if (article_code && colour) {
    if (isGlobal) {
      // GLOBAL DELETION: Remove from ALL dates and ALL modules
      if (user.role !== 'admin') return NextResponse.json({ error: 'Only admin can perform global deletion' }, { status: 403 });

      await db.transaction(async () => {
        const sizes = await db.prepare('SELECT DISTINCT size FROM daily_stock WHERE article_code = ? AND colour = ?').all(article_code, colour) as any[];
        
        await db.prepare('DELETE FROM daily_stock WHERE article_code = ? AND colour = ?').run(article_code, colour);
        await db.prepare('DELETE FROM v_strap WHERE article_code = ? AND colour = ?').run(article_code, colour);
      });

      await logAudit({ userId: user.id, username: user.username, action: 'GLOBAL_DELETE', module: 'system', description: `Global deletion of article: ${article_code} [${colour}]` });
      return NextResponse.json({ success: true, message: 'Article deleted globally from all records.' });
    } else if (date) {
      // BATCH DELETION: Remove all sizes for an article on a specific date
      const sheet = await db.prepare('SELECT status FROM daily_sheets WHERE sheet_date = ?').get(date) as any;
      if (sheet && sheet.status === 'locked' && user.role !== 'admin') {
        return NextResponse.json({ error: 'Sheet is locked.' }, { status: 403 });
      }

      const affectedSizes = await db.prepare('SELECT size FROM daily_stock WHERE sheet_date = ? AND article_code = ? AND colour = ?').all(date, article_code, colour) as any[];
      
      await db.transaction(async () => {
        await db.prepare('DELETE FROM daily_stock WHERE sheet_date = ? AND article_code = ? AND colour = ?').run(date, article_code, colour);
        for (const s of affectedSizes) {
          await rollForwardStock(article_code, colour, s.size, date);
        }
      });

      await logAudit({ userId: user.id, username: user.username, action: 'DELETE_ARTICLE_DATE', module: 'daily_stock', description: `Deleted article ${article_code} [${colour}] from date ${date}` });
      return NextResponse.json({ success: true });
    }
  }

  return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
}
