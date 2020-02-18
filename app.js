var express = require('express');
var app = express();
var serv = require('http').Server(app);

const publicIp = require('public-ip');
const localIp = require("ip");

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));
app.use('/client', express.static(__dirname + '/client/js'));
serv.listen(2000);

(async () => {
    console.log("Server runs on: " + await publicIp.v4() + ":2000 (public)");
    console.log("Or: " + localIp.address() + ":2000 (local)")
})();

var SOCKET_LIST = {};

var initPack = {player:[], bullet:[], wall:[]};
var removePack = {player:[], bullet:[], wall:[]};

var Entity = function(){
  var self = {
    id:     "",
    x:      0,
    y:      0,
    width:  0,
    height: 0,
    speedX: 0,
    speedY: 0,
  };
  self.update = function(){
    self.updatePosition();
  };
  self.updatePosition = function(){
    self.x += self.speedX;
    self.y += self.speedY;
  };
  self.isCollidingWithRect = function(rect){
    return (self.x < rect.x + rect.width &&
            self.x + self.width > rect.x &&
            self.y < rect.y + rect.height &&
            self.y + self.height > rect.y)
  };

  self.getDistance = function(pt){
    var distance = Math.sqrt(Math.pow(self.x + (self.width/2) - pt.x + (pt.width/2), 2) +
                                Math.pow(self.y + (self.height/2) - pt.y + (pt.height/2), 2));
    return distance;
  };

  return self;
};

var Wall = function (startPoint, width, height) {
  var self =        Entity();
  self.id =         Math.random();
  self.startPoint = startPoint;
  self.x =          startPoint.x;
  self.y =          startPoint.y;
  self.width =      width;
  self.height =     height;

  self.getInitPack = function () {
    return {
      id:     self.id,
      x:      self.x,
      y:      self.y,
      width:  self.width,
      height: self.height
    }
  };

  self.getEndPoint = function() {
    return{
      x: self.x + self.width,
      y: self.y + self.height,
    }
  };

  self.endAtPoint = function(point) {
    self.x = point.x - width;
    self.y = point.y - height;
  };

  Wall.list[self.id] = self;
  initPack.wall.push(self.getInitPack());
  return self;
};
Wall.list = {};

Wall.getAllInitpack = function(){
  var walls = [];
  for(var id in Wall.list){
    walls.push(Wall.list[id].getInitPack());
  }
  return walls;
};

var createNewMap = function () {
  for (var id in Wall.list){
    delete Wall.list[id];
    removePack.wall.push(id);
  }

  var topWall = new Wall({x: -200, y: -200}, 2000, 10);
  var rightWall = new Wall(topWall.getEndPoint(), 10, 1000);
  var bottomWall = new Wall(rightWall.getEndPoint(), 2000, 10);
  bottomWall.endAtPoint(rightWall.getEndPoint());
  var leftWall = new Wall(topWall.startPoint, 10, 1000);
};

createNewMap();

var Player = function(id){
  var self = Entity();

  self.id =             id;
  self.name =           "unnamed";
  self.width =          20;
  self.height =         20;
  self.hp =             100;
  self.hpMax =          100;
  self.score =          0;
  self.pressingRight =  false;
  self.pressingLeft =   false;
  self.pressingUp =     false;
  self.pressingDown =   false;
  self.pressingAttack = false;
  self.mouseAngle =     0;
  self.speedX =         0;
  self.speedY =         0;
  self.maxSpeed =       3;
  self.acceleration =   0.2;
  self.attackTimer =    0;
  self.attackRate =     1000 / 100;

  var super_update = self.update;
  self.update = function () {
    self.updateSpeed();
    super_update();

    self.attackTimer++;
    if (self.pressingAttack && self.attackTimer >= self.attackRate){
      /*  ---- "SHOTGUN" ----
      for (var i = -3; i < 3; i++){
        self.shootBullet(i*10 + self.mouseAngle)
      }
      */
      self.shootBullet(self.mouseAngle);
      self.attackTimer = 0;
    }
  };

  self.shootBullet = function(angle){
    var bullet = Bullet(self.id, angle);
    bullet.x = self.x;
    bullet.y = self.y;
  };

  self.updateSpeed = function(){
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
  };
  self.getInitPack = function(){
      return {
        id:     self.id,
        name:   self.name,
        x:      self.x,
        y:      self.y,
        width:  self.width,
        height: self.height,
        hp:     self.hp,
        hpMax:  self.hpMax,
        score:  self.score
      }
  };
  self.getUpdatePack = function(){
      return {
        id:     self.id,
        name:   self.name,
        x:      self.x,
        y:      self.y,
        width:  self.width,
        height: self.height,
        hp:     self.hp,
        hpMax:  self.hpMax,
        score:  self.score
      }
  };

  Player.list[id] = self;
  initPack.player.push(self.getInitPack());
  return self;
};

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

  socket.emit('init', {
    selfId: socket.id,
    player: Player.getAllInitpack(),
    bullet: Bullet.getAllInitpack(),
    wall:   Wall.getAllInitpack(),
  })

};

Player.getAllInitpack = function(){
  var players = [];
  for(var i in Player.list){
    players.push(Player.list[i].getInitPack());
  }
  return players;
};

Player.onDisconnect = function(socket){
  delete Player.list[socket.id];
  removePack.player.push(socket.id);
};

Player.update = function() {
  var packet = [];
  for (var id in Player.list){
    var player = Player.list[id];
    player.update();
    packet.push(player.getUpdatePack());
  }
  return packet;
};

var Bullet = function(parent, angle){
  var self = Entity();
  self.id =       Math.random();
  self.parent =   parent;
  self.maxSpeed = 8;
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

    self.speedX /= 1.005;
    self.speedY /= 1.005;
    self.damage /= 1.015;

    for (var i in Player.list) {
      var player = Player.list[i];
      if(self.isCollidingWithRect(player) && self.parent !== player.id){
        player.hp -= self.damage;
        if (player.hp<0){
          var shooter = Player.list[self.parent];
          if (shooter){
            shooter.score++;
          }
          player.hp = player.hpMax;
          player.x = Math.random() * 500; //NEED REFACTOR (width, height)
          player.y = Math.random() * 500; //-
        }
        self.toRemove = true;
      }
    }

  };
  self.getInitPack = function() {
    return {
      id:     self.id,
      x:      self.x,
      y:      self.y,
      width:  self.width,
      height: self.height,
    }
  };

  self.getUpdatePack = function() {
    return {
      id:     self.id,
      x:      self.x,
      y:      self.y,
      width:  self.width,
      height: self.height,
    }
  };

  Bullet.list[self.id] = self;
  initPack.bullet.push(self.getInitPack());
  return self;
};
Bullet.list = {};

Bullet.update = function() {
  var packet = [];
  for (var id in Bullet.list){
    var bullet = Bullet.list[id];
    bullet.update();
    if(bullet.toRemove){
      delete Bullet.list[id];
      removePack.bullet.push(bullet.id);
    } else {
      packet.push(bullet.getUpdatePack());
    }
  }
  return packet;
};

Bullet.getAllInitpack = function(){
  var bullets = [];
  for(var id in Bullet.list){
    bullets.push(Bullet.list[id].getInitPack());
  }
  return bullets;
};

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
  socket.id = Math.random();
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
  var updatePack = {
    player: Player.update(),
    bullet: Bullet.update(),
  };

  for (var id in SOCKET_LIST){
    var socket = SOCKET_LIST[id];
    socket.emit('init', initPack);
    socket.emit('update', updatePack);
    socket.emit('remove', removePack);
  }

  initPack.player = [];
  initPack.bullet = [];
  initPack.wall = [];
  removePack.player = [];
  removePack.bullet = [];
  removePack.wall = [];

}, 1000/40);
