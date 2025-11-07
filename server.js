require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// --- Import route files first ---
const usersRoutes = require('./routes/users');
const calculationsRoutes = require('./routes/calculations');
const highScoreRoutes = require('./routes/high_scores');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
  res.send('pong');
});

// --- Health check route ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});


// --- Mount route handlers after import ---
app.use('/api/users', usersRoutes);
app.use('/api/calculations', calculationsRoutes);
app.use('/api/high_scores', highScoreRoutes);

// PostgreSQL Connection Pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'engihub',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// --- Add this root route ---
app.get('/', (req, res) => {
  res.send('EngiHub Pro API is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Email Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // ✅ use let so we can modify it below

  // ✅ Also check if token is passed as a query parameter
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};


// ==================== AUTH ROUTES ====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, verification_token, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING user_id, username, email`,
      [username, email, hashedPassword, verificationToken]
    );

    const user = result.rows[0];

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}?token=${verificationToken}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your EngiHub Pro Account',
      html: `
        <h1>Welcome to EngiHub Pro!</h1>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 24 hours.</p>
      `,
    });

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user: { id: user.user_id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Verify email
app.get('/api/auth/verify-email/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      'UPDATE users SET email_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING user_id',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Make sure we return 200 status with proper JSON
    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Server error during verification' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const result = await pool.query('SELECT user_id, username, email, password_hash, theme_preference, email_verified FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(400).json({ error: 'Please verify your email first' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.user_id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        theme: user.theme_preference,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3',
      [resetToken, resetExpires, user.user_id]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset - EngiHub Pro',
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = result.rows[0];
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2',
      [hashedPassword, user.user_id]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== USER ROUTES ====================

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, username, email, theme_preference, created_at, last_login FROM users WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user preferences
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
  const { theme } = req.body;

  try {
    await pool.query(
      'UPDATE users SET theme_preference = $1 WHERE user_id = $2',
      [theme, req.user.id]
    );

    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CALCULATION ROUTES ====================

// Save calculation
app.post('/api/calculations', authenticateToken, async (req, res) => {
  const { module, type, inputs, result, metadata } = req.body;

  try {
    
    // Normalize and map module names to allowed DB values
  let moduleNormalized = module.toLowerCase();

  const moduleMap = {
    'structural': 'structural',
    'linear algebra': 'linalg',
    'electrical': 'electrical',
    'utilities': 'utilities'
  };

  // Fallback: if moduleNormalized exists in map, use mapped value
  moduleNormalized = moduleMap[moduleNormalized] || moduleNormalized;


    const calcResult = await pool.query(
      `INSERT INTO calculations (user_id, module, type, inputs, result, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [req.user.id, moduleNormalized, type, JSON.stringify(inputs), result, JSON.stringify(metadata)]
    );

    res.status(201).json(calcResult.rows[0]);
  } catch (error) {
    console.error('Save calculation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get calculation history
app.get('/api/calculations/history', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT * FROM calculations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM calculations WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      calculations: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete calculation
app.delete('/api/calculations/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM calculations WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calculation not found' });
    }

    res.json({ message: 'Calculation deleted successfully' });
  } catch (error) {
    console.error('Delete calculation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GAME ROUTES ====================

// Save high score
app.post('/api/game/high-score', authenticateToken, async (req, res) => {
  const { score } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO high_scoress (user_id, score, created_at)
       VALUES ($1, $2, NOW()) RETURNING *`,
      [req.user.id, score]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Save high score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leaderboard
app.get('/api/game/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await pool.query(
      `SELECT u.username, h.score, h.created_at
       FROM high_scoress h
       JOIN users u ON h.user_id = u.user_id       ORDER BY h.score DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's best score
app.get('/api/game/my-best', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT MAX(score) as best_score, COUNT(*) as games_played
       FROM high_scoress
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get best score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== EXPORT ROUTES ====================

// Export calculation history as CSV
app.get('/api/export/history/csv', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT module, type, result, created_at
       FROM calculations
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Create CSV
    const csv = [
      'Module,Type,Result,Date',
      ...result.rows.map(row => 
        `"${row.module}","${row.type}","${row.result}","${row.created_at}"`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=calculation-history.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export calculation data as JSON
app.get('/api/export/history/json', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM calculations
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=calculation-history.json');
    res.json(result.rows);
  } catch (error) {
    console.error('Export JSON error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const usersRouter = require('./routes/users');           // adjust path if needed
const calculationsRouter = require('./routes/calculations');
const highScoreRouter = require('./routes/high_scores');

app.use('/api/users', usersRouter);
app.use('/api/calculations', calculationsRouter);
app.use('/api/high_scores', highScoreRouter);

// GET all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
// GET all calculations
app.get('/api/calculations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calculations');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch calculations' });
  }
});

// GET all high scores
app.get('/api/high_scores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM high_scores');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch high scores' });
  }
});



// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
