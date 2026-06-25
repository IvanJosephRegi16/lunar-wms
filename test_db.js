const db = require('better-sqlite3')('src/lib/database.sqlite');
try {
  console.log(db.prepare(`
      SELECT po.*,
             u.full_name as creator_name,
             u.role as creator_role,
             COALESCE(SUBSTR(u.full_name, 1, INSTR(u.full_name || ' ', ' ') - 1), u.full_name) as creator_first_name
      FROM purchase_orders po
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.is_deleted = 0
      ORDER BY po.id DESC
      LIMIT 1;
  `).all());
} catch(e) {
  console.error(e);
}
