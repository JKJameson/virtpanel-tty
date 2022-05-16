'use strict';
var os = require('os');
var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var path = require('path');
var server = require('socket.io');
//var pty = require('pty.js');
var pty = require('node-pty');
var fs = require('fs');

var port = 3000;

process.on('uncaughtException', function(e) {
    console.error('Error: ' + e);
});

var httpserv;

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
//app.use('/', express.static(path.join(__dirname, 'public')));

httpserv = http.createServer(app).listen(port, function() {
	console.log('Listening for connections on port '+port);
});

var io = server(httpserv,{path: '/tty/socket.io'});
io.on('connection', function(socket){
	var ip = socket.handshake.headers['x-forwarded-for'];
    var authtoken = path.basename(socket.handshake.query.auth);
    var authTokenFile = '/tty-config/tokens/'+authtoken;

    if (!fs.existsSync(authTokenFile)) {
        console.log((new Date()) + ' Unauthorized connection from '+ip);
        return;
    }

    var json = fs.readFileSync(authTokenFile, 'utf8');
    var settings = JSON.parse(json);
    fs.unlinkSync(authTokenFile);

    console.log((new Date()) + " " + settings.user + " logged in from " + ip);

    var sshKeyDir = '/tmp/ssh';
    if (!fs.existsSync(sshKeyDir)) {
        fs.mkdirSync(sshKeyDir);
        fs.chmodSync(sshKeyDir, 0o100);
    }

    fs.writeFileSync(sshKeyDir+'/'+authtoken, fs.readFileSync('/tty-config/keys/'+authtoken, 'utf8'));
    fs.chmodSync(sshKeyDir+'/'+authtoken, 0o400);
    fs.unlinkSync('/tty-config/keys/'+authtoken);

    var term;
    term = pty.spawn('ssh', [settings.user + "@" + settings.host, '-p', settings.port, '-t', '-o', 'PreferredAuthentications=publickey', '-i', sshKeyDir+'/'+authtoken, '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'LogLevel=error'], {
        cwd: process.env.HOME,
        env: process.env
    });
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
        console.log((new Date()) + " PID=" + term.pid + " DISCONNECTED");
        term.kill('SIGKILL');
        term.end();
    });
});
