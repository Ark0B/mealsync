// Single source of "now". Tests freeze time with setNow() so meal windows are deterministic.
let fixed = null;

module.exports = {
  now: () => (fixed ? new Date(fixed.getTime()) : new Date()),
  setNow: (date) => { fixed = date ? new Date(date) : null; },
};
