// npm run create-admin -- <email> "<name>" <password>
// Creates the first admin account on a fresh production database.
const bcrypt = require('bcryptjs');
const db = require('./index');
const { nowStamp } = require('../utils/time');

const [email, name, password] = process.argv.slice(2);

(async () => {
  if (!email || !name || !password || password.length < 8) {
    console.error('Usage: npm run create-admin -- <email> "<name>" <password (min 8 chars)>');
    process.exit(1);
  }
  await db.init();
  await db.applySchema();
  const hash = await bcrypt.hash(password, 10);
  await db.run(
    `INSERT INTO users (name, email, password_hash, role, status, created_at) VALUES (?, ?, ?, 'admin', 'approved', ?)`,
    [name, email.toLowerCase(), hash, nowStamp()],
  );
  console.log(`Admin ${email} created.`);
  await db.close();
})().catch((e) => { console.error(e.isDuplicate ? 'That email already exists.' : e.message); process.exit(1); });
