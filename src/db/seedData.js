// Reference data every installation needs (plans, prices, menu) plus optional demo accounts.
// Prices are PLACEHOLDERS — the mess office sets real prices from the manager dashboard.
const bcrypt = require('bcryptjs');
const { nowStamp } = require('../utils/time');

const PLANS = [
  // code, name, diet, meals, for_day_scholar, monthly price (paise)
  ['HOSTEL_VEG', 'Hostel — Veg (all meals)', 'veg', 'B,L,S,D', 0, 360000],
  ['HOSTEL_NONVEG', 'Hostel — Non-veg (all meals)', 'nonveg', 'B,L,S,D', 0, 420000],
  ['DAY_LUNCH_VEG', 'Day scholar — Veg lunch', 'veg', 'L', 1, 150000],
  ['DAY_LUNCH_NONVEG', 'Day scholar — Non-veg lunch', 'nonveg', 'L', 1, 180000],
  ['DAY_LUNCH_SNACKS_VEG', 'Day scholar — Veg lunch + snacks', 'veg', 'L,S', 1, 200000], // added via CR-002
];

const MEAL_PRICES = [
  ['B', 'veg', 4000], ['B', 'nonveg', 5000],
  ['L', 'veg', 7000], ['L', 'nonveg', 10000],
  ['S', 'veg', 2500], ['S', 'nonveg', 3000],
  ['D', 'veg', 7000], ['D', 'nonveg', 10000],
];

const WEEK_MENU = {
  B: ['Aloo paratha, curd, tea', 'Poha, jalebi, tea', 'Idli, sambar, chutney', 'Chole bhature, tea', 'Upma, banana, coffee', 'Bread, butter, jam, tea', 'Puri sabzi, tea'],
  L: ['Rajma chawal, roti, salad', 'Dal makhani, jeera rice, roti', 'Kadhi pakora, rice, roti', 'Mix veg, dal, rice, roti', 'Chole, rice, roti, raita', 'Paneer butter masala, rice, roti', 'Veg biryani, raita'],
  S: ['Samosa, tea', 'Bread pakora, tea', 'Maggi, coffee', 'Veg sandwich, tea', 'Aloo tikki, tea', 'Pav bhaji', 'Biscuits, tea'],
  D: ['Paneer do pyaza, dal, rice, roti', 'Aloo gobhi, dal, rice, roti', 'Matar paneer, dal, rice, roti', 'Bhindi, dal tadka, rice, roti', 'Malai kofta, rice, roti', 'Dal, rice, roti, kheer', 'Special thali, gulab jamun'],
};
const NONVEG_SWAP = { L: { 0: 'Chicken curry, rice, roti', 3: 'Fish curry, rice, roti' }, D: { 2: 'Egg curry, rice, roti', 6: 'Chicken biryani, raita' } };

async function seedReference(exec) {
  for (const p of PLANS) {
    const exists = await exec.get('SELECT id FROM plans WHERE code = ?', [p[0]]);
    if (!exists) await exec.run('INSERT INTO plans (code, name, diet, meals, for_day_scholar, price_paise, active) VALUES (?, ?, ?, ?, ?, ?, 1)', p);
  }
  for (const mp of MEAL_PRICES) {
    const exists = await exec.get('SELECT meal FROM meal_prices WHERE meal = ? AND diet = ?', [mp[0], mp[1]]);
    if (!exists) await exec.run('INSERT INTO meal_prices (meal, diet, price_paise) VALUES (?, ?, ?)', mp);
  }
  for (const [meal, days] of Object.entries(WEEK_MENU)) {
    for (let d = 0; d < 7; d += 1) {
      for (const diet of ['veg', 'nonveg']) {
        const items = diet === 'nonveg' && NONVEG_SWAP[meal] && NONVEG_SWAP[meal][d] ? NONVEG_SWAP[meal][d] : days[d];
        const exists = await exec.get('SELECT id FROM menu_items WHERE day_of_week = ? AND meal = ? AND diet = ?', [d, meal, diet]);
        if (!exists) await exec.run('INSERT INTO menu_items (day_of_week, meal, diet, items, updated_at) VALUES (?, ?, ?, ?, ?)', [d, meal, diet, items, nowStamp()]);
      }
    }
  }
}

// Demo accounts — password for all of them: MealSync@123
const DEMO_USERS = [
  { name: 'Mess Admin', email: 'admin@mealsync.local', role: 'admin' },
  { name: 'Mess Manager', email: 'manager@mealsync.local', role: 'manager' },
  { name: 'Counter Staff', email: 'staff@mealsync.local', role: 'staff' },
  { name: 'Riya Sharma (committee)', email: 'committee@mealsync.local', role: 'student', is_committee: 1, roll_no: 'SAU/BT/24/001', diet_pref: 'veg' },
  { name: 'Aman Verma', email: 'aman@mealsync.local', role: 'student', roll_no: 'SAU/BT/24/002', diet_pref: 'nonveg' },
  { name: 'Neha Singh (day scholar)', email: 'neha@mealsync.local', role: 'student', roll_no: 'SAU/BT/24/003', diet_pref: 'veg', is_day_scholar: 1 },
  { name: 'Kabir Rao (pending)', email: 'kabir@mealsync.local', role: 'student', roll_no: 'SAU/BT/24/004', diet_pref: 'veg', status: 'pending' },
];

async function seedDemoUsers(exec) {
  const hash = await bcrypt.hash('MealSync@123', 10);
  for (const u of DEMO_USERS) {
    const exists = await exec.get('SELECT id FROM users WHERE email = ?', [u.email]);
    if (exists) continue;
    await exec.run(
      `INSERT INTO users (name, email, password_hash, role, is_committee, roll_no, is_day_scholar, diet_pref, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.name, u.email, hash, u.role, u.is_committee || 0, u.roll_no || null, u.is_day_scholar || 0, u.diet_pref || 'veg', u.status || 'approved', nowStamp()],
    );
  }
}

module.exports = { seedReference, seedDemoUsers, PLANS, MEAL_PRICES, DEMO_USERS };
