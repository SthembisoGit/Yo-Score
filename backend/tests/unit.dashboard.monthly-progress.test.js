const test = require('node:test');
const assert = require('node:assert/strict');

const { computeMonthlyProgress } = require('../dist/src/services/dashboard.service');

test('monthly progress computes average delta when current and previous month data exist', () => {
  const result = computeMonthlyProgress({
    currentMonthAvg: 80,
    previousMonthAvg: 60,
    currentMonthCount: 3,
    previousMonthCount: 2,
  });

  assert.equal(result, 20);
});

test('monthly progress uses current month average when previous month has no data', () => {
  const result = computeMonthlyProgress({
    currentMonthAvg: 72,
    previousMonthAvg: null,
    currentMonthCount: 4,
    previousMonthCount: 0,
  });

  assert.equal(result, 72);
});

test('monthly progress becomes negative previous average when current month has no data', () => {
  const result = computeMonthlyProgress({
    currentMonthAvg: null,
    previousMonthAvg: 70,
    currentMonthCount: 0,
    previousMonthCount: 5,
  });

  assert.equal(result, -70);
});

test('monthly progress returns zero when neither month has graded data', () => {
  const result = computeMonthlyProgress({
    currentMonthAvg: null,
    previousMonthAvg: null,
    currentMonthCount: 0,
    previousMonthCount: 0,
  });

  assert.equal(result, 0);
});

test('monthly progress is clamped to supported bounds', () => {
  const positive = computeMonthlyProgress({
    currentMonthAvg: 210,
    previousMonthAvg: 0,
    currentMonthCount: 2,
    previousMonthCount: 2,
  });
  const negative = computeMonthlyProgress({
    currentMonthAvg: 0,
    previousMonthAvg: 250,
    currentMonthCount: 2,
    previousMonthCount: 2,
  });

  assert.equal(positive, 100);
  assert.equal(negative, -100);
});

test('monthly progress ignores invalid averages unless month has valid graded data', () => {
  const result = computeMonthlyProgress({
    currentMonthAvg: Number.NaN,
    previousMonthAvg: 85,
    currentMonthCount: 3,
    previousMonthCount: 2,
  });

  assert.equal(result, -85);
});
