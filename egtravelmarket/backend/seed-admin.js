const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedAdmin() {
  const client = await pool.connect();
  
  try {
    const email = 'info@egtravelmarket.com';
    const password = 'ETM2026';
    const fullName = 'System Admin';
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if admin already exists
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    // Insert admin user
    const result = await client.query(
      `INSERT INTO users (email, password_hash, full_name, user_type, approval_status, is_active, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, user_type`,
      [email, passwordHash, fullName, 'admin', 'approved', true, true]
    );
    
    console.log('✅ Admin user created successfully:');
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Type: ${result.rows[0].user_type}`);
    
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  } finally {
    client.release();
    pool.end();
  }
}

seedAdmin();
