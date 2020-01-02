/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const {
  EventEmitter
} = require('events');

const Experiment = require('./experiment');

class Scientist extends EventEmitter {
  constructor() {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
      eval(`${thisName} = this;`);
    }
    this._sampler = _.constant(true);
  }

  sample(sampler) { return this._sampler = sampler; }

  science(name, setup) {
    const experiment = new Experiment(name);
    setup(experiment);

    this.emit('experiment', experiment);

    // Proxy events from experiments
    experiment.on('skip', EventEmitter.prototype.emit.bind(this, 'skip'));
    experiment.on('result', EventEmitter.prototype.emit.bind(this, 'result'));
    experiment.on('error', EventEmitter.prototype.emit.bind(this, 'error'));
    return experiment.run(this._sampler);
  }
}

module.exports = Scientist;
