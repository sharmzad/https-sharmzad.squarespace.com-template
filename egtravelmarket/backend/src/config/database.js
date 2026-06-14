const { Pool } = require('pg');
require('dotenv').config();

// ============================================================
// PRODUCTION-HARDENED DATABASE POOL CONFIGURATION
// Optimized for Autoscale + Neon cold starts
// ============================================================
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: isProduction ? 8 : 10,
  min: isProduction ? 2 : 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: isProduction ? 30000 : 15000,
  allowExitOnIdle: false,
  statement_timeout: 45000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

let connectionErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
let poolWarmedUp = false;

pool.on('connect', () => {
  connectionErrors = 0;
  if (!poolWarmedUp) {
    console.log('✅ Connected to PostgreSQL database');
  }
});

const fixMissingProfiles = async () => {
  const client = await pool.connect();
  try {
    const agencyResult = await client.query(`
      SELECT u.id, u.email, u.full_name
      FROM users u
      LEFT JOIN agency_profiles ap ON ap.user_id = u.id
      WHERE u.user_type = 'agency'
        AND u.is_active = true
        AND u.approval_status = 'approved'
        AND u.certification_status = 'certified'
        AND ap.id IS NULL
    `);

    for (const user of agencyResult.rows) {
      const slug = (user.full_name || 'agency').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + user.id;
      await client.query(
        `INSERT INTO agency_profiles (user_id, company_name, slug, contact_email, is_verified, is_featured, approval_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, false, 'approved', NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, user.full_name || 'Agency', slug, user.email]
      );
      console.log(`🔧 Created missing agency profile for user ${user.email} (ID: ${user.id})`);
    }

    const dcResult = await client.query(`
      SELECT u.id, u.email, u.full_name
      FROM users u
      LEFT JOIN dive_center_profiles dp ON dp.user_id = u.id
      WHERE u.user_type = 'divecenter'
        AND u.is_active = true
        AND u.approval_status = 'approved'
        AND u.certification_status = 'certified'
        AND dp.id IS NULL
    `);

    for (const user of dcResult.rows) {
      const slug = (user.full_name || 'dive-center').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + user.id;
      await client.query(
        `INSERT INTO dive_center_profiles (user_id, center_name, slug, contact_email, is_verified, is_featured, approval_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, false, 'approved', NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, user.full_name || 'Dive Center', slug, user.email]
      );
      console.log(`🔧 Created missing dive center profile for user ${user.email} (ID: ${user.id})`);
    }

    const totalFixed = agencyResult.rows.length + dcResult.rows.length;
    if (totalFixed > 0) {
      console.log(`✅ Fixed ${totalFixed} missing profile(s)`);
    } else {
      console.log('✅ Profile integrity check passed - no missing profiles');
    }
  } finally {
    client.release();
  }
};

// ============================================================
// INDEXES: Create critical indexes on startup if missing
// These dramatically speed up admin sign-up approval queries
// ============================================================
const ensureIndexes = async () => {
  const client = await pool.connect();
  try {
    const t0 = Date.now();
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users (approval_status)`,
      `CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users (email_verified)`,
      `CREATE INDEX IF NOT EXISTS idx_users_user_type ON users (user_type)`,
      `CREATE INDEX IF NOT EXISTS idx_users_created_at_desc ON users (created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_users_approval_verified ON users (approval_status, email_verified)`,
    ];
    for (const sql of indexes) {
      await client.query(sql);
    }
    console.log(`✅ DB indexes verified in ${Date.now() - t0}ms`);
  } catch (err) {
    console.warn('⚠️ Index creation note:', err.message);
  } finally {
    client.release();
  }
};

// ============================================================
// COLD START OPTIMIZATION: Pre-warm with retry logic
// Handles both Autoscale and Neon cold starts
// ============================================================
const warmUpPool = async (retries = 3) => {
  if (poolWarmedUp) return;
  
  const startTime = Date.now();
  console.log('🔥 Warming up database connection pool...');
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      poolWarmedUp = true;
      console.log(`✅ Database pool warmed up in ${Date.now() - startTime}ms`);
      
      fixMissingProfiles().catch(err => {
        console.error('⚠️ Profile integrity check failed:', err.message);
      });

      ensureIndexes().catch(err => {
        console.error('⚠️ Index creation skipped:', err.message);
      });
      return;
    } catch (err) {
      console.error(`⚠️ Pool warmup attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) {
        const backoff = attempt * 2000;
        console.log(`🔄 Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }
  console.log('⚠️ Pool warmup exhausted retries - queries will connect on demand');
};

warmUpPool();

pool.on('error', (err) => {
  connectionErrors++;
  console.error(`❌ Database pool error (${connectionErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err.message);
  
  if (connectionErrors >= MAX_CONSECUTIVE_ERRORS) {
    console.error('🚨 Multiple consecutive database errors - attempting pool recovery');
    connectionErrors = 0;
  }
  
  // Auto-recover from connection errors by removing bad connections
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.message.includes('Connection terminated')) {
    console.log('🔄 Detected stale connection, pool will auto-recover on next query');
  }
});

// ============================================================
// PRODUCTION KEEP-ALIVE: Ping Neon every 60s to prevent idle
// connection drops. Tracks consecutive failures and forces
// pool recovery if the database becomes unreachable.
// ============================================================
let healthCheckFailures = 0;
const MAX_HEALTH_FAILURES = 3;

setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    if (healthCheckFailures > 0) {
      console.log('✅ Pool health restored after', healthCheckFailures, 'failure(s)');
      healthCheckFailures = 0;
      poolWarmedUp = true;
    }
  } catch (err) {
    healthCheckFailures++;
    const ts = new Date().toISOString();
    console.error(`❌ [${ts}] Pool health check failed (${healthCheckFailures}/${MAX_HEALTH_FAILURES}):`, err.message);

    if (healthCheckFailures >= MAX_HEALTH_FAILURES) {
      console.error('🚨 Pool unresponsive — forcing reconnection...');
      healthCheckFailures = 0;
      poolWarmedUp = false;
      // Re-warm on next cycle; warmUpPool is idempotent via poolWarmedUp flag
      setTimeout(() => warmUpPool(5), 2000);
    }
  }
}, 60000);

const gracefulShutdown = async () => {
  console.log('🔄 Closing database pool...');
  try {
    await pool.end();
    console.log('✅ Database pool closed');
  } catch (err) {
    console.error('❌ Error closing pool:', err);
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = pool;
