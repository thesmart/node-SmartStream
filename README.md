node-BaseStream
===================

Middleware for Node.js Streams.  Creating your own Stream is easy!

```
npm install base-stream
```

Example of an asynchronous pipeline:

```javascript
var fs = require('fs');
var bs = require('base-stream');

// open some file streams
var readStream = fs.createReadStream('./input.txt', { encoding: 'utf8' });
var writeStream = fs.createWriteStream('./output.txt');

// create your own stream middleware
var lowerCaseStream = new bs.BiStream(); // bi-directional stream
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
var slowStream = new bs.BiStream(1000);
fastStream.pipe(slowStream);
```
