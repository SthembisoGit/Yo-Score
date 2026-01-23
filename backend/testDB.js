const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres.vllkcrhddpagxioljdpm:zRkRLKJ4QbaxOaaS@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

});

async function test() {
  try {
    await client.connect();
    console.log('Connected to Supabase!');
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version);
    await client.end();
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
}

test();