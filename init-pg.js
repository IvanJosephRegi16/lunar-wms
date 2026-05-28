const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDb() {
  const defaultClient = new Client({
    connectionString: 'postgresql://postgres:ivan@localhost:5432/postgres'
  });
  
  try {
    await defaultClient.connect();
    const res = await defaultClient.query("SELECT datname FROM pg_database WHERE datname = 'Lunar'");
    if (res.rows.length === 0) {
      console.log('Database "Lunar" does not exist. Creating...');
      await defaultClient.query('CREATE DATABASE "Lunar"');
      console.log('Database created.');
    } else {
      console.log('Database "Lunar" already exists.');
    }
  } catch (err) {
    console.error('Error connecting to default postgres database:', err);
    process.exit(1);
  } finally {
    await defaultClient.end();
  }

  const lunarClient = new Client({
    connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar'
  });

  try {
    await lunarClient.connect();
    console.log('Connected to Lunar. Applying schema...');
    
    const schemaPath = path.join(__dirname, 'supabase-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // PG's client.query can run multiple statements separated by semicolon
    await lunarClient.query(schemaSql);
    
    console.log('Schema applied successfully!');
  } catch (err) {
    console.error('Error applying schema:', err);
    process.exit(1);
  } finally {
    await lunarClient.end();
  }
}

initDb();
