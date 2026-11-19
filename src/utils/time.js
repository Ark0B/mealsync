// Date/time helpers. The mess runs on IST (UTC+05:30, no daylight saving),
// so all "which day / which meal" questions are answered in IST.
const config = require('../config');
const clock = require('./clock');

const IST_OFFSET_MIN = 330;
const MEAL_CODES = ['B', 'L', 'S', 'D'];

// Shift a Date into IST and read its parts with getUTC*() so the server's own timezone never matters.
function istParts(date = clock.now()) {
  const d = new Date(date.getTime() + IST_OFFSET_MIN * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    dayOfWeek: d.getUTCDay(),
  };
}

const today = () => istParts().date;

// UTC timestamp string for DB columns: 'YYYY-MM-DD HH:MM:SS'
const nowStamp = () => clock.now().toISOString().slice(0, 19).replace('T', ' ');

// The exact instant (Date) when an IST wall-clock time happens.
function istToDate(dateStr, minutes) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes) - IST_OFFSET_MIN * 60000);
}

const mealStart = (dateStr, meal) => istToDate(dateStr, config.meals[meal].start);
const mealEnd = (dateStr, meal) => istToDate(dateStr, config.meals[meal].end);

// Which meal is being served right now (IST)? null between meals.
function currentMeal(date = clock.now()) {
  const { minutes } = istParts(date);
  return MEAL_CODES.find((m) => minutes >= config.meals[m].start && minutes < config.meals[m].end) || null;
}

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isMeal = (m) => MEAL_CODES.includes(m);

function daysInMonth(year, month) { // month 1-12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Inclusive day count between two 'YYYY-MM-DD' strings.
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
}

function addDays(dateStr, n) {
  const d = new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

// { start: 'YYYY-MM-01', next: first day of the following month } — use with >= start AND < next
function monthRange(month) {
  return { start: `${month}-01`, next: `${addDays(`${month}-01`, 32).slice(0, 7)}-01` };
}

module.exports = {
  monthRange, MEAL_CODES, istParts, today, nowStamp, istToDate, mealStart, mealEnd,
  currentMeal, isValidDate, isMeal, daysInMonth, daysBetween, addDays,
};
