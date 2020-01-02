/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const Promise = require('bluebird');
const sinon = require('sinon');

const Experiment = require('../src/experiment');
const Result = require('../src/result');

const time = require('./helpers/time');

const eventToPromise = (emitter, event) => new Promise((resolve, reject) => emitter.once(event, (...args) => resolve(args)));

describe("Experiment", function() {
  beforeEach(function() {
    this.experiment = new Experiment("test");
    this.true = _.constant(true);
    return this.false = _.constant(false);
  });

  describe("constructor", () => it("takes and exposes a name", function() {
    return this.experiment.should.have.property('name', "test");
  }));

  describe("::use()", () => it("calls try with the special name 'control'", function() {
    const block = (function() {});
    this.experiment.use(block);
    return this.experiment._behaviors.should.have.property('control', block);
  }));

  describe("::try()", function() {
    it("takes an optional name and block", function() {
      const block1 = (function() {});
      const block2 = (function() {});
      this.experiment.try(block1);
      this.experiment.try("test", block2);

      return this.experiment._behaviors.should.have.properties({
        candidate: block1,
        test: block2
      });
    });

    it("throws if you do not provide a block", function() {
      return (() => this.experiment.try(null)).should.throw(/Invalid block/);
    });

    return it("throws if the name is not unique", function() {
      this.experiment.try(_.noop);
      return (() => this.experiment.try(_.noop)).should.throw(/Duplicate behavior/);
    });
  });

  describe("::run()", function() {
    beforeEach(function() {
      this.control = sinon.stub();
      this.candidate = sinon.stub();
      this.experiment.use(this.control);
      return this.experiment.try(this.candidate);
    });

    it("requires a 'control' behavior", function() {
      const experiment = new Experiment("test");
      return (function() { return experiment.run(this.true); }).should.throw(/Expected control behavior/);
    });

    it("passes the name to the sampler", function() {
      const sampler = sinon.spy();
      this.experiment.run(sampler);
      return sampler.should.be.calledWith("test");
    });

    describe("when the experiment is skipped", function() {
      it("does not run the candidates", function() {
        this.experiment.run(this.false);

        return this.candidate.should.not.be.called();
      });

      return it("returns or throws the control result", function() {
        const value = {};
        this.control.returns(value);
        this.experiment.run(this.false).should.equal(value);

        const error = Error();
        this.control.throws(error);
        return (() => this.experiment.run(this.false)).should.throw(error);
      });
    });

    it("runs all the behaviors", function() {
      this.experiment.run(this.true);

      this.control.should.be.calledOnce();
      return this.candidate.should.be.calledOnce();
    });

    it("randomizes the order of the behaviors", function() {
      const results = [];
      // They say you never shuffle the same deck twice...
      _.times(52, i => {
        return this.experiment.try(i, () => results.push(i));
      });

      this.experiment.run(this.true);
      return results.should.not.eql(__range__(0, 51, true));
    });

    it("returns the exact result returned by the control", function() {
      const value = {};
      this.control.returns(value);

      return this.experiment.run(this.true).should.equal(value);
    });

    return it("throws any errors thrown by the control", function() {
      const error = Error();
      this.control.throws(error);

      return (() => this.experiment.run(this.true)).should.throw(error);
    });
  });

  describe("event: skip", function() {
    it("is emitted if there are no candidates defined", function() {
      const capture = eventToPromise(this.experiment, 'skip');
      this.experiment.use(() => 1);

      this.experiment.run(this.true);

      return capture.should.eventually.eql([this.experiment, "No behaviors defined"]);
    });

    it("is emitted if the sampler returns falsy", function() {
      const capture = eventToPromise(this.experiment, 'skip');
      this.experiment.use(() => 1);
      this.experiment.try(() => 1);

      this.experiment.run(this.false);

      return capture.should.eventually.eql([this.experiment, "Sampler returned false"]);
    });

    return it("is emitted if the skipper returns truthy", function() {
      const capture = eventToPromise(this.experiment, 'skip');
      this.experiment.use(() => 1);
      this.experiment.try(() => 1);
      this.experiment.skipWhen(() => true);

      this.experiment.run(this.true);

      return capture.should.eventually.eql([this.experiment, "Skipper returned true"]);
    });
  });

  describe("event: result", function() {
    it("is emitted with a result after a successful run", function() {
      this.experiment.use(() => 1);
      this.experiment.try(() => 1);
      this.experiment.run(this.true);

      return eventToPromise(this.experiment, 'result')
      .spread(result => {
        result.should.be.instanceOf(Result);
        return result.experiment.should.equal(this.experiment);
      });
    });

    it("is emitted with a result even if the block throws", function() {
      this.experiment.use(function() { throw Error(); });
      this.experiment.try(function() { throw Error(); });
      // This is going to throw to reproduce the effect of the use
      try { this.experiment.run(this.true); } catch (e) {}

      return eventToPromise(this.experiment, 'result').should.be.fulfilled();
    });

    it("emits settled observations for the results if async option was enabled", function() {
      const value = {};
      this.experiment.async(true);
      this.experiment.use(() => Promise.resolve(value));
      this.experiment.try(() => Promise.reject(value));
      this.experiment.run(this.true);

      return eventToPromise(this.experiment, 'result')
      .spread(result => {
        result.control.value.should.equal(value);
        return result.candidates[0].error.should.equal(value);
      });
    });

    it("emits observations with transformed values using the mapper option", function() {
      this.experiment.use(() => 1);
      this.experiment.try(function() { throw 1; });
      this.experiment.map(val => [val]);
      this.experiment.run(this.true);

      return eventToPromise(this.experiment, 'result')
      .spread(result => {
        result.control.value.should.eql([1]);
        return result.candidates[0].error.should.eql(1);
      });
    });

    return it("emits observations with timing independent of order", function() {
      return time(tick => {
        this.experiment.use(() => tick(1000));
        this.experiment.try(() => tick(1000));
        this.experiment.map(_.identity);
        this.experiment.run(this.true);

        return eventToPromise(this.experiment, 'result');
    }).spread(result => {
        result.control.duration.should.equal(1000);
        return result.candidates[0].duration.should.equal(1000);
      });
    });
  });

  describe("event: error", function() {
    beforeEach(function() {
      this.experiment.use(() => 1);
      return this.experiment.try(() => 2);
    });

    it("is emitted if the sampler fails", function() {
      const capture = eventToPromise(this.experiment, 'error');

      this.experiment.run(function() { throw Error("forced"); });

      return capture.spread(error => {
        error.message.should.match(/^Sampler failed: forced/);
        return error.experiment.should.equal(this.experiment);
      });
    });

    it("is emitted if the skipper fails", function() {
      const capture = eventToPromise(this.experiment, 'error');

      this.experiment.skipWhen(function() { throw Error("forced"); });
      this.experiment.run(this.true);

      return capture.spread(error => {
        error.message.should.match(/^Skipper failed: forced/);
        return error.experiment.should.equal(this.experiment);
      });
    });

    it("is emitted if the skip event handler fails", function() {
      const capture = eventToPromise(this.experiment, 'error');

      this.experiment.on('skip', function() { throw Error("forced"); });
      this.experiment.run(this.false);

      return capture.spread(error => {
        error.message.should.match(/^Skip handler failed: forced/);
        return error.experiment.should.equal(this.experiment);
      });
    });

    it("is emitted if the map fails", function() {
      const capture = eventToPromise(this.experiment, 'error');

      this.experiment.map(function() { throw Error("forced"); });
      this.experiment.run(this.true);

      return capture.spread(error => {
        error.message.should.match(/^Map failed: forced/);
        return error.experiment.should.equal(this.experiment);
      });
    });

    it("is emitted if the comparison fails", function() {
      const capture = eventToPromise(this.experiment, 'error');

      this.experiment.compare(function() { throw Error("forced"); });
      this.experiment.run(this.true);

      return capture.spread(error => {
        error.message.should.match(/^Comparison failed: forced/);
        return error.experiment.should.equal(this.experiment);
      });
    });

    return it("is emitted if the result event handler fails", function() {
      const capture = eventToPromise(this.experiment, 'error');

      this.experiment.on('result', function() { throw Error("forced"); });
      this.experiment.run(this.true);

      return capture.spread(error => {
        error.message.should.match(/^Result handler failed: forced/);
        return error.experiment.should.equal(this.experiment);
      });
    });
  });

  describe("::context()", function() {
    it("merges an object into the current context", function() {
      this.experiment.context({ a: 1 });
      this.experiment._options.context.should.eql({ a: 1 });
      this.experiment.context({ b: 2 });
      return this.experiment._options.context.should.eql({ a: 1, b: 2 });
    });

    it("makes no changes for an undefined value", function() {
      this.experiment.context({ a: 1 });
      this.experiment._options.context.should.eql({ a: 1 });
      this.experiment.context();
      return this.experiment._options.context.should.eql({ a: 1 });
    });

    return it("returns the new context", function() {
      this.experiment.context({ a: 1 }).should.eql({ a: 1 });
      return this.experiment.context().should.eql({ a: 1 });
    });
  });

  describe("::async()", function() {
    it("requires a boolean", function() {
      return (() => this.experiment.async(1)).should.throw(/Expected boolean, got 1/);
    });

    return it("sets the internal async flag", function() {
      this.experiment.async(true);
      return this.experiment._options.async.should.be.true();
    });
  });

  describe("::skipWhen()", function() {
    it("requires a function", function() {
      return (() => this.experiment.skipWhen(1)).should.throw(/Expected function, got 1/);
    });

    return it("sets the internal skipper function", function() {
      const skipper = (function() {});
      this.experiment.skipWhen(skipper);
      return this.experiment._options.skipper.should.equal(skipper);
    });
  });

  describe("::map()", function() {
    it("requires a function", function() {
      return (() => this.experiment.map(1)).should.throw(/Expected function, got 1/);
    });

    return it("sets the internal mapper function", function() {
      const mapper = (function() {});
      this.experiment.map(mapper);
      return this.experiment._options.mapper.should.equal(mapper);
    });
  });

  describe("::ignore()", function() {
    it("requires a function", function() {
      return (() => this.experiment.ignore(1)).should.throw(/Expected function, got 1/);
    });

    return it("adds an internal ignorer function", function() {
      const ignorer = (function() {});
      this.experiment.ignore(ignorer);
      this.experiment.ignore(ignorer);
      return this.experiment._options.ignorers.should.eql([ignorer, ignorer]);
    });
  });

  describe("::compare()", function() {
    it("requires a function", function() {
      return (() => this.experiment.compare(1)).should.throw(/Expected function, got 1/);
    });

    return it("sets the internal comparator function", function() {
      const comparator = (function() {});
      this.experiment.compare(comparator);
      return this.experiment._options.comparator.should.equal(comparator);
    });
  });

  describe("::clean()", function() {
    it("requires a function", function() {
      return (() => this.experiment.clean(1)).should.throw(/Expected function, got 1/);
    });

    return it("sets the internal cleaner function", function() {
      const cleaner = (function() {});
      this.experiment.clean(cleaner);
      return this.experiment._options.cleaner.should.equal(cleaner);
    });
  });

  return describe("mapping", function() {
    beforeEach(function() {
      this.result = Promise.race([
        eventToPromise(this.experiment, 'result'),
        eventToPromise(this.experiment, 'error').spread(function(err) { throw err; })
      ]);
    });

    it("always provides a promise argument if async is set to true", function() {
      this.experiment.async(true);
      this.experiment.use(() => 1);
      this.experiment.try(() => 2);
      const mapper = sinon.spy(function(val) {
        val.should.be.instanceOf(Promise);
        return val;
      });
      this.experiment.map(mapper);

      this.experiment.run(this.true);

      return this.result.should.be.fulfilled()
      .then(() => mapper.should.be.calledTwice());
    });

    return it("always expects a promise return value if async is set to true", function() {
      this.experiment.async(true);
      this.experiment.use(() => Promise.resolve({ a: 1 }));
      this.experiment.try(() => Promise.resolve({ a: 2 }));
      // A common mistake: val is a promise, not a value
      this.experiment.map(val => val.a);

      this.experiment.run(this.true);

      return this.result.should.be.rejectedWith(/Result of async mapping must be a thenable/);
    });
  });
});

function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}