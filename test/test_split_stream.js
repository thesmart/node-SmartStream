// for testing, use http://visionmedia.github.com/mocha/

var SmartStream = require('../index.js').SmartStream;
var AccStream = require('../index.js').AccStream;
var SplitStream = require('../index.js').SplitStream;
var testUtils = require('../lib/test/stream_test_utils.js');
var assert = require('assert');



describe('SplitStream', function() {
	it.skip('write', function(done) {
		var p = new SplitStream('p');
		p.setSplitterSync(function(data) {
			return data.split(' ');
		});

		var c = new SmartStream('c');

		p.pipe(c);

		var eventsSeen = testUtils.watchEvents([p, c], ['data','drain','empty']);

		setTimeout(function() {
			assert.equal(1, p.countUpstream);
			assert.equal(0, p.countPending);
			assert.equal(2, p.countDownstream);

			assert.equal(2, c.countUpstream);
			assert.equal(0, c.countPending);
			assert.equal(2, c.countDownstream);

			testUtils.assertSeen(eventsSeen, p, 'data');
			testUtils.assertSeen(eventsSeen, c, 'data');
			testUtils.assertSeen(eventsSeen, p, 'drain');
			testUtils.assertSeen(eventsSeen, c, 'drain');
			testUtils.assertSeen(eventsSeen, p, 'empty');
			testUtils.assertSeen(eventsSeen, c, 'empty');

			done();
		}, 50);

		p.write('hello world!');
	});

	it.skip('pause', function(done) {
		var p = new SplitStream('p');
		p.setSplitterSync(function(data) {
			return data.split(' ');
		});

		var c = new SmartStream('c', 1);
		c.setMiddleware(function(data, cb) {
			assert.equal(1, this.countUpstream);
			assert.equal(1, this.countPending);
			assert.equal(0, this.countDownstream);
			assert.equal('hello', data);
		});

		p.on('pause', function() {
			assert.equal(p, this);
			assert.ok(this._isPaused);
			assert.ok(!c._isPaused);
			assert.equal(1, c.countPending);
			done();
		});

		p.pipe(c);
		p.write('hello world!');
		p.write('hello world!');
	});

	it.skip('resume', function(done) {
		var p = new SmartStream('p');
		var m = new SplitStream('m');
		m.setSplitterSync(function(data) {
			return data.split(' ');
		});
		var c = new SmartStream('c', 2);
		p.pipe(m).pipe(c);

		var pendingCallbacks = testUtils.holdData(c);

		p.write('a b c d');

		process.nextTick(function() {
			// nothing should be written yet to c
			assert.equal(1, p.countDownstream);
			assert.equal(0, p.countPending);
			assert.equal(0, m.countPending);
			assert.equal(2, m.countDownstream);
			assert.equal(2, m.countBuffer());
			assert.equal(2, c.countUpstream);
			assert.equal(2, c.countPending);
			assert.ok(p._isPaused);
			assert.ok(m._isPaused);
			assert.ok(!c._isPaused);
			p.write('e');

			process.nextTick(function() {
				// now one item containing [a,b] should be pending in c
				assert.equal(0, p.countPending);
				assert.equal(0, m.countPending);
				assert.equal(3, m.countBuffer());
				assert.equal(2, c.countUpstream);
				assert.equal(2, c.countPending);
				assert.ok(p._isPaused);
				assert.ok(m._isPaused);
				assert.ok(!c._isPaused);

				// resolve c's work
				testUtils.flushData(pendingCallbacks);

				process.nextTick(function() {
					assert.equal(1, m.countBuffer());
					assert.equal(2, c.countPending);
					assert.equal(4, c.countUpstream);

					assert.ok(p._isPaused);
					assert.ok(m._isPaused);
					assert.ok(!c._isPaused);

					// resolve c's work
					testUtils.flushData(pendingCallbacks);

					process.nextTick(function() {
						assert.equal(0, m.countBuffer());
						assert.equal(1, c.countPending);
						assert.equal(5, c.countUpstream);

						assert.ok(!p._isPaused);
						assert.ok(!m._isPaused);
						assert.ok(!c._isPaused);

						done();
					});
				});
			});
		});
	});

	it('end', function(done) {
		var p = new SmartStream('p');
		var m = new SplitStream('m');
		m.setSplitterSync(function(data) {
			return data.split(' ');
		});
		var c = new SmartStream('c', 1);
		p.pipe(m).pipe(c);

		var pendingCallbacks = testUtils.holdData(c);
		var eventsSeen = testUtils.watchEvents([p, m, c], ['data', 'ending', 'end', 'close', 'empty']);

		p.write('a b c');
		p.end();

		assert.ok(!c._isClosed);
		assert.ok(!m._isClosed);
		assert.ok(!p._isClosed);

		process.nextTick(function() {
			// now that things have ended, m should still hold on to 'c' until c is unpaused
			assert.ok(p._isClosed);
			assert.ok(!m._isClosed);
			assert.ok(!c._isClosed);
			assert.equal(2, m.countBuffer());

			testUtils.assertSeen(eventsSeen, p, 'data');
			testUtils.assertSeen(eventsSeen, p, 'ending');
			testUtils.assertSeen(eventsSeen, p, 'end');

			testUtils.assertSeen(eventsSeen, m, 'data');
			testUtils.assertNotSeen(eventsSeen, m, 'empty');
			testUtils.assertSeen(eventsSeen, m, 'ending');
			testUtils.assertNotSeen(eventsSeen, m, 'end');

			testUtils.assertNotSeen(eventsSeen, c, 'data');
			testUtils.assertNotSeen(eventsSeen, c, 'end');

			// resolve c's work (a)
			testUtils.flushData(pendingCallbacks);

			process.nextTick(function() {
				assert.ok(!m._isClosed);
				assert.ok(!c._isClosed);
				assert.equal(1, m.countBuffer());
				testUtils.assertNotSeen(eventsSeen, m, 'end');
				testUtils.assertNotSeen(eventsSeen, m, 'empty');
				testUtils.assertSeen(eventsSeen, c, 'data');

				// resolve c's work (b)
				testUtils.flushData(pendingCallbacks);

				process.nextTick(function() {
					assert.ok(m._isClosed);
					assert.ok(!c._isClosed);
					assert.equal(0, m.countBuffer());
					testUtils.assertSeen(eventsSeen, m, 'empty');
					testUtils.assertSeen(eventsSeen, m, 'end');
					testUtils.assertSeen(eventsSeen, c, 'data');
					testUtils.assertNotSeen(eventsSeen, c, 'end');

					// resolve c's work (c)
					testUtils.flushData(pendingCallbacks);
					process.nextTick(function() {
						assert.ok(c._isClosed);
						testUtils.assertSeen(eventsSeen, c, 'end');
						done();
					});
				});
			});
		});
	});
});