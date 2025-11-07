// routes/high_scores.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool

// GET all high scores
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM high_scores'); // query correct table
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch high scores' });
  }
});

module.exports = router;
