// Pure money calculations (all amounts in paise). Kept free of DB access so they are easy to unit test.
const { daysInMonth, daysBetween } = require('./time');

// Price for joining a monthly plan on startDate (pays only for the remaining days).
function proratedPrice(monthlyPaise, startDate) {
  const [y, m] = startDate.split('-').map(Number);
  const total = daysInMonth(y, m);
  const remaining = total - Number(startDate.slice(8, 10)) + 1;
  return Math.round((monthlyPaise * remaining) / total);
}

// Cost of a single plate inside a plan: monthly price / (days in month x meals per day).
function perMealCost(monthlyPaise, monthStr, mealsPerDay) {
  const [y, m] = monthStr.split('-').map(Number);
  return monthlyPaise / (daysInMonth(y, m) * mealsPerDay);
}

// Credit for skipping one meal in advance.
function skipCredit(monthlyPaise, monthStr, mealsPerDay, rate) {
  return Math.floor(perMealCost(monthlyPaise, monthStr, mealsPerDay) * rate);
}

// Refund when a subscription is cancelled: unused days (from tomorrow) x daily rate x refund rate.
function cancellationRefund(paidPaise, startDate, endDate, tomorrow, rate) {
  if (tomorrow > endDate) return 0;
  const from = tomorrow > startDate ? tomorrow : startDate;
  const totalDays = daysBetween(startDate, endDate);
  const unusedDays = daysBetween(from, endDate);
  return Math.floor((paidPaise * unusedDays / totalDays) * rate);
}

const rupees = (paise) => (paise / 100).toFixed(2);

module.exports = { proratedPrice, perMealCost, skipCredit, cancellationRefund, rupees };
