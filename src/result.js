const _ = require('underscore');

class Result {
  constructor(experiment, control, candidates) {
    this.experiment = experiment;
    this.context = experiment.context();
    this.control = control;
    this.candidates = candidates;

    // Calculate ignored, matching, and mismatching candidates
    this.ignored = _.select(candidates, candidate => control.ignores(candidate));
    const comparable = _.difference(candidates, this.ignored);
    this.matched = _.select(comparable, candidate => control.matches(candidate));
    this.mismatched = _.difference(comparable, this.matched);

    // Immutable
    Object.freeze(this);
  }
}

module.exports = Result;
