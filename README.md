node-SmartStream
===================

Middleware for Node.js Streams.  Creating your own Stream is easy!

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