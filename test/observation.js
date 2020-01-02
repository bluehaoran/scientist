/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const Promise = require('bluebird');
const sinon = require('sinon');
const {
  inspect
} = require('util');

const Observation = require('../src/observation');

const time = require('./helpers/time');

describe("Observation", function() {
  beforeEach(function() {
    this.name = "test";
    this.options = {
      mapper: _.identity,
      ignorers: [],
      comparator: _.isEqual,
      cleaner: _.identity
    };

    // Two types of blocks
    this.returning = v => () => v;
    this.throwing = e => (function() { throw e; });

    // Some fixtures and corresponding convenience functions
    this.value = {};
    this.return = this.returning(this.value);

    this.error = Error();
    return this.throw = this.throwing(this.error);
  });

  describe("constructor", function() {
    it("takes a behavior name, block, and options", function() {
      const observation = new Observation(this.name, this.return);

      return observation.should.have.property('name', this.name);
    });

    it("exposes the start time", function() {
      // Just freeze time
      return time(() => {
        const observation = new Observation(this.name, this.return);
        return observation.should.have.property('startTime', new Date());
      });
    });

    it("exposes the duration", function() {
      return time(tick => {
        const observation = new Observation(this.name, () => tick(10));
        return observation.should.have.property('duration', 10);
      });
    });

    return describe("running the block", function() {
      it("exposes returned results", function() {
        const observation = new Observation(this.name, this.return);

        observation.should.have.property('value').equal(this.value);
        return observation.should.not.have.property('error');
      });

      it("exposes thrown errors", function() {
        const observation = new Observation(this.name, this.throw);

        observation.should.have.property('error').equal(this.error);
        return observation.should.not.have.property('value');
      });

      return it("only executes it once", function() {
        const block = sinon.spy();
        new Observation(this.name, block);

        return block.should.be.calledOnce();
      });
    });
  });

  describe("::evaluation()", function() {
    it("returns the value if one was returned from the block", function() {
      const observation = new Observation(this.name, this.return);
      const evaluation = observation.evaluation();

      return evaluation.should.equal(this.value);
    });

    it("throws the error if one was thrown from the block", function() {
      return (function() { return new Observation(this.name, this.throw).evaluation(); })
      .should.throw(this.error);
    });

    return it("returns promises returned from the block without settling them", function() {
      const value = Promise.resolve();

      const observation = new Observation(this.name, _.constant(value));
      const evaluation = observation.evaluation();

      // We should be receiving the exact promise itself
      return evaluation.should.equal(value);
    });
  });

  describe("::settle()", function() {
    it("returns a promise that resolves into an observation", function() {
      const observation = new Observation(this.name, this.return, this.options);
      const settled = observation.settle();

      settled.should.be.instanceOf(Promise);
      settled.should.eventually.be.instanceOf(Observation);
      return settled.should.eventually.have.properties({
        name: this.name});
    });

    it("preserves synchronous return values", function() {
      const observation = new Observation(this.name, this.return, this.options);
      const settled = observation.settle();

      return settled.should.eventually.have.property('value').equal(this.value);
    });

    it("preserves synchronous thrown errors", function() {
      const observation = new Observation(this.name, this.throw, this.options);
      const settled = observation.settle();

      return settled.should.eventually.have.property('error').equal(this.error);
    });

    it("exposes asynchronous resolved values", function() {
      const observation = new Observation(this.name, Promise.method(this.return), this.options);
      const settled = observation.settle();

      return settled.should.eventually.have.property('value').equal(this.value);
    });

    it("exposes asynchronous rejected errors", function() {
      const observation = new Observation(this.name, Promise.method(this.throw), this.options);
      const settled = observation.settle();

      return settled.should.eventually.have.property('error').equal(this.error);
    });

    it("preserves start time", function() {
      return time(tick => {
        const observation = new Observation(this.name, this.return, this.options);
        tick(10);
        const settled = observation.settle();

        return settled.should.eventually.have
        .property('startTime', observation.startTime);
      });
    });

    it("computes total duration", function() {
      return time(tick => {
        const observation = new Observation(this.name, (() => tick(10)), this.options);
        tick(10);
        const settled = observation.settle();

        return settled.should.eventually.have
        .property('duration', 20);
      });
    });

    return it("does not call the block again", function() {
       const block = sinon.spy();
       const observation = new Observation(this.name, block, this.options);

       return observation.settle().then(() => block.should.be.calledOnce());
     });
  });

  describe("::map()", function() {
    it("takes a function and returns a new observation with a mapped value", function() {
      const observation = new Observation(this.name, this.return, this.options);

      const mapped = observation.map(value => {
        value.should.equal(this.value);
        return [this.value];
    });

      mapped.should.not.equal(observation);
      return mapped.value.should.eql([this.value]);
    });

    it("returns the same observation if the observation was an error", function() {
      const observation = new Observation(this.name, this.throw, this.options);

      const mapped = observation.map(value => [value]);

      mapped.should.equal(observation);
      return mapped.error.should.equal(this.error);
    });

    it("bubbles thrown errors in the mapping function", function() {
      const observation = new Observation(this.name, this.return, this.options);

      return (() => observation.map(this.throw)).should.throw(this.error);
    });

    return it("does not change the run duration", function() {
      const observation = new Observation(this.name, this.return, this.options);
      const {
        duration
      } = observation;

      return time(tick => {
        const mapped = observation.map(() => tick(1000));

        return mapped.duration.should.equal(duration);
      });
    });
  });

  describe("::didReturn()", function() {
    it("returns true if the block returned", function() {
      const observation = new Observation(this.name, this.return);
      return observation.didReturn().should.be.true();
    });

    return it("returns false if the block threw", function() {
      const observation = new Observation(this.name, this.throw);
      return observation.didReturn().should.be.false();
    });
  });

  describe("::ignores()", function() {
    it("returns false for non-observations", function() {
      const a = new Observation(this.name, this.return, this.options);

      return a.ignores({ value: this.value }).should.be.false();
    });

    it("returns false if there are no ignorers", function() {
      const a = new Observation(this.name, this.return, this.options);
      const b = new Observation(this.name, this.return, this.options);

      return a.ignores(b).should.be.false();
    });

    it("returns true if any ignorer predicates return true", function() {
      const a = new Observation(this.name, this.return, this.options);
      const b = new Observation(this.name, this.return, this.options);

      this.options.ignorers.push(_.constant(false), _.constant(false));
      a.ignores(b).should.be.false();

      this.options.ignorers.push(_.constant(true));
      return a.ignores(b).should.be.true();
    });

    return it("passes the two observations to each ignorer", function() {
      const spy = sinon.spy();
      const a = new Observation(this.name, this.return, this.options);
      const b = new Observation(this.name, this.return, this.options);

      this.options.ignorers.push(spy);
      a.ignores(b);

      return spy.should.be.calledWith(a, b);
    });
  });

  describe("::matches()", function() {
    it("returns false for non-observations", function() {
      const a = new Observation(this.name, this.return, this.options);

      return a.matches({ value: this.value }).should.be.false();
    });

    it("returns false if both did not return or both did not fail", function() {
      const a = new Observation(this.name, this.return, this.options);
      const b = new Observation(this.name, this.throw, this.options);

      a.matches(b).should.be.false();
      return b.matches(a).should.be.false();
    });

    it("uses the comparator for return values", function() {
      const a = new Observation(this.name, this.returning({ a: 1, b: 2 }), this.options);
      const b = new Observation(this.name, this.returning({ a: 1, b: 2 }), this.options);
      const c = new Observation(this.name, this.returning({ a: 1 }), this.options);

      // strict
      this.options.comparator = (a, b) => a === b;
      a.matches(b).should.be.false();
      a.matches(c).should.be.false();

      // fuzzy
      this.options.comparator = _.isEqual;
      a.matches(b).should.be.true();
      return a.matches(c).should.be.false();
    });

    return it("compares names and messages for thrown errors", function() {
      const a = new Observation(this.name, this.throwing(Error("fail")), this.options);
      const b = new Observation(this.name, this.throwing(Error("fail")), this.options);
      const c = new Observation(this.name, this.throwing(Error("failed")), this.options);
      const d = new Observation(this.name, this.throwing(TypeError("fail")), this.options);

      // Assert comparator is never called
      this.options.comparator = function() {
        throw Error("Comparator used; expected error comparison");
      };

      a.matches(b).should.be.true();
      a.matches(c).should.be.false();
      return a.matches(d).should.be.false();
    });
  });

  return describe("::inspect()", function() {
    it("stringifies error constructor and message", function() {
      const observation = new Observation(this.name, this.throwing(TypeError("fail")), this.options);

      return observation.inspect().should.equal(`\
error: [TypeError] 'fail'\
`
      );
    });

    it("stringifies values using inspect", function() {
      const observation = new Observation(this.name, this.returning({ a: 1, b: "c" }), this.options);

      return observation.inspect().should.equal(`\
value: { a: 1, b: 'c' }\
`
      );
    });

    it("forwards inspect options", function() {
      const observation = new Observation(this.name, this.returning({ a: 1, b: "c" }), this.options);

      return inspect(observation, {depth: -1}).should.equal(`\
value: [Object]\
`
      );
    });

    return it("cleans the value using the experiment", function() {
      this.options.cleaner = value => _.keys(value);
      const observation = new Observation(this.name, this.returning({ a: 0, b: "c" }), this.options);

      return observation.inspect().should.equal(`\
value: [ 'a', 'b' ]\
`
      );
    });
  });
});
