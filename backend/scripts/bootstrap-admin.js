require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const name = process.env.ADMIN_BOOTSTRAP_NAME || 'YoScore Admin';
  const resetPassword = String(process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD || 'false').toLowerCase() === 'true';

  if (!email || !password) {
    throw new Error(
      'Missing ADMIN_BOOTSTRAP_EMAIL or ADMIN_BOOTSTRAP_PASSWORD in environment.',
    );
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_URL &&
      !process.env.DATABASE_URL.includes('localhost') &&
      !process.env.DATABASE_URL.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : undefined,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id, role FROM users WHERE email = $1', [email]);

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
      await client.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'admin')`,
        [name, email, hash],
      );
      await client.query('COMMIT');
      console.log(`Created new admin user: ${email}`);
      return;
    }

    const userId = existing.rows[0].id;
    await client.query(`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1`, [userId]);

    if (resetPassword) {
      const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
      await client.query(`UPDATE users SET password = $2, updated_at = NOW() WHERE id = $1`, [
        userId,
        hash,
      ]);
      console.log(`Promoted existing user to admin and reset password: ${email}`);
    } else {
      console.log(`Promoted existing user to admin: ${email}`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
