var Stream = require('stream').Stream;
var util = require('util');

/**
 * abstract stream
 *
 * @param {String=} opt_name				Optional. Name for this stream
 *
 * @constructor
 * @extends {Stream}
 */
var AbstractStream = function AbstractStream(opt_name) {
	Stream.call(this);
	this.readable = false;
	this.writable = false;

	/**
	 * Name of this stream
	 * @type {String}
	 */
	this.name = opt_name || this.constructor.name || '??';

	/**
	 * Stream is no longer writable nor readable. The stream will not emit any more 'data', or 'end' events.
	 * @type {Boolean}
	 * @private
	 */
	this._isClosed = false;

	/**
	 * Destination stream
	 * @type {Stream}
	 * @private
	 */
	this._destStream = undefined;
};
util.inherits(AbstractStream, Stream);

/**
 * A stream to pipe to
 * @param {Stream} dest			Downstream destination
 * @param {Object=} options		Optional.
 * @return {Stream} destination stream
 */
AbstractStream.prototype.pipe = function(dest, options) {
	Stream.prototype.pipe.call(this, dest, options);
	this._destStream = dest;
	return dest;
};

/**
 * Destroy the stream immediately
 */
AbstractStream.prototype.destroy = function() {
	this.destroy = function() {};
	this._isClosed = true;
	process.nextTick(this.emit.bind(this, 'close'));
};

module.exports = AbstractStream;