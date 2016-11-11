#!/usr/bin/env node

var fs = require('fs');
var Path = require('path');
var mkpath = require('yow').mkpath;
var random = require('yow').random;
var sprintf = require('yow').sprintf;
var isObject = require('yow').isObject;
var isString = require('yow').isString;
var redirectLogs = require('yow').redirectLogs;
var prefixLogs = require('yow').prefixLogs;
var Matrix = require('hzeller-matrix');


var App = function() {

	var _queue   = undefined;
	var _matrix  = undefined;
	var _io      = undefined;
	var _server  = undefined;
	var _promise = undefined;

	function parseArgs() {

		var args = require('yargs');

		args.usage('Usage: $0 [options]');
		args.help('h').alias('h', 'help');

		args.option('l', {alias:'log',         describe:'Redirect logs to file'});
		args.option('H', {alias:'height',      describe:'Height of RGB matrix', default:32});
		args.option('W', {alias:'width',       describe:'Width of RGB matrix', default:32});
		args.option('p', {alias:'port',        describe:'Listen to specified port', default:3003});

		args.wrap(null);

		args.check(function(argv) {
			return true;
		});

		return args.argv;
	}


	function runText(text, options) {

		options = options || {};

		return new Promise(function(resolve, reject) {

			if (options.fontName)
				options.fontName = sprintf('%s/fonts/%s.ttf', __dirname, options.fontName);

			_matrix.runText(text, options, resolve);
		});

	}

	function runEmoji(options) {

		options = options || {};

		return new Promise(function(resolve, reject) {

			if (!options.id || options.id < 1 || options.id > 846)
				options.id = 704;

			var image = sprintf('%s/images/emojis/%d.png', __dirname, options.id);

			_matrix.runImage(image, options, resolve);
		});

	}

	function runAnimation(options) {

		options = options || {};

		return new Promise(function(resolve, reject) {
			var fileName = options.name;

			// Generate a random one if not specified
			if (fileName == undefined) {
				var files = fs.readdirSync(sprintf('%s/animations', __dirname));
				fileName = random(files);
			}
			else {
				fileName = sprintf('%s.gif', fileName);
			}

			// Add path
			fileName = sprintf('%s/animations/%s', __dirname, fileName);

			_matrix.runAnimation(fileName, options, resolve);
		});

	}

	function runRain(options) {
		options = options || {};

		return new Promise(function(resolve, reject) {
			_matrix.runRain(options, resolve);
		});

	}

	function runPerlin(options) {
		options = options || {};

		return new Promise(function(resolve, reject) {
			_matrix.runPerlin(options, resolve);
		});

	}



	function work() {
		var self = this;

		if (_queue.length > 0 && _promise == undefined) {
			_promise = _queue.splice(0, 1)[0];

			_promise().then(function() {
				_promise = undefined;

				if (_queue.length > 0) {
					setTimeout(work(), 0);
				}
				else {
					console.log('Queue empty. Nothing to do.');
					_io.emit('idle');
				}
			});

		}

	};

	function enqueue(promise, options) {

		if (options == undefined)
			options = {};

		if (options.priority == 'high') {
			_matrix.stop(function() {
				_queue = [promise];
				_promise = undefined;
			});
		}
		else if (options.priority == 'low') {
			if (!_matrix.isRunning()) {
				_queue.push(promise);
			}
		}
		else
			_queue.push(promise);

		work();
	}


	function displayIP() {

		return new Promise(function(resolve, reject) {
			function getIP(name) {

				var os = require('os');
				var ifaces = os.networkInterfaces();

				var iface = ifaces[name];

				for (var i = 0; i < iface.length; i++)
					if (iface[i].family == 'IPv4')
						return iface[i].address;
			}

			var ip = getIP('wlan0');

			if (ip == undefined)
				ip = 'Ready';

			_matrix.runText(ip, resolve);
		});

	}

	function run() {

		var argv = parseArgs();

		prefixLogs();

		if (argv.log) {
			var parts = Path.parse(__filename);
			var logFile = Path.join(parts.dir, parts.name + '.log');

			redirectLogs(logFile);
		}

		console.log('Started', new Date());

		_queue  = [];
		_matrix = new Matrix({width:argv.width, height:argv.height});
		_server = require('http').createServer(function(){});
		_io     = require('socket.io')(_server).of('/hzeller-matrix');

		displayIP().then(function() {

			_server.listen(argv.port, function() {
				console.log('Listening on port', argv.port, '...');
			});

			_io.on('connection', function(socket) {

				console.log('Connection from', socket.id);

				socket.on('disconnect', function() {
					console.log('Disconnected from', socket.id);
				});

				socket.on('stop', function() {
					_matrix.stop(function() {
						_queue = [promise];
						_promise = undefined;
					});
				});

				socket.on('text', function(options) {
					enqueue(runText('text', options), options);
				});

				socket.on('animation', function(options) {
					enqueue(runAnimation(options), options);
				});

				socket.on('emoji', function(options) {
					enqueue(runEmoji(options), options);
				});

				socket.on('rain', function(options) {
					enqueue(runRain(options), options);
				});

				socket.on('perlin', function(options) {
					enqueue(runPerlin(options), options);
				});

				socket.on('hello', function(data) {
					console.log('hello');
				})

			});


		});


	}

	run();

};

new App();