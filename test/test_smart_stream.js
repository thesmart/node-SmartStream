// for testing, use http://visionmedia.github.com/mocha/

var SmartStream = require('../index.js').SmartStream;
var assert = require('assert');
var util = require('util');

function watchEvents(streams, events) {
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
}

function assertSeen(eventsSeen, stream, event) {
	var isSeen = false;
	eventsSeen.forEach(function(record) {
		if (record[0] === stream && record[1] === event) {
			isSeen = true;
			return false; // break
		}
	});
	assert.ok(isSeen, 'Event "' + event + '" not seen on Stream "' + stream.name + '"');
}

function assertNotSeen(eventsSeen, stream, event) {
	var isSeen = false;
	eventsSeen.forEach(function(record) {
		if (record[0] === stream && record[1] === event) {
			isSeen = true;
			return false; // break
		}
	});
	assert.ok(!isSeen, 'Event "' + event + '" was not expected on Stream "' + stream.name + '"');
}

function holdData(stream) {
	var pendingCallbacks = [];
	stream.setMiddleware(function(data, cb) {
		pendingCallbacks.push([data, cb]);
	});
	return pendingCallbacks;
}

function flushData(pendingCallbacks) {
	// resolve c's work
	pendingCallbacks.forEach(function(cbSet) {
		cbSet[1](null, cbSet[0]);
	});
}

describe('SmartStream', function() {
	it('write', function(done) {
		var p = new SmartStream('p');
		var c = new SmartStream('c');
		p.pipe(c);

		var eventsSeen = watchEvents([p, c], ['data','drain','empty']);

		setTimeout(function() {
			assert.equal(1, p.countUpstream);
			assert.equal(0, p.countPending);
			assert.equal(1, p.countDownstream);

			assert.equal(1, c.countUpstream);
			assert.equal(0, c.countPending);
			assert.equal(1, c.countDownstream);

			assertSeen(eventsSeen, p, 'data');
			assertSeen(eventsSeen, c, 'data');
			assertSeen(eventsSeen, p, 'drain');
			assertSeen(eventsSeen, c, 'drain');
			assertSeen(eventsSeen, p, 'empty');
			assertSeen(eventsSeen, c, 'empty');

			done();
		}, 50);

		p.write('hello world!');
	});

	it('write with preload', function(done) {
		var p = new SmartStream('p');
		var c = new SmartStream('c');
		c.setPreloadMiddleware(function(done) {
			setTimeout(done, 10);
		});
		p.pipe(c);

		var eventsSeen = watchEvents([p, c], ['data','drain','empty']);

		setTimeout(function() {
			assert.equal(1, p.countUpstream);
			assert.equal(0, p.countPending);
			assert.equal(1, p.countDownstream);

			assert.equal(1, c.countUpstream);
			assert.equal(0, c.countPending);
			assert.equal(1, c.countDownstream);

			assertSeen(eventsSeen, p, 'data');
			assertSeen(eventsSeen, c, 'data');
			assertSeen(eventsSeen, p, 'drain');
			assertSeen(eventsSeen, c, 'drain');
			assertSeen(eventsSeen, p, 'empty');
			assertSeen(eventsSeen, c, 'empty');

			done();
		}, 50);

		p.write('hello world!');
	});

	it('middleware', function(done) {
		var p = new SmartStream('p');
		var c = new SmartStream('c');
		p.pipe(c);

		c.setMiddleware(function(data, cb) {
			// modify downstream
			assert.equal(c, this);
			assert.equal(1, this.countPending);
			assert.equal(0, p.countPending);
			cb(null, data + ' goodbye moon.');
		});

		var eventsSeen = watchEvents([p, c], ['data','drain','empty']);

		var wasDataModified = false;
		c.on('data', function(data) {
			assert.equal('hello world! goodbye moon.', data);
			wasDataModified = true;
		});

		setTimeout(function() {
			assert.equal(1, p.countUpstream);
			assert.equal(0, p.countPending);
			assert.equal(1, p.countDownstream);

			assert.equal(1, c.countUpstream);
			assert.equal(0, c.countPending);
			assert.equal(1, c.countDownstream);

			assertSeen(eventsSeen, p, 'data');
			assertSeen(eventsSeen, c, 'data');
			assertSeen(eventsSeen, p, 'drain');
			assertSeen(eventsSeen, c, 'drain');
			assertSeen(eventsSeen, p, 'empty');
			assertSeen(eventsSeen, c, 'empty');

			assert.ok(wasDataModified);

			done();
		}, 10);

		p.write('hello world!');
	});

	it('middleware with preload', function(done) {
		var p = new SmartStream('p');
		var c = new SmartStream('c');
		c.setPreloadMiddleware(function(done) {
			setTimeout(done, 2);
		});
		p.pipe(c);

		c.setMiddleware(function(data, cb) {
			// modify downstream
			assert.equal(c, this);
			assert.equal(1, this.countPending);
			assert.equal(0, p.countPending);
			cb(null, data + ' goodbye moon.');
		});

		var eventsSeen = watchEvents([p, c], ['data','drain','empty']);

		var wasDataModified = false;
		c.on('data', function(data) {
			assert.equal('hello world! goodbye moon.', data);
			wasDataModified = true;
		});

		setTimeout(function() {
			assert.equal(1, p.countUpstream);
			assert.equal(0, p.countPending);
			assert.equal(1, p.countDownstream);

			assert.equal(1, c.countUpstream);
			assert.equal(0, c.countPending);
			assert.equal(1, c.countDownstream);

			assertSeen(eventsSeen, p, 'data');
			assertSeen(eventsSeen, c, 'data');
			assertSeen(eventsSeen, p, 'drain');
			assertSeen(eventsSeen, c, 'drain');
			assertSeen(eventsSeen, p, 'empty');
			assertSeen(eventsSeen, c, 'empty');

			assert.ok(wasDataModified);

			done();
		}, 10);

		p.write('hello world!');
	});

	it('pause', function(done) {
		var p = new SmartStream('p');
		var c = new SmartStream('c', 1);
		p.pipe(c);

		c.setMiddleware(function(data, cb) {
			assert.equal(1, this.countUpstream);
			assert.equal(1, this.countPending);
			assert.equal(0, this.countDownstream);
		});

		p.on('pause', function() {
			assert.equal(p, this);
			assert.ok(this._isPaused);
			assert.ok(!c._isPaused);
			assert.equal(1, c.countPending);
			done();
		});

		p.write('hello world!');
	});

	it('resume', function(done) {
		var p = new SmartStream('p');
		var m = new SmartStream('m');
		var c = new SmartStream('c', 3);
		p.pipe(m).pipe(c);

		var pendingCallbacks = holdData(c);

		p.write('a');

		setTimeout(function() {
			assert.equal(0, p.countPending);
			assert.equal(0, m.countPending);
			assert.equal(1, c.countPending);
			assert.ok(!p._isPaused);
			assert.ok(!m._isPaused);
			assert.ok(!c._isPaused);
			p.write('b');

			setTimeout(function() {
				assert.equal(0, p.countPending);
				assert.equal(0, m.countPending);
				assert.equal(2, c.countPending);
				assert.ok(!p._isPaused);
				assert.ok(!m._isPaused);
				assert.ok(!c._isPaused);
				p.write('c');

				setTimeout(function() {
					assert.equal(0, p.countPending);
					assert.equal(0, m.countPending);
					assert.equal(3, c.countPending);
					assert.ok(p._isPaused);
					assert.ok(m._isPaused);
					assert.ok(!c._isPaused);

					// resolve c's work
					flushData(pendingCallbacks);
					assert.equal(0, c.countPending);

					setTimeout(function() {
						assert.ok(!c._isPaused);
						assert.ok(!m._isPaused);
						assert.ok(!p._isPaused);
						done();
					}, 10);
				}, 10);
			}, 10);
		}, 10);
	});

	it('end', function(done) {
		var p = new SmartStream('p');
		var m = new SmartStream('m');
		var c = new SmartStream('c', 3);
		p.pipe(m).pipe(c);

		var pendingCallbacks = holdData(c);
		var eventsSeen = watchEvents([p, m, c], ['data', 'ending', 'end', 'close', 'empty']);

		p.write('a');
		p.write('b');
		p.write('c');
		p.end();

		assert.ok(!c._isClosed);
		assert.ok(!m._isClosed);
		assert.ok(!p._isClosed);

		setTimeout(function() {
			assert.ok(p._isClosed);
			assert.ok(m._isClosed);
			assert.ok(!c._isClosed);

			assertSeen(eventsSeen, p, 'data');
			assertSeen(eventsSeen, p, 'ending');
			assertSeen(eventsSeen, p, 'end');
			assertSeen(eventsSeen, m, 'data');
			assertSeen(eventsSeen, m, 'ending');
			assertSeen(eventsSeen, m, 'end');
			assertSeen(eventsSeen, c, 'ending');

			assertNotSeen(eventsSeen, c, 'data');
			flushData(pendingCallbacks);

			setTimeout(function() {
				assertSeen(eventsSeen, c, 'data');
				assertSeen(eventsSeen, c, 'empty');
				assertSeen(eventsSeen, c, 'end');
				assert.ok(c._isClosed);

				done();
			}, 10);
		}, 10);
	});

	it('errors sync', function(done) {
		var p = new SmartStream('p');
		var c = new SmartStream('c');
		p.pipe(c);

		c.setMiddlewareSync(function() {
			throw new Error('middleware');
		});

		c.on('error', function() {
			assert.equal(0, c.countPending);
			done();
		});

		p.write('a');
	});

	it('errors async', function(done) {
		var p = new SmartStream('p');
		var c = new SmartStream('c');
		p.pipe(c);

		c.setMiddleware(function(data, next) {
			throw new Error('middleware');
		});

		c.on('error', function() {
			assert.equal(0, c.countPending);
			done();
		});

		p.write('a');
	});
});