// routes/high_score.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all high_score
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM high_score');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch high scores' });
  }
});

module.exports = router;

