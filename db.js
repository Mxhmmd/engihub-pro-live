// db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'engihub_app',
  host: process.env.DB_HOST || 'dpg-d46la53ipnbc73eogj5g-a',
  database: process.env.DB_NAME || 'engihub',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

module.exports = pool;
