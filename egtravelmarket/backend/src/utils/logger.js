const pool = require('../config/database');

/**
 * Log an action/event to the database
 * @param {string} action - Action type (signup, login, booking, job_post, payment, etc.)
 * @param {number} userId - User ID (optional)
 * @param {string} userEmail - User email
 * @param {string} userType - User type (customer, guide, agency, etc.)
 * @param {string} status - Status (success, failed, error)
 * @param {string} message - Log message
 * @param {object} metadata - Additional data (error details, amounts, etc.)
 */
async function logAction(action, userId, userEmail, userType, status, message, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO action_logs (action, user_id, user_email, user_type, status, message, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [action, userId || null, userEmail, userType, status, message, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('❌ Error logging action:', error.message);
  }
}

module.exports = { logAction };
