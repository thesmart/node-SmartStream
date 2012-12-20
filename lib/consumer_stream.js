var util = require('util');
var AbstractStream = require('./abstract_stream.js');

/**
 * a concrete, consumer (writable) stream that received data from upstream
 *
 * @param {String=} opt_name				Optional. Name for this stream
 * @param {Number=} opt_limitPending		Optional. Set a limit to the number of pending operations before signaling
 *
 * @constructor
 * @extends {Stream}
 */
var ConsumerStream = function ConsumerStream(opt_name, opt_limitPending) {
	AbstractStream.call(this, opt_name);
	this.readable = false;
	this.writable = true;

	/**
	 * @type {Boolean}
	 * @private
	 */
	this._isPaused = false;

	/**
	 * Limit the number of outstanding pending operations by request pause upstream
	 * @type {Number}
	 * @private
	 */
	this._limitPending = opt_limitPending || undefined;

	/**
	 * Number of times data sent from upstream
	 * @type {Number}
	 */
	this.countUpstream = 0;

	/**
	 * Count the number of pending data items needing processing
	 * @type {Number}
	 */
	this.countPending = 0;

	/**
	 * A data handler function, called between consumer / producer phases
	 * @type {Function}
	 * @private
	 */
	this._middlewareFn = null;
};
util.inherits(ConsumerStream, AbstractStream);

/**
 * Call this function to handle data
 * @param {Function} fn		e.g. fn(data, cb)
 * @return {self} chain
 */
ConsumerStream.prototype.setMiddleware = function(fn) {
	this._middlewareFn = fn;
	return this;
};

/**
 * True if this stream is drained
 * @return {Boolean}
 * @private
 */
ConsumerStream.prototype._isDrained = function() {
	return this.countPending === 0;
};

/**
 * Called from an upstream data producer when it has produced data
 * @param {*} data
 * @return {Boolean}		True if everything is fine. False if upstream should pause.
 */
ConsumerStream.prototype.write = function(data) {
	if (this._isClosed) {
		this.emit(new Error('attempting to write to a closed stream "' + this.name));
		return false;
	}

	++this.countUpstream;
	this._onPreConsume(data);

	if (this._middlewareFn) {
		this._middlewareFn.call(this, data, this._onPostConsume.bind(this));
	} else {
		this._onPostConsume(null, data);
	}

	if (this._isPaused) {
		// pause upstream
		return false;
	} else if (this._limitPending && this.countPending >= this._limitPending) {
		return false;
	}

	return true;
};

ConsumerStream.prototype._onPreConsume = function(data) {
	++this.countPending;
};

/**
 * Called once data is consumed
 * @param err
 * @param result
 * @private
 */
ConsumerStream.prototype._onPostConsume = function(err, result) {
	--this.countPending;

	if (err) {
		this.emit('error', err);
	} else if (result !== undefined) {
		this.emit('consumed', result);
	}

	if (this._isDrained()) {
		this.emit('drain');
	}
};

/**
 * Called from an upstream data producer when it will produce no more data
 */
ConsumerStream.prototype.end = function() {
	this.destroySoon();
};

/**
 * Destroy the consumer stream after draining the buffer.
 */
ConsumerStream.prototype.destroySoon = function() {
	if (this._isDrained()) {
		// immediately
		this.destroy();
	} else {
		// once drained, destroy immediately
		this.once('drain', this.destroy.bind(this));
	}
};

module.exports = ConsumerStream;