const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:ivan@localhost:5432/Lunar' });
client.connect().then(() => 
  client.query(`INSERT INTO system_settings ("key", value, updated_at, updated_by) VALUES ($1, $2, CURRENT_TIMESTAMP, $3) ON CONFLICT ("key") DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP, updated_by = EXCLUDED.updated_by`, ['test_key', 'test_val', null])
    .then(() => console.log('OK'))
    .catch(console.error)
    .finally(() => client.end())
);
