-- Create database (run this first in PostgreSQL)
-- You'll run this using: psql -U postgres

-- CREATE DATABASE engihub;

-- Then connect to the database and run the rest:
-- \c engihub

-- Create users table
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  theme_preference VARCHAR(20) DEFAULT 'dark',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  
  CONSTRAINT username_length CHECK (LENGTH(username) >= 3),
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT theme_values CHECK (theme_preference IN ('dark', 'light'))
);

-- Create calculations table
CREATE TABLE calculations (
  calculation_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  type VARCHAR(100),
  inputs JSONB,
  result TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT module_check CHECK (module IN ('structural', 'linalg', 'electrical', 'utilities'))
);

-- Create high_scores table
CREATE TABLE high_scores (
  score_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_calculations_user_created ON calculations(user_id, created_at DESC);
CREATE INDEX idx_calculations_module ON calculations(module);
CREATE INDEX idx_high_scores_score ON high_scores(score DESC);
CREATE INDEX idx_high_scores_user ON high_scores(user_id);