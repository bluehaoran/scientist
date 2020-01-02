/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const sinon = require('sinon');

const Measurement = require('../src/measurement');

const time = require('./helpers/time');

describe("Measurement", function() {
  beforeEach(function() {
    return this.measurement = Measurement.benchmark(function() {});
  });
  describe(".benchmark()", function() {
    it("runs a block and returns a new measurement", function() {
      const block = sinon.spy();
      const measurement = Measurement.benchmark(block);

      block.should.be.calledOnce();
      return measurement.should.be.instanceof(Measurement);
    });

    return it("captures the time elapsed", () => time(function(tick) {
      const measurement = Measurement.benchmark(() => tick(10));
      return measurement.elapsed.should.equal(10);
    }));
  });

  describe("::remeasure()", function() {
    it("calls the block and returns a new measurement", function() {
      const block = sinon.spy();
      const remeasurement = this.measurement.remeasure(block);

      block.should.be.calledOnce();
      remeasurement.should.be.instanceof(Measurement);
      return remeasurement.should.not.equal(this.measurement);
    });

    return it("extends the elapsed time to the end of the new block", () => time(tick => {
      const measurement = Measurement.benchmark(() => tick(10));
      tick(10);
      const remeasurement = measurement.remeasure(() => tick(10));

      return remeasurement.elapsed.should.equal(30);
    }));
  });

  return describe("::preserve()", () => it("calls the block and returns the same measurement", function() {
    const block = sinon.spy();
    const remeasurement = this.measurement.preserve(block);

    block.should.be.calledOnce();
    remeasurement.should.be.instanceof(Measurement);
    return remeasurement.should.equal(this.measurement);
  }));
});
