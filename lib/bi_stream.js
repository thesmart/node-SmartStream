var util = require('util');
var _ = require('underscore');
var AbstractStream = require('./abstract_stream.js');
var ConsumerStream = require('./consumer_stream.js');

/**
 * a concrete, bi-directional (readable & writable) stream that received data from upstream, and dispatches
 * data downstream.
 *
 * @param {String=} opt_name				Optional. Name for this stream
 * @param {Number=} opt_limitPending		Optional. Set a limit to the number of pending operations before signaling
 *
 * @constructor
 * @extends {ConsumerStream}
 */
var BiStream = function BiStream(opt_name, opt_limitPending) {
	ConsumerStream.call(this, opt_name, opt_limitPending);
	this.readable = true;

	/**
	 * Number of times data sent downstream
	 * @type {Number}
	 */
	this.countDownstream = 0;

	this.on('consumed', this._onConsumed.bind(this));
};
util.inherits(BiStream, ConsumerStream);

/**
* @param {*} result			Data to pass on downstream
* @private
*/
BiStream.prototype._onConsumed = function(result) {
	++this.countDownstream;
	this.emit('data', result);
};

/**
 * Pause the downstream production
 */
BiStream.prototype.pause = function() {
	this._isPaused = true;
	this.emit('pause');
};

/**
 * Resume the downstream production
 */
BiStream.prototype.resume = function() {
	this._isPaused = false;
	this.emit('resume');
};

/**
 * Called from an upstream data producer when it will produce no more data
 */
BiStream.prototype.end = function() {
	if (this._isDrained()) {
		this.destroySoon();
	} else {
		// once drained, destroy immediately
		this.once('drain', this.destroy.bind(this));
	}
};

/**
 * Destroy the producer stream
 */
BiStream.prototype.destroy = function() {
	this._isClosed = true;
	process.nextTick(this.emit.bind(this, 'end'));
	if (!this._destStream) {
		process.nextTick(this.emit.bind(this, 'close'));
	}
};

module.exports = BiStream;