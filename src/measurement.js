/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class Stopwatch {
  constructor() { this.reset(); }

  reset() {
    return this._start = process.hrtime();
  }

  time() {
    return this._hrToMs(process.hrtime(this._start));
  }

  _hrToMs(...args) {
    const [seconds, nanoseconds] = Array.from(args[0]);
    return Math.round((seconds * 1e3) + (nanoseconds / 1e6));
  }
}

class Measurement {
  constructor(stopwatch) {
    this._stopwatch = stopwatch;
    this.elapsed = stopwatch.time();

    // Immutable
    Object.freeze(this);
  }

  // A new measurement from no point in time
  static benchmark(block) {
    const stopwatch = new Stopwatch();
    block();
    return new Measurement(stopwatch);
  }

  // Extend an old measurement through the execution of the new block
  remeasure(block) {
    block();
    return new Measurement(this._stopwatch);
  }

  // Run the new block and return the same measurement
  preserve(block) {
    block();
    return this;
  }
}

module.exports = Measurement;
