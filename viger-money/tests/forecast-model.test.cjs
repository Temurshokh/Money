const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'app.js');
const appSource = fs.readFileSync(appPath, 'utf8');
const start = appSource.indexOf('  function buildForecastModel(horizonDays) {');
const end = appSource.indexOf('\n  function totalBalanceAt(date) {', start);
assert(start >= 0 && end > start, 'buildForecastModel function found');
const functionSource = appSource.slice(start, end).trim();

const DAY = 86400000;
const localDay = value => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; };
const dateInputValue = value => {
  const d = new Date(value);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const sum = values => values.reduce((a, b) => a + b, 0);
const noPatterns = () => [];
const money = value => `${Math.round(value).toLocaleString('en-US')} сум`;

function makeModel(transactions, current, plannedEvents = []) {
  const state = { transactions, plannedEvents };
  const activeTransactions = () => state.transactions.filter(tx => !tx.deletedAt);
  const totalBalance = () => current;
  const factory = new Function('state', 'activeTransactions', 'localDay', 'dateInputValue', 'sum', 'detectRecurringPatterns', 'totalBalance', 'FORECAST_DAY_MS', 'money', `${functionSource}; return buildForecastModel;`);
  return factory(state, activeTransactions, localDay, dateInputValue, sum, noPatterns, totalBalance, DAY, money);
}
function tx(daysAgo, type, amount, extras = {}) {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - daysAgo);
  return { id: `${daysAgo}-${type}-${amount}-${Math.random()}`, type, amount, occurredAt: d.toISOString(), ...extras };
}

// The screenshot pattern: a large historical balance build-up, then modest recent transactions.
const screenshotHistory = [
  tx(21, 'income', 2962000),
  tx(18, 'expense', 230000),
  tx(6, 'income', 30000),
  tx(5, 'income', 9000),
  tx(5, 'income', 5000),
  tx(5, 'expense', 7000),
  tx(2, 'income', 101000),
  tx(1, 'expense', 7000)
];
const base = makeModel(screenshotHistory, 2863000)(7);
assert.equal(Math.round(base.weeklyNet), 131000, 'last completed week net = +131,000, old large deposit excluded');
assert.equal(Math.round(base.forecast.realistic), 2994000, '7-day projection adds the last-week net, not lifetime average');
assert.ok(base.forecast.realistic < 3100000, 'forecast should not invent +1.5m in one week');

// One-time receipts affect the current balance but not the trend.
const withOneTime = screenshotHistory.concat(tx(4, 'income', 2500000, { forecastMode: 'one-time' }));
const oneTimeModel = makeModel(withOneTime, 5363000)(7);
assert.equal(Math.round(oneTimeModel.weeklyNet), 131000);
assert.equal(oneTimeModel.oneTimeExcluded, 1);

// Current partial-day operation is excluded from the completed-week pace.
const withToday = screenshotHistory.concat(tx(0, 'income', 900000));
const todayModel = makeModel(withToday, 3763000)(7);
assert.equal(Math.round(todayModel.weeklyNet), 131000);

// Sparse: two completed days are not multiplied by 7 / 2.
const sparseTwoDays = [tx(2, 'income', 40000), tx(1, 'expense', 5000)];
const sparseModel = makeModel(sparseTwoDays, 35000)(7);
assert.equal(Math.round(sparseModel.weeklyNet), 35000);
assert.equal(sparseModel.observedDays, 2);
assert.equal(sparseModel.confidence, 'low');

// Four available completed days normalize the observed daily average to a week.
const fourDays = [tx(4, 'income', 40000), tx(3, 'expense', 5000), tx(2, 'income', 20000), tx(1, 'expense', 5000)];
const fourDayModel = makeModel(fourDays, 50000)(7);
assert.equal(Math.round(fourDayModel.weeklyNet), 87500); // +50k over 4 days × 7/4

// Planned future money affects the forecast, never the real current balance.
const plannedDate = new Date(); plannedDate.setHours(12,0,0,0); plannedDate.setDate(plannedDate.getDate() + 3);
const planned = [{ id: 'plan-1', type: 'income', amount: 100000, date: dateInputValue(plannedDate), description: 'Ожидаемые деньги' }];
const plannedModel = makeModel(screenshotHistory, 2863000, planned)(7);
assert.equal(Math.round(plannedModel.forecast.realistic), 3094000);
assert.equal(plannedModel.current, 2863000);

console.log('V Money Forecast 2.1.1 tests passed:');
console.log('- old large balance accumulation does not drive the future pace');
console.log('- one-time operations are excluded from trend but retained in balance');
console.log('- current partial day is excluded');
console.log('- sparse history is handled conservatively');
console.log('- 3–6 day samples are normalized to a weekly rate');
console.log('- planned events affect forecast only');
