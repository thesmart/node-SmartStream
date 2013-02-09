var SmartStream = require('./smart_stream.js');
var util = require('util');
var _ = require('underscore');

/**
 * Takes an accumulated data payload and splits it up before sending the pieces downstream.
 *
 * @param {String} name				Name of this splitter
 *
 * @constructor
 * @extends {Stream}
 */
var SplitStream = function SplitStream(name) {
	SmartStream.call(this, name || 'SplitStream');

	/**
	 * pending data objects to flush
	 * @type {Array}
	 * @private
	 */
	this._buffer = [];

	this.setMiddlewareSync(this._middleWareSync.bind(this));
	this.setMiddlewareSync = null;
	this.setMiddleware = null;
	this.on('ending', this.startDrainCycle);
};
util.inherits(SplitStream, SmartStream);

/**
 * The default identify function. Replaced with a different function that return an array
 * of split-up data items, one cell per item.
 * @see SplitStream.prototype.setSplitterSync
 *
 * @param data
 * @return {*}
 * @private
 */
SplitStream.prototype._splitterFn = function(data) {
	return data;
};

/**
 * Set a function that will split data into individual items for downstream
 * @param {Function(data)} fn
 */
SplitStream.prototype.setSplitterSync = function(fn) {
	this._splitterFn = fn.bind(this);
};

/**
 * Start draining the buffer
 */
SplitStream.prototype.startDrainCycle = function() {
	if (this._isPaused) {
		// stop draining until resume
		this.once('drain', this._pumpDrainCycle.bind(this));
		return;
	}

	// clear a batch
	var item = this.deQueue();
	++this.countDownstream;
	this.emit('data', item);

	// pump it, pump it up
	process.nextTick(this._pumpDrainCycle.bind(this));
};

/**
 * 2nd-phase of the buffer pump
 * @private
 */
SplitStream.prototype._pumpDrainCycle = function() {
	if (this.isDrainedFully()) {
		// done or miss configured
		this.emit('empty');
		return;
	}

	if (!this._destStream || this._destStream.isDrained()) {
		// emit more data
		this.startDrainCycle();
	} else {
		// wait until drained, then send more
		this._destStream.once('drain', this.startDrainCycle.bind(this))
	}
};

/**
 * Synchronous middleware that accumulates messages
 * @param {*} data
 * @private
 */
SplitStream.prototype._middleWareSync = function(data) {
	var splitData = this._splitterFn(data);
	for (var i = 0, l = splitData.length; i < l; ++i) {
		this.enQueue(splitData[i])
	}

	if (this._isPaused) {
		// do not dequeue
		return;
	}

	this.startDrainCycle();
};

/**
 * Enqueue data in the accumulator
 * @param {*} data
 */
SplitStream.prototype.enQueue = function(data) {
	this._buffer.push(data);
};

/**
 * Dequeue a single data item
 * @return {*|undefined}
 */
SplitStream.prototype.deQueue = function() {
	if (!this._buffer.length) {
		return undefined;
	}

	return this._buffer.shift();
};

/**
 * True if this stream is completely drained, down to zero pending operations
 * @return {Boolean}
 * @private
 */
SplitStream.prototype.isDrainedFully = function() {
	return this.countPending === 0 && this._buffer.length === 0;
};

/**
 * buffer length
 * @return {Number}
 */
SplitStream.prototype.countBuffer = function() {
	return this._buffer.length;
};

module.exports = SplitStream;