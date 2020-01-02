/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const Promise = require('bluebird');

// Stringification is done with node's inspect with default recursion, and it
// is also smart enough to handle cyclical references, which JSON.stringify
// won't do.
const {
  inspect
} = require('util');

const Measurement = require('./measurement');

class Observation {
  static initClass() {
  
    this.prototype.measure = Measurement.benchmark;
  }
  static withMeasurement(measure, ...args) {
    const mixin = _.create(this.prototype, { measure });
    const observation = _.create(mixin);
    this.apply(observation, args);
    return observation;
  }

  constructor(name, block, options) {
    if (options == null) { options = {}; }
    this.name = name;
    this._options = options;

    // DEPRECATED: this property is not terribly useful and will be removed in
    // 2.x.
    this.startTime = options.startTime != null ? options.startTime : new Date();

    this._time = this.measure(() => {
      // Runs the block on construction
      try {
        return this.value = block();
      } catch (error) {
        return this.error = error;
      }
    });

    this.duration = this._time.elapsed;

    // Immutable
    Object.freeze(this);
  }

  // The evaluation of the observation "replays" the effect of the block and
  // either returns the value or throws the error.
  evaluation() {
    if (this.didReturn()) {
      return this.value;
    } else {
      throw this.error;
    }
  }

  // Settling the observation returns a promise of a new observation, but values
  // of resolved or rejected promises are settled to values or errors. The start
  // time is preserved so that the duration reflects the time spent running and
  // settling.
  settle() {
    return Promise.try(this.evaluation.bind(this))
    .reflect()
    .then(inspection => {
      if (inspection.isFulfilled()) {
        return () => inspection.value();
      } else {
        return function() { throw inspection.reason(); };
      }
  }).then(block => {
      return Observation.withMeasurement(this._time.remeasure.bind(this._time), this.name, block,
        _.defaults({ startTime: this.startTime }, this._options));
    });
  }

  // Mapping an observation returns a new observation with the original value
  // fed through a mapping function. If the block was observed to have thrown,
  // the same observation is returned.
  map(f) {
    if (this.didReturn()) {
      const block = _.constant(f(this.value));
      return Observation.withMeasurement(this._time.preserve.bind(this._time), this.name, block,
        _.defaults({ startTime: this.startTime }, this._options));
    } else {
      return this;
    }
  }

  // True if the block returned; false if it threw
  didReturn() { return (this.error == null); }

  // Returns true if the other observation is allowed to be compared to this
  // one using the ignorer options as a set of filters. If any return true, the
  // comparison is aborted.
  ignores(other) {
    if (!(other instanceof Observation)) {
      return false;
    }

    if (_.isEmpty(this._options.ignorers)) {
      return false;
    }

    return _.any(this._options.ignorers, predicate => predicate(this, other));
  }

  // Returns true if the other observation matches this one. In order for
  // observations to match, they most have both thrown or returned, and the
  // values or errors should match based on supplied or built-in criteria.
  matches(other) {
    if (!(other instanceof Observation)) {
      return false;
    }

    // Both returned
    if (this.didReturn() && other.didReturn()) {
      return Boolean(this._options.comparator(this.value, other.value));
    }

    // Both threw
    if (!this.didReturn() && !other.didReturn()) {
      return this._compareErrors(this.error, other.error);
    }

    // Mixed returns and throws
    return false;
  }

  // Our built-in error comparator only checks the constructor and message, as
  // stack is unreliable and there is typically no more information.
  _compareErrors(a, b) {
    return (a.constructor === b.constructor) && _.isEqual(a.message, b.message);
  }

  // Returns a string for logging purposes. Uses the defined cleaner for
  // returned values.
  inspect(depth, options) {
    if (this.didReturn()) {
      return `value: ${ inspect(this._options.cleaner(this.value), options) }`;
    } else {
      return `error: [${ (this.error.constructor != null ? this.error.constructor.name : undefined) }] ${ inspect(this.error.message, options) }`;
    }
  }
}
Observation.initClass();

module.exports = Observation;
