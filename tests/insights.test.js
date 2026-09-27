import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCells, aggregate, routeRows } from '../public/src/insights-data.js';
const cell = (count, extra = {}) => ({ origin: 'fernhill', destination: 'frankton', modes: '["bike","bus"]', timeBand: 'weekday-am', changeReason: '', count, ...extra });
test('small cells cannot become public by combining them', () => {
  const rows = selectCells([cell(4), cell(3), cell(5), cell(Infinity), cell(-1), cell(5.5), null]);
  assert.deepEqual(routeRows(rows), [{ origin: 'fernhill', destination: 'frankton', count: 5 }]);
  assert.equal(selectCells([cell(4)], {}, 1).length, 0);
  assert.equal(selectCells([cell(5)], {}, 6).length, 0);
});
test('combined filters preserve the threshold, direction and origin/destination totals', () => {
  const cells = [cell(5), cell(8, { destination: 'queenstown' }), cell(6, { origin: 'frankton', destination: 'fernhill' }), cell(7, { timeBand: 'weekend' }), cell(3)];
  const visible = selectCells(cells, { mode: 'bus', time: 'weekday-am', origin: 'fernhill' });
  assert.deepEqual(aggregate(visible, c => [c.origin]), [{ key: 'fernhill', count: 13 }]);
  assert.deepEqual(aggregate(visible, c => [c.destination]), [{ key: 'queenstown', count: 8 }, { key: 'frankton', count: 5 }]);
  assert.equal(routeRows(visible).reduce((sum, r) => sum + r.count, 0), 13);
  assert.deepEqual(selectCells(cells, { mode: 'car' }), []);
  assert.deepEqual(selectCells(null), []);
});
