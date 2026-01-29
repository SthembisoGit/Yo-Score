// add-proctoring-columns.js
const { Pool } = require('pg');
require('dotenv').config();

async function addProctoringColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    console.log('Adding proctoring columns to existing tables...');
    
    // 1. Check if proctoring_sessions exists, if not create it
    const sessionsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'proctoring_sessions'
      )
    `);
    
    if (!sessionsExists.rows[0].exists) {
      console.log('Creating proctoring_sessions table...');
      await client.query(`
        CREATE TABLE proctoring_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
          submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
          start_time TIMESTAMP DEFAULT NOW(),
          end_time TIMESTAMP,
          total_violations INTEGER DEFAULT 0,
          total_penalty INTEGER DEFAULT 0,
          status VARCHAR(20) DEFAULT 'active'
        )
      `);
    }
    
    // 2. Check if proctoring_logs exists, if not create it with all columns
    const logsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'proctoring_logs'
      )
    `);
    
    if (!logsExists.rows[0].exists) {
      console.log('Creating proctoring_logs table...');
      await client.query(`
        CREATE TABLE proctoring_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
          violation_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) DEFAULT 'low',
          description TEXT,
          timestamp TIMESTAMP DEFAULT NOW(),
          penalty INTEGER DEFAULT 0,
          confidence FLOAT DEFAULT 1.0,
          evidence_data JSONB
        )
      `);
    } else {
      // Add missing columns to existing proctoring_logs
      const logsColumns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'proctoring_logs'
      `);
      
      const existingColumns = logsColumns.rows.map(row => row.column_name);
      
      if (!existingColumns.includes('session_id')) {
        console.log('Adding session_id column to proctoring_logs...');
        await client.query(`
          ALTER TABLE proctoring_logs 
          ADD COLUMN session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE
        `);
      }
      
      if (!existingColumns.includes('user_id')) {
        console.log('Adding user_id column to proctoring_logs...');
        await client.query(`
          ALTER TABLE proctoring_logs 
          ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE
        `);
      }
      
      if (!existingColumns.includes('severity')) {
        console.log('Adding severity column to proctoring_logs...');
        await client.query(`
          ALTER TABLE proctoring_logs 
          ADD COLUMN severity VARCHAR(20) DEFAULT 'low'
        `);
      }
      
      if (!existingColumns.includes('description')) {
        console.log('Adding description column to proctoring_logs...');
        await client.query(`
          ALTER TABLE proctoring_logs 
          ADD COLUMN description TEXT
        `);
      }
      
      if (!existingColumns.includes('confidence')) {
        console.log('Adding confidence column to proctoring_logs...');
        await client.query(`
          ALTER TABLE proctoring_logs 
          ADD COLUMN confidence FLOAT DEFAULT 1.0
        `);
      }
      
      if (!existingColumns.includes('evidence_data')) {
        console.log('Adding evidence_data column to proctoring_logs...');
        await client.query(`
          ALTER TABLE proctoring_logs 
          ADD COLUMN evidence_data JSONB
        `);
      }
    }
    
    // 3. Create or update ml_analysis_results
    const mlExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ml_analysis_results'
      )
    `);
    
    if (!mlExists.rows[0].exists) {
      console.log('Creating ml_analysis_results table...');
      await client.query(`
        CREATE TABLE ml_analysis_results (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
          analysis_type VARCHAR(50),
          timestamp TIMESTAMP DEFAULT NOW(),
          results JSONB NOT NULL,
          violations_detected INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    }
    
    // 4. Create indexes if they don't exist
    console.log('Creating indexes...');
    
    const indexes = [
      { name: 'idx_proctoring_sessions_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_user_id ON proctoring_sessions(user_id)' },
      { name: 'idx_proctoring_sessions_submission_id', sql: 'CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_submission_id ON proctoring_sessions(submission_id)' },
      { name: 'idx_proctoring_logs_session_id', sql: 'CREATE INDEX IF NOT EXISTS idx_proctoring_logs_session_id ON proctoring_logs(session_id)' },
      { name: 'idx_proctoring_logs_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_proctoring_logs_user_id ON proctoring_logs(user_id)' },
      { name: 'idx_proctoring_logs_submission_id', sql: 'CREATE INDEX IF NOT EXISTS idx_proctoring_logs_submission_id ON proctoring_logs(submission_id)' },
      { name: 'idx_proctoring_logs_timestamp', sql: 'CREATE INDEX IF NOT EXISTS idx_proctoring_logs_timestamp ON proctoring_logs(timestamp)' },
      { name: 'idx_ml_analysis_session_id', sql: 'CREATE INDEX IF NOT EXISTS idx_ml_analysis_session_id ON ml_analysis_results(session_id)' },
      { name: 'idx_ml_analysis_type', sql: 'CREATE INDEX IF NOT EXISTS idx_ml_analysis_type ON ml_analysis_results(analysis_type)' }
    ];
    
    for (const index of indexes) {
      try {
        await client.query(index.sql);
        console.log(`Created index: ${index.name}`);
      } catch (error) {
        console.log(`Index ${index.name} already exists or failed: ${error.message}`);
      }
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Proctoring schema updated successfully!');
    
    // Show summary
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Current tables:');
    tables.rows.forEach(table => {
      console.log(`  ${table.table_name}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addProctoringColumns();