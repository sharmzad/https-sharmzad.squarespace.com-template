const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTestGuide() {
  const client = await pool.connect();
  
  try {
    const email = 'testguide@example.com';
    const password = 'TestGuide123';
    const fullName = 'Test Guide';
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    let userId;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      // Update existing user
      await client.query(
        `UPDATE users SET password_hash = $1, email_verified = true, approval_status = 'approved', is_active = true WHERE id = $2`,
        [passwordHash, userId]
      );
      console.log('✅ Test Guide updated successfully:');
    } else {
      // Create new user
      const result = await client.query(
        `INSERT INTO users (email, password_hash, full_name, user_type, approval_status, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [email, passwordHash, fullName, 'guide', 'approved', true, true]
      );
      userId = result.rows[0].id;
      console.log('✅ Test Guide created successfully:');
    }
    
    console.log(`   Email: ${email}`);
    console.log(`   Type: guide`);
    console.log(`   Status: Ready to Login`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    pool.end();
  }
}

createTestGuide();
