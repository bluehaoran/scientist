/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Promise = require('bluebird');
const sinon = require('sinon');

const sandbox = () => Promise.resolve(sinon.sandbox.create())
.disposer(sandbox => sandbox.restore());

// A more simple abstraction of sinon's clock-stubbing feature. Note that this
// *freezes* time for all code run within this context. Use the tick(ms)
// function provided to your callback to move time forward. Should work for all
// time-related functionality using Date.now() and setTimeout(...).
const HOOKS = [
  'Date',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval'
];

const useFakeHrTime = function(sandbox) {
  let ticked = 0;

  sandbox.stub(process, 'hrtime', function(start) {
    const now = [Math.floor(ticked / 1e3), (ticked % 1e3) * 1e6];

    if (start) {
      return [now[0] - start[0], now[1] - start[1]];
    } else {
      return now;
    }
  });

  return {tick(ms) { return ticked += ms; }};
};

const useFakeTimers = function(sandbox, time, ...hooks) {
  const sinonClock = sandbox.useFakeTimers(time, ...Array.from(hooks));
  const hrClock = useFakeHrTime(sandbox);

  return{ tick(ms) {
    sinonClock.tick(ms);
    return hrClock.tick(ms);
  }
};
};

module.exports = callback => Promise.using(sandbox(), s => // Resolve/then will let the timeout execute first before the fake timers
// come into play.
Promise.resolve().then(function() {
  // We intentionally omit setImmediate/clearImmediate because freezing
  // those breaks a lot of request-based integration testing.
  const clock = useFakeTimers(s, Date.now(), ...Array.from(HOOKS));
  return Promise.try(() => callback(clock.tick));}).timeout(1000));
