var SmartStream = require('./smart_stream.js');
var util = require('util');
var _ = require('underscore');

/**
 * Accumulates data items into batches before sending them downstream.
 *
 * @param {Number} batchCount		Number of items to collect in the buffer before pausing down-stream
 * @param {String} opt_name			Optional. Name of this accumulator
 *
 * @constructor
 * @extends {Stream}
 */
var AccStream = function AccStream(batchCount, opt_name) {
	SmartStream.call(this, opt_name || 'AccStream');

	/**
	 * pending data objects to flush
	 * @type {Array}
	 * @private
	 */
	this._buffer = [];

	/**
	 * The size of the accumulated payload
	 * @type {Number}
	 * @private
	 */
	this._batchCount = batchCount || 1;

	this.setMiddlewareSync(this._middleWareSync.bind(this));
	this.setMiddlewareSync = null;
	this.setMiddleware = null;
	this.on('ending', this.startDrainCycle);
};
util.inherits(AccStream, SmartStream);

/**
 * Start draining the buffer
 */
AccStream.prototype.startDrainCycle = function() {
	if (this._isPaused) {
		// stop draining until resume
		this.once('drain', this._pumpDrainCycle.bind(this));
		return;
	}

	// clear a batch
	var batch = this.deQueueBatch();
	++this.countDownstream;
	this.emitLater('data', batch);

	// pump it, pump it up
	process.nextTick(this._pumpDrainCycle.bind(this));
};

/**
 * 2nd-phase of the buffer pump
 * @private
 */
AccStream.prototype._pumpDrainCycle = function() {
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
AccStream.prototype._middleWareSync = function(data) {
	this.enQueue(data);
	if (this._isPaused) {
		// do not dequeue
		return;
	} else if (this._buffer.length >= this._batchCount) {
		var batch = this.deQueueBatch();
		++this.countDownstream;
		this.emitLater('data', batch);
	}
};

/**
 * Enqueue data in the accumulator
 * @param {*} data
 */
AccStream.prototype.enQueue = function(data) {
	this._buffer.push(data);
};

/**
 * Dequeue a batch of up to 50 data items
 * @return {Array}
 */
AccStream.prototype.deQueueBatch = function() {
	var threshold = Math.min(this._buffer.length, this._batchCount);
	var subBuffer = this._buffer.slice(0, threshold);
	this._buffer = this._buffer.slice(threshold);
	return subBuffer;
};

/**
 * True if this stream is completely drained, down to zero pending operations
 * @return {Boolean}
 * @private
 */
AccStream.prototype.isDrainedFully = function() {
	return this.countPending === 0 && this._buffer.length === 0;
};

/**
 * buffer length
 * @return {Number}
 */
AccStream.prototype.countBuffer = function() {
	return this._buffer.length;
};

module.exports = AccStream;