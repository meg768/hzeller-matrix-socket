#!/usr/bin/env node

var fs       = require('fs');
var Path     = require('path');
var mkpath   = require('yow/fs').mkpath;
var random   = require('yow/random');
var sprintf  = require('yow/sprintf');
var isObject = require('yow/is').isObject;
var isString = require('yow/is').isString;
var logs     = require('yow/logs');
var Queue    = require('yow/queue');
var Matrix   = require('hzeller-matrix');




var App = function(argv) {

	var _this    = this;
	var _queue   = new Queue(50);
	var _matrix  = undefined;
	var _socket   = require('socket.io-client')('http://app-o.se/services');

	var argv = parseArgs();

	function parseArgs() {

		var args = require('yargs');

		args.usage('Usage: $0 [options]');
		args.help('help').alias('help', 'h');

		args.option('height', {alias:'H',      describe:'Height of RGB matrix', default:32});
		args.option('width',  {alias:'W',      describe:'Width of RGB matrix', default:64});
		args.option('name',  {alias:'n',      describe:'Name of service', default:'hzeller-matrix-64x32'});

		args.wrap(null);

		args.check(function(argv) {
			return true;
		});

		return args.argv;
	}


	function runText(options) {


		return new Promise(function(resolve, reject) {

			options = options || {};

			if (options.fontName)
				options.fontName = sprintf('%s/fonts/%s.ttf', __dirname, options.fontName);

			console.log('runText:', JSON.stringify(options));
			_matrix.runText(options.text, options, resolve);
		});

	}

	function runEmoji(options) {

		return new Promise(function(resolve, reject) {

			options = options || {};

			if (!options.id || options.id < 1 || options.id > 846)
				options.id = 704;

			options.image = sprintf('%s/images/emojis/%d.png', __dirname, options.id);

			console.log('runImage:', JSON.stringify(options));
			_matrix.runImage(options.image, options, resolve);
		});

	}

	function runAnimation(options) {

		return new Promise(function(resolve, reject) {

			options = options || {};

			options.fileName = options.name;

			// Generate a random one if not specified
			if (options.fileName == undefined) {
				var files = fs.readdirSync(sprintf('%s/animations', __dirname));
				options.fileName = random(files);
			}
			else {
				options.fileName = sprintf('%s.gif', options.fileName);
			}

			// Add path
			options.fileName = sprintf('%s/animations/%s', __dirname, options.fileName);

			console.log('runImage:', JSON.stringify(options));
			_matrix.runAnimation(options.fileName, options, resolve);
		});

	}

	function runRain(options) {

		return new Promise(function(resolve, reject) {

			options = options || {};

			console.log('runRain:', JSON.stringify(options));
			_matrix.runRain(options, resolve);
		});

	}

	function runPerlin(options) {

		return new Promise(function(resolve, reject) {

			options = options || {};

			console.log('runPerlin:', JSON.stringify(options));
			_matrix.runPerlin(options, resolve);
		});

	}

	function enqueue(promise, options) {

		if (options == undefined)
			options = {};

		if (options.priority == 'low' && _matrix.isRunning())
			return;

		function enqueue() {
			if (options.priority == '!') {
				_queue.queue([promise]);
				_matrix.stop();
			}
			else if (options.priority == 'high') {
				_queue.prequeue(promise);
			}
			else {
				_queue.enqueue(promise);
			}
		}

		function dequeue() {
			_queue.dequeue().then(function() {
				console.log('Entering idle mode');
				_socket.emit('idle', {});

			})
			.catch(function(error) {
				console.log(error.stack);
				_socket.emit('idle', {});
			});

		}

		if (_queue.isEmpty()) {
			enqueue();
			dequeue();
		}
		else {
			enqueue();
		}

	}


	function displayIP() {

		return new Promise(function(resolve, reject) {
			function getIP(name) {

				try {
					var os = require('os');
					var ifaces = os.networkInterfaces();

					var iface = ifaces[name];

					for (var i = 0; i < iface.length; i++)
						if (iface[i].family == 'IPv4')
							return iface[i].address;

				}
				catch(error) {
					return undefined;

				}
			}

			var ip = getIP('wlan0');

			if (ip == undefined)
				ip = 'Ready';

			_matrix.runText(ip, {}, resolve);
		});

	}


	function run() {

		logs.prefix();


		_matrix = new Matrix({width:argv.width, height:argv.height});


		displayIP().then(function() {


			console.log('Started', new Date());

			_socket.on('connect', function() {
				console.log('Connected to socket server!');

				runEmoji();

				_socket.emit('service', argv.name, ['cancel', 'clear', 'stop', 'text', 'animation', 'emoji', 'rain', 'perlin', 'hello'], {timeout:5000});
			});

			_socket.on('disconnect', function() {
				console.log('Disconnected from socket server');
			});

			_socket.on('cancel', function(options, fn) {
				_queue.clear();
				_matrix.stop();
				fn({status:'OK'});
			});

			_socket.on('stop', function(options, fn) {
				_queue.clear();
				_matrix.stop();
				fn({status:'OK'});
			});

			_socket.on('text', function(options, fn) {
				enqueue(runText.bind(_this, options), options);
				fn({status:'OK'});
			});

			_socket.on('animation', function(options, fn) {
				enqueue(runAnimation.bind(_this, options), options);
				fn({status:'OK'});
			});

			_socket.on('emoji', function(options, fn) {
				enqueue(runEmoji.bind(_this, options), options);
				fn({status:'OK'});
			});

			_socket.on('rain', function(options, fn) {
				enqueue(runRain.bind(_this, options), options);
				fn({status:'OK'});
			});

			_socket.on('perlin', function(options, fn) {
				enqueue(runPerlin.bind(_this, options), options);
				fn({status:'OK'});
			});

			_socket.on('hello', function(options, fn) {
				console.log('hello');
				fn({status:'OK'});
			})




		});


	}

	run();

};

new App();
