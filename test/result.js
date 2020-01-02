/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Promise = require('bluebird');
const sinon = require('sinon');

const Experiment = require('../src/experiment');
const Observation = require('../src/observation');
const Result = require('../src/result');

describe("Lib: Scientist: Result", function() {
  beforeEach(function() {
    this.experiment = new Experiment("test");
    this.control = new Observation("control", (() => 1), this.experiment._options);
    return this.candidates = [
      new Observation("candidate0", (() => 1), this.experiment._options),
      new Observation("candidate1", (() => 2), this.experiment._options),
      new Observation("candidate2", (function() { throw Error(1); }), this.experiment._options)
    ];});

  return describe("constructor", function() {
    it("exposes the experiment, context, and observations", function() {
      const context = { a: {}, b: [] };
      this.experiment.context(context);
      const result = new Result(this.experiment, this.control, this.candidates);

      return result.should.have.properties({
        experiment: this.experiment,
        context,
        control: this.control,
        candidates: this.candidates
      });
    });

    it("exposes an array of ignored observations", function() {
      this.experiment.ignore((control, candidate) => candidate.value === 2);
      const result = new Result(this.experiment, this.control, this.candidates);

      return result.should.have.property('ignored').eql([this.candidates[1]]);
  });

    it("exposes an array of matched observations", function() {
      const result = new Result(this.experiment, this.control, this.candidates);

      return result.should.have.property('matched').eql([this.candidates[0]]);
  });

    it("exposes an array of mismatched observations", function() {
      const result = new Result(this.experiment, this.control, this.candidates);

      return result.should.have.property('mismatched').eql(this.candidates.slice(1, 3));
  });

    return it("removes ignored observations from matched and mismatched", function() {
      const spy = sinon.spy();
      this.experiment.ignore(() => true);
      this.experiment.compare(spy);

      const result = new Result(this.experiment, this.control, this.candidates);

      result.should.have.property('ignored').eql(this.candidates);
      result.should.have.property('matched').eql([]);
      result.should.have.property('mismatched').eql([]);
      return spy.should.not.be.called();
    });
  });
});
