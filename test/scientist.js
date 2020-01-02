/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const Promise = require('bluebird');
const sinon = require('sinon');

const Scientist = require('../src/scientist');

describe("Scientist", function() {
  beforeEach(function() {
    return this.scientist = new Scientist();
  });

  describe("::science()", function() {
    it("sets up and runs an experiment", function() {
      const value = {};
      const setup = experiment => experiment.use(_.constant(value));

      return this.scientist.science("test", setup).should.equal(value);
    });

    it("proxies result events from the experiment onto itself", function() {
      return new Promise((resolve, reject) => {
        this.scientist.on('result', resolve);
        return this.scientist.science("test", function(e) {
          e.use(_.noop);
          return e.try(_.noop);
        });
      });
    });

    it("proxies error events from the experiment onto itself", function() {
      return new Promise((resolve, reject) => {
        this.scientist.on('error', resolve);
        return this.scientist.science("test", function(e) {
          e.map(function() { throw Error(); });
          e.use(_.noop);
          return e.try(_.noop);
        });
      });
    });

    return it("uses the configured sampler for the experiment", function() {
      const control = sinon.spy();
      const candidate = sinon.spy();

      this.scientist.sample(_.constant(false));
      this.scientist.science("test", function(e) {
        e.use(control);
        return e.try(candidate);
      });

      control.should.be.calledOnce();
      return candidate.should.not.be.called();
    });
  });

  return describe("::sample()", () => it("takes a function to use as the sampler", function() {
    const sampler = (function() {});
    this.scientist.sample(sampler);

    return this.scientist._sampler.should.equal(sampler);
  }));
});
