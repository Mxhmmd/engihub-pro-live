// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool

// GET all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users'); // correct table
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
