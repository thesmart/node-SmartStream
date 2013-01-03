node-SmartStream
===================

Middleware for Node.js Streams.  Creating your own Stream pipeline is easy!

```
npm install smart-stream
```

Example of an asynchronous pipeline:

```javascript
var fs = require('fs');
var ss = require('smart-stream');

// open some file streams
var readStream = fs.createReadStream('./input.txt', { encoding: 'utf8' });
var writeStream = fs.createWriteStream('./output.txt');

// create your own stream middleware
var lowerCaseStream = new ss.SmartStream('LowerCaseStream'); // bi-directional stream
lowerCaseStream.setMiddleware(function(data, cb) {
	var result = data.toLowerCase();
	cb(null, result);
	// NOTE: set result to undefined to prevent it from moving downstream
});

// lay some pipe, Tex!
readStream
	.pipe(lowerCaseStream)
	.pipe(writeStream);
```

input.txt

```
WHY R U ALL
SO OFFENDED
BY ALL CAPS???
```

output.txt

```
why r u all
so offended
by all caps???
```

## Throttling feature

Ever have a producer (e.g. database) that is too fast for the consumer (e.g. http api)?  Streams solve this problem!

```javascript
// when slowStream hits 1,000 concurrent operations, it will ask fastStream to pause.
// when slowStream completes the operations, it will ask fastStream to resume.
var slowStream = new ss.SmartStream('name', 1000);
fastStream.pipe(slowStream);
```

## Accumulate operations

Sometimes you may want to accumulate multiple data items together before sending a single item downstream.

```javascript
var ss = require('smart-stream');
var assert = require('assert');

// This MongoDB cursor loops over users in the database
var cursor = userCollection.find({});

// I want to accumulate 50 users in a batch
var accumulatorStream = new ss.AccStream('Accumulator', 50);

// not every batch will be exactly 50, but almost all but the last one will be
accumulatorStream.setMiddlewareSync(function(batch) {
	console.log(batch.length);
});

cursor.stream.pipe(accumulatorStream);
```

```
50
50
50
...
21
```

## SmartStream internals

Similar to unix piping, Streams can be piped together to form a pipeline:

```
readableStream.pipe(writableStreamA).pipe(writableStreamB);
readableStream.start();
```

This works via a combination of pub/sub and functional calls:

*Readable Stream    =>    Writable Stream*
event 'data'    =>    write(object)
event 'end'    =>    end()
event 'drain'    =>    resume()
event 'pause'    =>    pause()
event 'close'    =>    destroy()
event 'error'    =>    event 'error'

### Writable Streams

Methods: write, end, destroy
Events: drain, error, close, pause

* Methods:
 1. write(object) - called from an upstream Stream (or functionally) when data is ready for this node in the Stream pipeline. Increments "countUpstream" and the "countPending" count.
 1. end() - called from an upstream Stream when it has no data left to write
 1. destroy() - called to destroy the Stream node
* Events:
 1. event 'drain' - emitted from a Stream any time it is no longer busy, meaning its "countPending" falls to safe levels.  This allows any paused up-stream Stream to resume writing data.
 1. event 'error' - the Stream has encountered an error. This error will ripple through the pipeline.
 1. event 'close' - emitted by the last writeable stream in a pipeline when it is closed and should not be written to again ever.
 1. event 'pause' - emitted from a writable Stream when it is busy processing pending data, and needs up-stream to pause writing data.  Does not guarantee that data will not be written, more of a "gentleman's" agreement.

### Readable Streams

Methods: pause, resume, end, destroy
Events: data, end, error

* Methods:
 1. pause() - called to pause downstream production
 1. resume() - called to resume downstream production
 1. end() - called when the upstream Stream has no more data to write downstream
 1. destroy() - called to destroy the Stream node
* Events:
 1. event 'data' - emitted with data read for downstream consumption
 1. event 'end' - emitted after end() is called, when there is no more data to emit
 1. event 'error' - the Stream has encountered an error. This error will ripple through the pipeline.

## Further reading

Here is [a simple blog article about Streams](http://maxogden.com/node-streams).

Here is a [SlideShare discussing Streams](http://www.slideshare.net/atcrabtree/functional-programming-with-streams-in-nodejs) in NodeJs