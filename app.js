var express = require('express');
var app = express();
var serv = require('http').Server(app);
const publicIp = require('public-ip');
const localIp = require("ip");

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));
serv.listen(2000);

(async () => {
    console.log("Server runs on: " + await publicIp.v4() + ":2000 (public)");
    console.log("Or: " + localIp.address() + ":2000 (local)")
})();

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
  console.log('socket connected');
});
