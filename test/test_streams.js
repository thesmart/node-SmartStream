// for testing, use http://visionmedia.github.com/mocha/

var streams = require('../index.js');
var assert = require('assert');
var util = require('util');

describe('Produce and Consumer', function() {
	it('write through', function(done) {
		var p = new streams.BiStream();
		var c = new streams.ConsumerStream();
		p.pipe(c);

		c.on('drain', function() {
			assert.equal(1, p.countDownstream);
			assert.equal(1, c.countUpstream);
		});

		c.on('close', function() {
			done();
		});

		p.write('hello world');
		p.destroy();
	});

	it('limits', function(done) {

		var p = new streams.BiStream('Stream-P');
		var c = new streams.ConsumerStream('Stream-C', 1);
		c.setMiddleware(function(data, cb) {
			global.setTimeout(cb.bind(this, null, data), 1000);
		});
		p.pipe(c);

		var wasPaused = false;
		p.on('pause', function() {
			wasPaused = true;
		});

		var wasDrained = false;
		c.on('drain', function() {
			wasDrained = true;
		});

		c.on('close', function() {
			assert.ok(wasPaused, 'producer was not paused by slow consumer');
			assert.ok(wasDrained, 'consumer never drained');
			done();
		});

		p.write('hello world');
		c.destroySoon();
	});

	it('destroySoon', function(done) {
		var p = new streams.BiStream();
		var c = new streams.ConsumerStream();
		p.pipe(c);

		var pEnd = false;
		p.on('end', function() {
			pEnd = true;
		});

		c.on('drain', function() {
			assert.equal(0, p.countDownstream);
			assert.equal(0, c.countUpstream);
		});

		c.on('close', function() {
			process.nextTick(function() {
				assert.ok(pEnd);
				done();
			});
		});

		p.destroy();
	});

	it('three stages', function(done) {
		var p = new streams.BiStream();
		var b = new streams.BiStream();
		var c = new streams.ConsumerStream();

		var pData = false;
		p.on('data', function() {
			pData = true;
		});

		var bData = false;
		b.on('data', function() {
			assert.ok(pData, 'producer must first produce data');
			bData = true;
		});

		p.pipe(b);
		b.pipe(c);

		var cDrain = false;
		c.on('drain', function() {
			cDrain = true;
			assert.equal(1, p.countDownstream);
			assert.equal(1, c.countUpstream);
			assert.equal(1, b.countDownstream);
			assert.equal(1, b.countUpstream);
		});

		c.on('close', function() {
			assert.ok(cDrain, 'consumer never drained before closing');
			assert.ok(pData, 'producer did not produce data');
			assert.ok(bData, 'bi-directional did not produce data');
			assert.equal(1, c.countUpstream);
			done();
		});

		p.write('hello world');
		p.destroy();
	});

	it('filter', function() {
		var p = new streams.BiStream();
		var b = new streams.BiStream();
		b.setMiddleware(function(data, cb) {
			cb(null, data % 2 !== 0 ? undefined : data);
		});
		p.pipe(b);

		b.on('data', function(data) {
			assert.ok(data % 2 === 0);
		});

		for (var i = 0; i < 10; ++i) {
			p.write(i);
		}
	});

	it('chain end then close', function(done) {
		var a = new streams.BiStream('a');
		var b = new streams.BiStream('b');
		var c = new streams.BiStream('c');
		var d = new streams.ConsumerStream('d');
		var ended = {};
		var closed = {};

		a.pipe(b).pipe(c).pipe(d);

		a.on('end', function() {
//			console.log(this.name, 'end');
			ended[this.name] = true;
		});
		b.on('end', function() {
//			console.log(this.name, 'end');
			ended[this.name] = true;
			assert.ok(ended['a']);
		});
		c.on('end', function() {
//			console.log(this.name, 'end');
			ended[this.name] = true;
			assert.ok(ended['b']);
		});
		d.on('end', function() {
//			console.log(this.name, 'end');
			ended[this.name] = true;
			assert.ok(ended['c']);
		});

		a.on('close', function() {
//			console.log(this.name, 'close');
			closed[this.name] = true;
		});
		b.on('close', function() {
//			console.log(this.name, 'close');
			closed[this.name] = true;
		});
		c.on('close', function() {
//			console.log(this.name, 'close');
			closed[this.name] = true;
		});
		d.on('close', function() {
//			console.log(this.name, 'close');
			closed[this.name] = true;
			assert.ok(ended['a']);
			assert.ok(ended['b']);
			assert.ok(ended['c']);
			done();
		});

		a.destroy();
	});
});