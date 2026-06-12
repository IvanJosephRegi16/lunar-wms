const { Client } = require('pg');

async function run() {
  const lunarClient = new Client({
    connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar'
  });

  try {
    await lunarClient.connect();
    await lunarClient.query('ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_material_code_key');
    console.log('Successfully dropped materials_material_code_key constraint');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await lunarClient.end();
  }
}

run();
