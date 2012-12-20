var fs = require('fs');
var ss = require('../index.js');

// open some file streams
var readStream = fs.createReadStream(__dirname + '/input.txt', { encoding: 'utf8' });
var writeStream = fs.createWriteStream(__dirname + '/output.txt');

// create your own stream middle-ware
var lowerCaseStream = new ss.SmartStream();
lowerCaseStream.setMiddleware(function(data, cb) {
	var result = data.toLowerCase();
	cb(null, result);
});

// lay some pipe, Tex!
readStream.pipe(lowerCaseStream);
lowerCaseStream.pipe(writeStream);
