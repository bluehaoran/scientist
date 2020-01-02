/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const {
  EventEmitter
} = require('events');
const Promise = require('bluebird');

const Observation = require('./observation');
const Result = require('./result');

const expects = (type, wrapped) => (function(arg) {
  if (typeof arg !== type) {
    throw TypeError(`Expected ${ type }, got ${ arg }`);
  }
  return wrapped.call(this, arg);
});

class Experiment extends EventEmitter {
  static initClass() {
    // Set the async flag (default: false)
    this.prototype.async = expects('boolean', function(async) { return this._options.async = async; });
    // Sets the skipper function (default: const false)
    this.prototype.skipWhen = expects('function', function(skipper) { return this._options.skipper = skipper; });
    // Set the mapper function (default: identity function)
    this.prototype.map = expects('function', function(mapper) { return this._options.mapper = mapper; });
    // Adds an ignorer function (default: none)
    this.prototype.ignore = expects('function', function(ignorer) { return this._options.ignorers.push(ignorer); });
    // Set the comparator function (default: deep equality)
    this.prototype.compare = expects('function', function(comparator) { return this._options.comparator = comparator; });
    // Set the cleaner function (default: identity function)
    this.prototype.clean = expects('function', function(cleaner) { return this._options.cleaner = cleaner; });
  }
  constructor(name) {
    super();
    this.name = name;
    this._behaviors = {};

    this._options = {
      context: {},
      async: false,
      skipper: _.constant(false),
      mapper: _.identity,
      ignorers: [],
      comparator: _.isEqual,
      cleaner: _.identity
    };
  }

  // Defines the control block
  use(block) {
    return this.try('control', block);
  }

  // Defines a candidate block
  try(...args) {
    let adjustedLength = Math.max(args.length, 1), [name] = Array.from(args.slice(0, adjustedLength - 1)), block = args[adjustedLength - 1];
    if (typeof name === 'undefined' || name === null) { name = 'candidate'; }

    if (name in this._behaviors) {
      throw Error("Duplicate behavior: " + name);
    }

    if (!_.isFunction(block)) {
      throw TypeError(`Invalid block: expected function, got ${ block }`);
    }

    return this._behaviors[name] = block;
  }

  // Runs the experiment based on a sampler function
  run(sampler) {
    // You always must at least provide a control
    if (!('control' in this._behaviors)) {
      throw Error("Expected control behavior to be defined");
    }

    // Experiments will not be run if any of the following are true:
    // 1. You did not define more than the control
    const hasNoBehaviors = _.size(this._behaviors) < 2;
    // 2. The sampler function did not return truthy
    const shouldNotSample = this._try("Sampler", () => !sampler(this.name));
    // 3. The skipper function did return truthy
    const shouldSkip = this._try("Skipper", () => this._options.skipper());

    const skipReason = (() => { switch (false) {
      case !hasNoBehaviors: return "No behaviors defined";
      case !shouldNotSample: return "Sampler returned false";
      case !shouldSkip: return "Skipper returned true";
    } })();

    // In the case of a skipped experiment, just evaluate the control.
    if (skipReason) {
      this._try("Skip handler", () => {
        return this.emit('skip', this, skipReason);
      });
      return this._behaviors.control();
    }

    // Otherwise, shuffle the order and execute each one at a time.
    const observations = _(this._behaviors)
    .chain()
    .keys()
    .shuffle()
    .map(key => new Observation(key, this._behaviors[key], this._options))
    .value();

    // We separate the control from the candidates.
    const control = _.find(observations, {name: 'control'});
    const candidates = _.without(observations, control);

    // Results are compiled and emitted asynchronously.
    this._sendResults([control].concat(candidates));

    // Throws or returns the resulting value of the control
    return control.evaluation();
  }

  // A completely asynchronous function that takes observations in the form of
  // [control] + [candidates...], uses the internal mapper to transform them,
  // tries to construct a result, and sends the result out. Handles all errors
  // in user-defined functions via the error event.
  _sendResults(observations) {
    const mapped = this._try("Map", () => {
      return _.invoke(observations, 'map', this._mapper.bind(this));
    });

    if (!mapped) { return; }

    return Promise.map(mapped, this._settle.bind(this))
    .spread((control, ...candidates) => {
      const result = this._try("Comparison", () => {
        return new Result(this, control, candidates);
      });

      if (!result) { return; }

      return this._try("Result handler", () => {
        return this.emit('result', result);
      });
  }).done();
  }

  // Update and return the context (default: empty object)
  context(context) { return _.extend(this._options.context, context); }

  // A try/catch with a built-in error handler
  _try(operation, block) {
    try {
      return block();
    } catch (err) {
      this.emit('error', this._decorateError(err, operation + " failed"));
      return null;
    }
  }

  // Takes an observation and returns a settled one based on the async argument
  _settle(observation) {
    if (this._options.async) {
      return observation.settle();
    } else {
      return observation;
    }
  }

  // Wraps the options mapper to force the value to be a promise both before and
  // after the mapping if async is toggled on
  _mapper(val) {
    if (this._options.async) {
      const result = this._options.mapper(Promise.resolve(val));
      if (!_.isFunction(result != null ? result.then : undefined)) {
        throw Error(`Result of async mapping must be a thenable, got ${ result }`);
      }
      return result;
    } else {
      return this._options.mapper(val);
    }
  }

  // Mutate the error by prepending the message with a prefix and adding some
  // contextual information. This is done so that the stack trace is left
  // unaltered.
  _decorateError(err, prefix) {
    err.message = `${ prefix }: ${ err.message }`;
    err.experiment = this;
    err.context = this.context();
    return err;
  }
}
Experiment.initClass();

module.exports = Experiment;
