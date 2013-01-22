var util = require('util');
var Stream = require('stream').Stream;

/**
 * A Stream that makes it easy to write custom stream implementations and Stream middleware.
 *
 * @param {String=} name				Name for this stream
 * @param {Number=} opt_limitPending	Optional. Set a limit to the number of pending operations before pausing the upstream pipeline
 *
 * @constructor
 * @extends {Stream}
 */
var SmartStream = function SmartStream(name, opt_limitPending) {
	Stream.call(this);
	this.readable = false;
	this.writable = true;

	/**
	 * Name of this stream
	 * @type {String}
	 */
	this.name = name || this.constructor.name || '??';

	/**
	 * Destination stream, downstream
	 * @type {Stream}
	 * @private
	 */
	this._destStream = undefined;

	/**
	 * Set to true when this stream is asked to paused by downstream Streams
	 * @type {Boolean}
	 * @private
	 */
	this._isPaused = false;

	/**
	 * Stream is no longer writable nor readable. The stream will not emit any more 'data', or 'end' events.
	 * @type {Boolean}
	 * @private
	 */
	this._isClosed = false;

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
	 * Number of times data sent downstream
	 * @type {Number}
	 */
	this.countDownstream = 0;

	/**
	 * A data handler function, called between consumer / producer phases
	 * @type {Function}
	 * @private
	 */
	this._middlewareFn = null;

	this.setMaxListeners(25);
};
util.inherits(SmartStream, Stream);

/**
 * Get the destination Stream, if one is piped to
 */
SmartStream.prototype.destStream = function() {
	return this._destStream;
};

/**
 * Link with a stream to pipe to (this is upstream, dest is downstream)
 * @param {Stream} dest			Downstream destination
 * @return {Stream} destination stream
 */
SmartStream.prototype.pipe = function(dest) {
	this.readable = true;
	this._destStream = dest;
	this._destStream.on('pause', this.pause.bind(this));

	Stream.prototype.pipe.call(this, dest);
	return this._destStream;
};

/**
 * Call this function to handle data
 * @param {Function} fn		e.g. fn(data, cb)
 * @return {self} chain
 */
SmartStream.prototype.setMiddleware = function(fn) {
	this._middlewareFn = fn;
	return this;
};

/**
 * Call this function synchronously to handle data.  Whatever is returned will be sent to the downstream pipeline.
 * @param {Function} fn		e.g. fn(data)
 * @return {self} chain
 */
SmartStream.prototype.setMiddlewareSync = function(fn) {
	this._middlewareFn = fn;
	this._middlewareFn.isSync = true;
	return this;
};


/**
 * True if this stream is ready for more operations
 * @return {Boolean}
 * @private
 */
SmartStream.prototype.isDrained = function() {
	if (this._limitPending) {
		if (this._limitPending > 5) {
			// at 80% limit, consider drained
			return this.countPending < Math.floor(this._limitPending * 0.80);
		} else {
			// at 50% limit, consider drained
			return this.countPending < Math.floor(this._limitPending * 0.50);
		}
	}
	return this.countPending === 0;
};

/**
 * True if this stream is completely drained, down to zero pending operations
 * @return {Boolean}
 * @private
 */
SmartStream.prototype.isDrainedFully = function() {
	return this.countPending === 0;
};

/**
 * Is the stream at its overflow limit?
 * @return {Boolean}
 * @private
 */
SmartStream.prototype.isOverFlow = function() {
	if (!this._limitPending) {
		return false;
	}

	return this.countPending >= this._limitPending;
};

/**
 * Called from an upstream data producer when it has produced data
 * @param {*} data
 * @return {Boolean}		True if everything is fine. False if upstream should pause.
 */
SmartStream.prototype.write = function(data) {
	if (this._isClosed) {
		this.emit('error', new Error('attempting to write to a closed stream "' + this.name + '"'));
		return false;
	} else if (data === undefined) {
		// signal to close
		this.end();
		return true;
	}

	++this.countUpstream;
	++this.countPending;

	if (this._middlewareFn) {
		try {
			if (this._middlewareFn.isSync) {
				var result = this._middlewareFn.call(this, data);
				this._onPostConsume(null, result);
			} else {
				this._middlewareFn.call(this, data, this._onPostConsume.bind(this));
			}
		} catch (err) {
			this._onPostConsume(err, undefined);
		}
	} else {
		this._onPostConsume(null, data);
	}

	if (this._isPaused) {
		// we're paused, so pause upstream
		return false;
	}

	// ask to pause if not ready for more work
	return !this.isOverFlow();
};

/**
 * Called once data is consumed
 * @param {Error} err
 * @param {*} result
 * @private
 */
SmartStream.prototype._onPostConsume = function(err, result) {
	if (this._isClosed) {
		// do nothing, leave in purgatory
		return;
	}

	--this.countPending;

	if (err) {
		this.emit('error', err);
	} else if (result !== undefined) {
		++this.countDownstream;
		this.emit('data', result);
	}

	if (this.isDrained() && !this._isPaused) {
		this.emit('drain');
	}

	if (this.isDrainedFully()) {
		this.emit('empty');
	}
};

/**
 * Pause the downstream production
 */
SmartStream.prototype.pause = function() {
	if (this._isPaused || this._isClosed) {
		return;
	}

	this._isPaused = true;
	this.emit('pause');
};

/**
 * Resume the downstream production
 */
SmartStream.prototype.resume = function() {
	if (!this._isPaused || this._isClosed) {
		return;
	}

	this._isPaused = false;

	// signal to start sending this stream more data
	this.emit('drain');
};

/**
 * Called from an upstream data producer when it will produce no more data
 */
SmartStream.prototype.end = function() {
	this.end = function() {}; // call once

	this.emit('ending');
	this.destroySoon();
};

/**
 * Destroy the consumer stream after draining the buffer.
 */
SmartStream.prototype.destroySoon = function() {
	this.destroySoon = function() {}; // call once

	if (this.isDrainedFully()) {
		// immediately
		process.nextTick(this.destroy.bind(this));
	} else {
		// once drained, destroy immediately
		this.once('empty', this.destroy.bind(this));
	}
};

/**
 * Destroy the stream immediately
 */
SmartStream.prototype.destroy = function() {
	if (this._isClosed) {
		return;
	}
	this._isClosed = true;

	// signal the end for writing downstream
	this.emit('end');
	if (!this._destStream) {
		// only close if there is no destination stream
		this.emit('close');
	}
};

module.exports = SmartStream;