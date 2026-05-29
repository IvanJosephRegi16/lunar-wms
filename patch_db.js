const fs = require('fs');
const sql = fs.readFileSync('supabase_schema.sql', 'utf8');
let dbTs = fs.readFileSync('src/lib/db.ts', 'utf8');

// Replace the placeholder core tables with the entire supabase schema
dbTs = dbTs.replace(
  /await client\.query\(\`\n      CREATE TABLE IF NOT EXISTS users[\s\S]*?ON CONFLICT \(username\) DO NOTHING;\n    \`\);/,
  'await client.query(`' + sql.replace(/`/g, '\\`') + '`);'
);

fs.writeFileSync('src/lib/db.ts', dbTs);
