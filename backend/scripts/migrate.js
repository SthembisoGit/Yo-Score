const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to database...');
    
    const test = await pool.query('SELECT NOW()');
    console.log('Database connection established');
    
    const sql = fs.readFileSync(
      path.join(__dirname, '../db/schema.sql'), 
      'utf8'
    );
    
    console.log('Executing schema creation...');
    
    await pool.query(sql);
    
    console.log('Migration completed');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Created tables:');
    tables.rows.forEach(table => {
      console.log(`  ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();