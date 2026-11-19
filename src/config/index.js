// Central configuration. Every value can be overridden with an environment variable (.env file).
require('dotenv').config({ quiet: true });

const env = process.env;

module.exports = {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 3000,
  institutionName: env.INSTITUTION_NAME || 'South Asian University',

  // Database: 'sqlite' needs zero setup (dev/tests); 'mysql' is the production target.
  db: {
    client: env.DB_CLIENT || 'sqlite',
    sqliteFile: env.SQLITE_FILE || 'database/mealsync.db', // ':memory:' in tests
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'mealsync',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'mealsync',
  },

  jwtSecret: env.JWT_SECRET || 'dev-only-jwt-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',

  // Secret used to sign rotating QR meal passes. Must differ from the JWT secret.
  passSecret: env.PASS_SECRET || 'dev-only-pass-secret-change-me',
  passStepSeconds: 30, // a pass changes every 30 s

  // Payment gateway. 'mock' simulates a Razorpay-style gateway locally.
  payment: {
    mode: env.PAYMENT_MODE || 'mock',
    secret: env.PAYMENT_SECRET || 'dev-only-gateway-secret',
  },

  // Meal windows in IST, minutes since midnight. B=breakfast L=lunch S=snacks D=dinner.
  meals: {
    B: { name: 'Breakfast', start: 7 * 60 + 30, end: 9 * 60 + 30 },
    L: { name: 'Lunch', start: 12 * 60 + 30, end: 14 * 60 + 30 },
    S: { name: 'Snacks', start: 17 * 60, end: 18 * 60 },
    D: { name: 'Dinner', start: 19 * 60 + 30, end: 21 * 60 + 30 },
  },

  // Defaults for the editable settings table (manager can change these at runtime).
  defaultSettings: {
    skip_cutoff_hours: '4',          // skip a meal at least 4 h before it starts
    skip_credit_rate: '0.6',         // 60 % of a meal's per-plate cost is credited
    max_skips_per_month: '30',
    cancel_refund_rate: '0.5',       // 50 % of unused days refunded on cancellation
    late_plate_grace_minutes: '60',  // late plates can be collected up to 60 min after the window
  },
};
