// Runs before every test file: in-memory SQLite, test secrets, mock payments.
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = process.env.DB_CLIENT || 'sqlite';
process.env.SQLITE_FILE = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PASS_SECRET = 'test-pass-secret';
process.env.PAYMENT_MODE = 'mock';
process.env.PAYMENT_SECRET = 'test-gateway-secret';
