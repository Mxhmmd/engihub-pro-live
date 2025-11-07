// routes/calculations.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool

// GET all calculations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calculations'); // query correct table
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch calculations' });
  }
});

module.exports = router;
