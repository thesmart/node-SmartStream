var assert = require('assert');

module.exports.watchEvents = function watchEvents(streams, events) {
	var eventsSeen = [];
	events.forEach(function(event) {
		streams.forEach(function(stream) {
			stream.on(event, function(data) {
				assert.equal(stream, this, 'Stream event emitted, but scope is not the same as Stream instance');
				eventsSeen.push([this, event]);
			});
		});
	});
	return eventsSeen;
};

module.exports.assertSeen = function assertSeen(eventsSeen, stream, event) {
	var isSeen = false;
	eventsSeen.forEach(function(record) {
		if (record[0] === stream && record[1] === event) {
			isSeen = true;
			return false; // break
		}
	});
	assert.ok(isSeen, 'Event "' + event + '" not seen on Stream "' + stream.name + '"');
};

module.exports.assertNotSeen = function assertNotSeen(eventsSeen, stream, event) {
	var isSeen = false;
	eventsSeen.forEach(function(record) {
		if (record[0] === stream && record[1] === event) {
			isSeen = true;
			return false; // break
		}
	});
	assert.ok(!isSeen, 'Event "' + event + '" was not expected on Stream "' + stream.name + '"');
};

module.exports.holdData = function holdData(stream) {
	var pendingCallbacks = [];
	stream.setMiddleware(function(data, cb) {
		pendingCallbacks.push([data, cb]);
	});
	return pendingCallbacks;
};

module.exports.flushData = function flushData(pendingCallbacks) {
	// resolve c's work
	var callAll = [];
	while (pendingCallbacks.length) {
		var cbSet = pendingCallbacks.shift();
		callAll.push(cbSet);
	}

	callAll.forEach(function(cbSet) {
		cbSet[1](null, cbSet[0]);
	});
};