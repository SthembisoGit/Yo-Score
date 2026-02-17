const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  let lastCommand = '';

  try {
    console.log('Connecting to database...');
    const test = await client.query('SELECT NOW()');
    console.log('Database connection established');

    const sql = fs.readFileSync(
      path.join(__dirname, '../db/schema.sql'), 
      'utf8'
    );

    console.log('Executing schema creation...');

    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    for (const command of commands) {
      if (command) {
        lastCommand = command;
        try {
          await client.query(command + ';');
        } catch (error) {
          const message = error && error.message ? String(error.message) : 'Unknown migration error';
          if (
            message.includes('already exists') ||
            message.includes('duplicate') ||
            message.includes('does not exist')
          ) {
            console.log(`Skipped: ${command.split(' ')[2] || 'command'} already exists`);
          } else {
            throw error;
          }
        }
      }
    }
    console.log('Migration completed');

    const tables = await client.query(`
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
    const message = error && error.message ? String(error.message) : 'Unknown migration failure';
    console.error('Migration failed:', message);
    if (lastCommand) {
      console.error('Failed command:', lastCommand.slice(0, 220));
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
