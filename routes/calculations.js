// routes/calculations.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all calculations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calculations');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch calculations' });
  }
});

module.exports = router;

