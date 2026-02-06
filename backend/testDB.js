const { Client } = require('pg');

const client = new Client({
  connectionString: "link"

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
