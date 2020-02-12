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

var SOCKET_LIST = {};

var Entity = function(){
  var self = {
    id:     "",
    x:      250,
    y:      250,
    width:  0,
    height: 0,
    speedX: 0,
    speedY: 0,
  }
  self.update = function(){
    self.updatePosition();
  }
  self.updatePosition = function(){
    self.x += self.speedX;
    self.y += self.speedY;
  }
  self.getDistance = function(pt){
    return Math.sqrt(Math.pow(self.x + (self.width/2) - pt.x + (pt.width/2)) +
                     Math.pow(self.y + (self.height/2) - pt.y + (pt.height/2)));
  }

  return self;
}

var Player = function(id){
  var self = Entity();

  self.id=            id;
  self.name=           "unnamed";
  self.x=              250;
  self.y=              250;
  self.width=          20;
  self.height=         20;
  self.hp=             100;
  self.pressingRight=  false;
  self.pressingLeft=   false;
  self.pressingUp=     false;
  self.pressingDown=   false;
  self.pressingAttack= false;
  self.mouseAngle=     0;
  self.speedX=         0;
  self.speedY=         0;
  self.maxSpeed=       5;
  self.acceleration=   0.5;

  var super_update = self.update;
  self.update = function () {
    self.updatePosition();
    super_update();

    if (self.pressingAttack){
      self.shootBullet(self.mouseAngle)
    }
  }

  self.shootBullet = function(angle){
    var bullet = Bullet(self.id, angle);
    bullet.x = self.x;
    bullet.y = self.y;
  }

  self.updatePosition = function(){
    if(self.pressingRight){
      if(self.speedX < self.maxSpeed){
        self.speedX += self.acceleration;
        if(self.speedX > self.maxSpeed){
          self.speedX = self.maxSpeed;
        }
      }
    }
    else if(self.pressingLeft){
      if(self.speedX > -self.maxSpeed){
        self.speedX -= self.acceleration;
        if(self.speedX < -self.maxSpeed){
          self.speedX = -self.maxSpeed;
        }
      }
    }
    if(self.pressingDown){
      if(self.speedY < self.maxSpeed){
        self.speedY += self.acceleration;
        if(self.speedY > self.maxSpeed){
          self.speedY = self.maxSpeed;
        }
      }
    }
    else if(self.pressingUp){
      if(self.speedY > -self.maxSpeed){
        self.speedY -= self.acceleration;
        if(self.speedY < -self.maxSpeed){
          self.speedY = -self.maxSpeed;
        }
      }
    }

    if(!self.pressingLeft && !self.pressingRight){
      if(self.speedX > 0){
        self.speedX -= self.acceleration;
        if (self.speedX < 0){
          self.speedX = 0;
        }
      }
      if(self.speedX < 0){
        self.speedX += self.acceleration;
        if(self.speedX > 0){
          self.speedX = 0;
        }
      }
    }

    if(!self.pressingUp && !self.pressingDown){
      if(self.speedY > 0){
        self.speedY -= self.acceleration;
        if (self.speedY < 0){
          self.speedY = 0;
        }
      }
      if(self.speedY < 0){
        self.speedY += self.acceleration;
        if(self.speedY > 0){
          self.speedY = 0;
        }
      }
    }

    self.x += self.speedX;
    self.y += self.speedY;
  }

  Player.list[id] = self;
  return self;
}

Player.list = {};
Player.onConnect = function(socket) {
  var player = Player(socket.id);

  socket.on('keyPress', function(data){
    if(data.inputId === 'left'){
      player.pressingLeft = data.state;
    }else if(data.inputId === 'right'){
      player.pressingRight = data.state;
    }else if(data.inputId === 'up'){
      player.pressingUp = data.state;
    }else if(data.inputId === 'down'){
      player.pressingDown = data.state;
    }else if(data.inputId === 'attack'){
      player.pressingAttack = data.state;
    }else if(data.inputId === 'mouseAngle'){
      player.mouseAngle = data.state;
    }
  });

  socket.on('newName', function(data){
    player.name = data;
  });
}
Player.onDisconnect = function(socket){
  delete Player.list[socket.id];
  console.log('player deleted');
}
Player.update = function() {
  var packet = [];
  for (var id in Player.list){
    var player = Player.list[id];
    player.update();
    packet.push({
      id:     player.id,
      name:   player.name,
      x:      player.x,
      y:      player.y,
      width:  player.width,
      height: player.height,
      hp:     player.hp
    });
  }
  return packet;
}

var Bullet = function(parent, angle){
  var self = Entity();
  self.id =       Math.random();
  self.parent =   parent;
  self.maxSpeed = 5;
  self.width =    5;
  self.height =   5;
  self.damage =   10;
  self.speedX =   Math.cos(angle/180*Math.PI) * self.maxSpeed;
  self.speedY =   Math.sin(angle/180*Math.PI) * self.maxSpeed;

  self.timer =    0;
  self.maxTime =  200;
  self.toRemove = false;

  var super_update = self.update;
  self.update = function(){
    if(self.timer++ > self.maxTime){
      self.toRemove = true;
    }
    super_update();

    for (var i in Player.list) {
      var player = Player.list[i];
      if(self.getDistance(player) < player.width/2+ self.width/2 && self.parent !== player.id){
        player.hp -= self.damage;

        self.toRemove = true;
      }
    }

  }
  Bullet.list[self.id] = self;
  return self;
}
Bullet.list = {};

Bullet.update = function() {
  var packet = [];
  for (var id in Bullet.list){
    var bullet = Bullet.list[id];
    bullet.update();
    if(bullet.toRemove){
      delete Bullet.list[id];
    } else {
      packet.push({
        id:     bullet.id,
        x:      bullet.x,
        y:      bullet.y,
        width:  bullet.width,
        height: bullet.height,
      });
    }
  }
  return packet;
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
  socket.id = Math.random();
  socket.emit('selfid', socket.id);
  SOCKET_LIST[socket.id] = socket;
  console.log('socket ' + socket.id + ' connected');

  Player.onConnect(socket);

  socket.on('disconnect', function(){
    delete SOCKET_LIST[socket.id];
    console.log('socket ' + socket.id + ' disconnected');
    Player.onDisconnect(socket);
  });


});

setInterval(function(){
  var packet = {
    player: Player.update(),
    bullet: Bullet.update(),
  }

  for (var id in SOCKET_LIST){
    SOCKET_LIST[id].emit('newPosition', packet);
  }

}, 1000/45);
