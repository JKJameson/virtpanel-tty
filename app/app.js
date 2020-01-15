'use strict';
var express = require('express');
var http = require('http');
var https = require('https');
var path = require('path');
var server = require('socket.io');
var pty = require('pty.js');
var fs = require('fs');

var opts = require('optimist')
    .options({
        sslkey: {
            demand: false,
            description: 'path to SSL key'
        },
        sslcert: {
            demand: false,
            description: 'path to SSL certificate'
        },
        port: {
            demand: true,
            alias: 'p',
            description: 'wetty listen port'
        },
    }).boolean('allow_discovery').argv;

var runhttps = false;
if (opts.sslkey && opts.sslcert) {
    runhttps = true;
    opts.ssl = {};
    opts.ssl.key = fs.readFileSync(path.resolve(opts.sslkey));
    opts.ssl.cert = fs.readFileSync(path.resolve(opts.sslcert));
}

process.on('uncaughtException', function(e) {
    console.error('Error: ' + e);
});

var httpserv;

var app = express();
app.use(express.bodyParser());
app.use('/', express.static(path.join(__dirname, 'public')));

if (runhttps) {
    httpserv = https.createServer(opts.ssl, app).listen(opts.port, function() {
        console.log('https on port ' + opts.port);
    });
} else {
    httpserv = http.createServer(app).listen(opts.port, function() {
        console.log('http on port ' + opts.port);
    });
}

var io = server(httpserv,{path: '/wetty/socket.io'});
io.on('connection', function(socket){
    //console.log((new Date()) + ' Connection accepted from '+socket.handshake.address);

    var authtoken = path.basename(socket.handshake.query.auth);
	var authTokenFile = '/wetty-config/tokens/'+authtoken;
	
	if (!fs.existsSync(authTokenFile))
		return;
	
    var json = fs.readFileSync(authTokenFile,'utf8');
    var settings = JSON.parse(json);

    var term;
    term = pty.spawn('ssh', [settings.user + "@" + settings.host, '-p', settings.port, '-o', 'PreferredAuthentications=publickey', '-i', '/wetty-config/keys/'+authtoken, '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'LogLevel=error'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30
    });
    console.log((new Date()) + " PID=" + term.pid + " STARTED on behalf of user=" + settings.user + " ip=" + settings.host);
    term.on('data', function(data) {
        socket.emit('output', data);
    });
    term.on('exit', function(code) {
        console.log((new Date()) + " PID=" + term.pid + " ENDED with code "+code);
    });
    socket.on('resize', function(data) {
        term.resize(data.col, data.row);
    });
    socket.on('input', function(data) {
        term.write(data);
    });
    socket.on('disconnect', function() {
        term.end();
    });
});
