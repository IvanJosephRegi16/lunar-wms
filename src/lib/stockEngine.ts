import { getDb } from './db';

// Rolls forward stock balances for a given Article + Colour + Size
// starting from a specific date up to May 31
export async function rollForwardStock(article_code: string, colour: string, size: string, startDate: string) {
  const db = getDb();
  
  const days = Array.from({ length: 31 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`);
  const startIndex = days.indexOf(startDate);
  if (startIndex === -1) return;

  for (let i = startIndex; i < days.length - 1; i++) {
    const currentDay = days[i];
    const nextDay = days[i + 1];

    const currentEntry = await db.prepare(`
      SELECT closing_stock FROM daily_stock 
      WHERE sheet_date = ? AND article_code = ? AND colour = ? AND size = ?
    `).get(currentDay, article_code, colour, size) as any;

    const carriedStock = currentEntry ? currentEntry.closing_stock || 0 : 0;

    const nextEntry = await db.prepare(`
      SELECT id FROM daily_stock 
      WHERE sheet_date = ? AND article_code = ? AND colour = ? AND size = ?
    `).get(nextDay, article_code, colour, size) as any;

    if (nextEntry) {
      await db.prepare(`
        UPDATE daily_stock SET opening_stock = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(carriedStock, nextEntry.id);
    } 
    // Sparse logic: If no nextEntry, we don't create one. 
    // The next time the user tries to add this article on a future day, 
    // the POST handler will look up the opening stock at that moment.
  }
}

// Recalculates EVERYTHING just in case (e.g. after manual DB tweaks)
// Usage: run this during initial seed or full validation.
export async function recalculateAllStock() {
  const db = getDb();
  const combinations = await db.prepare(`
    SELECT DISTINCT article_code, colour, size FROM daily_stock
  `).all() as any[];

  for (const c of combinations) {
    await rollForwardStock(c.article_code, c.colour, c.size, '2026-05-01');
  }
}
