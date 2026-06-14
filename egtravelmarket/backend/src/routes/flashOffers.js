const express = require('express');
const router = express.Router();
const pool = require('../config/database');


router.get('/', async (req, res) => {
  try {
    console.log('📍 Fetching ALL flash offers (no filter)');
    
    let query = 'SELECT * FROM flash_offers ORDER BY deadline ASC';
    let params = [];

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      offers: result.rows
    });

  } catch (error) {
    console.error('Error fetching flash offers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch flash offers',
      details: error.message
    });
  }
});


module.exports = router;
