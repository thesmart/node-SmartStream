// for testing, use http://visionmedia.github.com/mocha/

var SmartStream = require('../index.js').SmartStream;
var AccStream = require('../index.js').AccStream;
var assert = require('assert');

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

describe('AccStream', function() {
	it('write', function(done) {
		var p = new AccStream('p', 1);
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

	it('middleware', function(done) {
		var p = new AccStream('p', 1);
		var c = new SmartStream('c');
		p.pipe(c);

		c.setMiddleware(function(data, cb) {
			// modify downstream
			assert.equal(c, this);
			assert.equal(1, this.countPending);
			assert.equal(1, p.countPending);
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
		var p = new AccStream('p', 2);
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
		p.write('hello world!');
	});

	it('resume', function(done) {
		var p = new SmartStream('p');
		var m = new AccStream('m', 2);
		var c = new SmartStream('c', 2);
		p.pipe(m).pipe(c);

		var pendingCallbacks = holdData(c);

		p.write('a');

		setTimeout(function() {
			// nothing should be written yet to c
			assert.equal(0, p.countPending);
			assert.equal(0, m.countPending);
			assert.equal(1, m.countBuffer());
			assert.equal(0, c.countPending);
			assert.ok(!p._isPaused);
			assert.ok(!m._isPaused);
			assert.ok(!c._isPaused);
			p.write('b');

			setTimeout(function() {
				// now one item containing [a,b] should be pending in c
				assert.equal(0, p.countPending);
				assert.equal(0, m.countPending);
				assert.equal(0, m.countBuffer());
				assert.equal(1, c.countPending);
				assert.ok(!p._isPaused);
				assert.ok(!m._isPaused);
				assert.ok(!c._isPaused);

				// writing two items to m (i.e. 1 item containing [c,d] to c) should pause m, then p
				p.write('c');
				p.write('d');

				setTimeout(function() {
					assert.equal(0, p.countPending);
					assert.equal(0, m.countPending);
					assert.equal(0, m.countBuffer());
					assert.equal(2, c.countPending);
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
		var m = new AccStream('m', 2);
		var c = new SmartStream('c', 1);
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
			// now that things have ended, m should still hold on to 'c' until c is unpaused
			assert.ok(p._isClosed);
			assert.ok(!m._isClosed);
			assert.ok(!c._isClosed);
			assert.equal(1, m.countBuffer());

			assertSeen(eventsSeen, p, 'data');
			assertSeen(eventsSeen, p, 'ending');
			assertSeen(eventsSeen, p, 'end');
			assertSeen(eventsSeen, m, 'data');
			assertSeen(eventsSeen, m, 'empty');
			assertSeen(eventsSeen, m, 'ending');

			assertNotSeen(eventsSeen, c, 'data');
			flushData(pendingCallbacks);

			setTimeout(function() {
				flushData(pendingCallbacks);

				// now that c is unpaused, 'c' should be pumped into c
				assertSeen(eventsSeen, c, 'data');
				assertSeen(eventsSeen, c, 'empty');
				assertSeen(eventsSeen, c, 'close');
				assert.equal(0, m.countBuffer());
				assert.ok(c._isClosed);

				done();
			}, 10);
		}, 10);
	});
});