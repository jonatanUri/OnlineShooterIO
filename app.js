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
app.use('/client', express.static(__dirname + '/client/audio'));
serv.listen(2000);

(async () => {
    console.log("Server runs on: " + await publicIp.v4() + ":2000 (public)");
    console.log("Or: " + localIp.address() + ":2000 (local)")
})();

var SOCKET_LIST = {};

var initPack = {player:[], bullet:[], wall:[], bomb: undefined};
var removePack = {player:[], bullet:[], wall:[]};
var MAPWIDTH = 2000;
var MAPHEIGHT = 1000;

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

  self.getCenterPoint = function(){
    return{
      x: self.x + self.width/2,
      y: self.y + self.height/2,
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

var HorizontalWall = function (startPoint, length) {
  return new Wall(startPoint, length, 8);
};

var VerticalWall = function (startPoint, length) {
  return new Wall(startPoint, 8, length);
};

var House = function () {
  var minDistanceXBorder = 250;
  var minDistanceYBorder = 40;
  var self = {
    id:                   Math.random(),
    widthMin:             200,
    heightMin:            150,
    widthVariation:       500,
    heightVariation:      400,
    width:                0,
    height:               0,
    x:                    0,
    y:                    0,
    doorSize:             80,
    minDistance:          35,
    isTooCloseToRect: function(rect){
      return (self.x - self.minDistance < rect.x + rect.width &&
          self.x + self.width + self.minDistance > rect.x &&
          self.y - self.minDistance < rect.y + rect.height &&
          self.y + self.height + self.minDistance > rect.y)
    }
  };

  self.isTooCloseToAnyHouse = function () {
    for(var i in House.list){
      if (House.list[i].id !== self.id){
        if(self.isTooCloseToRect(House.list[i])){
          return true;
        }
      }
    }
    return false;
  };

  do {
    self.width = self.widthMin + Math.random() * self.widthVariation;
    self.height = self.heightMin + Math.random() * self.heightVariation;
    self.x = minDistanceXBorder + Math.random() * (MAPWIDTH - minDistanceXBorder * 2 - self.width);
    self.y = minDistanceYBorder + Math.random() * (MAPHEIGHT - minDistanceYBorder * 2 - self.height);
  } while (self.isTooCloseToAnyHouse());

  var numberOfDoors =  1 + Math.ceil(Math.random() * 3);
  var doorPos = {
    leftWall: false,
    topWall: false,
    rightWall: false,
    bottomWall: false,
  };

  var setDoorPositions = function () {
    while (numberOfDoors !== 0){
      switch (Math.floor(Math.random() * 4)) {
        case 0:
          if(!doorPos.leftWall){
            doorPos.leftWall = true;
            numberOfDoors--;
          }
          break;
        case 1:
          if(!doorPos.topWall){
            doorPos.topWall = true;
            numberOfDoors--;
          }
          break;
        case 2:
          if(!doorPos.rightWall){
            doorPos.rightWall = true;
            numberOfDoors--;
          }
          break;
        case 3:
          if(!doorPos.bottomWall){
            doorPos.bottomWall = true;
            numberOfDoors--;
          }
          break;
      }
    }
  };

  setDoorPositions();

  var makeLeftWall = function () {
    var partWalls = {};
    var topWallStartPos = {x: self.x, y: self.y};
    if(doorPos.leftWall){
      var topWallLength = Math.random() * (self.height - self.doorSize);
      var bottomWallLength = self.height - self.doorSize - topWallLength;
      var bottomWallStartPos = {x: self.x, y: self.y + self.doorSize + topWallLength};
      partWalls = {
        topWall: new VerticalWall(topWallStartPos, topWallLength),
        bottomWall: new VerticalWall(bottomWallStartPos, bottomWallLength)
      }
    }else {
      partWalls = {
        wall: new VerticalWall(topWallStartPos, self.height)
      }
    }
    return partWalls;
  };
  var makeTopWall = function () {
    var partWalls = {};
    var leftWallStartPos = {x: self.x, y: self.y};
    if(doorPos.topWall){
      var leftWallLength = Math.random() * (self.width - self.doorSize);
      var rightWallLength = self.width - self.doorSize - leftWallLength;
      var rightWallStartPos = {x: self.x + self.doorSize + leftWallLength, y: self.y};
      partWalls = {
        leftWall: new HorizontalWall(leftWallStartPos, leftWallLength),
        rightWall: new HorizontalWall(rightWallStartPos, rightWallLength)
      }
    }else {
      partWalls = {
        wall: new HorizontalWall(leftWallStartPos, self.width)
      }
    }
    return partWalls;
  };
  var makeRightWall = function () {
    var partWalls = {};
    var topWallStartPos = {x: self.x + self.width, y: self.y};
    if(doorPos.rightWall){
      var topWallLength = Math.random() * (self.height - self.doorSize);
      var bottomWallLength = self.height - self.doorSize - topWallLength;
      var bottomWallStartPos = {x: self.x + self.width, y: self.y + self.doorSize + topWallLength};
      partWalls = {
        topWall: new VerticalWall(topWallStartPos, topWallLength),
        bottomWall: new VerticalWall(bottomWallStartPos, bottomWallLength + 8) // <---- (+8 for correct cornering, need refactor)
      }
    }else {
      partWalls = {
        wall: new VerticalWall(topWallStartPos, self.height + 8) // <---- (+8 for correct cornering, need refactor)
      }
    }
    return partWalls;
  };
  var makeBottomWall = function () {
    var partWalls = {};
    var leftWallStartPos = {x: self.x, y: self.y + self.height};
    if(doorPos.bottomWall){
      var leftWallLength = Math.random() * (self.width - self.doorSize);
      var rightWallLength = self.width - self.doorSize - leftWallLength;
      var rightWallStartPos = {x: self.x + self.doorSize + leftWallLength, y: self.y + self.height};
      partWalls = {
        leftWall: new HorizontalWall(leftWallStartPos, leftWallLength),
        rightWall: new HorizontalWall(rightWallStartPos, rightWallLength)
      }
    }else {
      partWalls = {
        wall: new HorizontalWall(leftWallStartPos, self.width)
      }
    }
    return partWalls;
  };

  var rightWall = makeRightWall();
  var topWall = makeTopWall();
  var leftWall = makeLeftWall();
  var bottomWall = makeBottomWall();

  var interiorWalls = [];
  var makeInteriorWalls = function() {
    var wallToExtend;
    switch (Math.floor(Math.random() * 4)) {
      case 0:
        if(rightWall.wall){
          wallToExtend = rightWall.wall;
        } else {
          if (rightWall.topWall.height > rightWall.bottomWall.height){
            wallToExtend = rightWall.topWall;
          } else {
            wallToExtend = rightWall.bottomWall;
          }
        }
        var wall = new HorizontalWall({x:0, y: 0}, 20 + Math.random() * (self.width * 0.7 - 20));
        wall.endAtPoint(wallToExtend.getCenterPoint());
        interiorWalls.push(wall);
        break;
      case 1:
        if(topWall.wall){
          wallToExtend = topWall.wall;
        } else {
          if (topWall.leftWall.width > topWall.rightWall.width){
            wallToExtend = topWall.leftWall;
          } else {
            wallToExtend = topWall.rightWall;
          }
        }
        var wall = new VerticalWall(wallToExtend.getCenterPoint(), 20 + Math.random() * (self.height * 0.7 - 20));
        interiorWalls.push(wall);
        break;
      case 2:
        if(leftWall.wall){
          wallToExtend = leftWall.wall;
        } else {
          if(leftWall.topWall.height > leftWall.bottomWall.height){
            wallToExtend = leftWall.topWall;
          } else {
            wallToExtend = leftWall.bottomWall;
          }
        }
        var wall = new HorizontalWall(wallToExtend.getCenterPoint(), 20 + Math.random() * (self.width * 0.7 - 20));
        interiorWalls.push(wall);
        break;
      case 3:
        if(bottomWall.wall){
          wallToExtend = bottomWall.wall;
        } else {
          if(bottomWall.leftWall.width > bottomWall.rightWall.width){
            wallToExtend = bottomWall.leftWall;
          } else {
            wallToExtend = bottomWall.rightWall;
          }
        }
        var wall = new VerticalWall({x: 0, y: 0}, 50 + Math.random() * (self.height * 0.7 - 50));
        wall.endAtPoint(wallToExtend.getCenterPoint());
        interiorWalls.push(wall);
        break;
    }
  };

  makeInteriorWalls();

  House.list[self.id] = self;
  return self;
};
House.list = {};

var createNewMap = function () {
  for (var id in Wall.list){
    delete Wall.list[id];
    removePack.wall.push(id);
  }

  var topWall = new Wall({x: 0, y: 0}, MAPWIDTH, 10);
  var rightWall = new Wall(topWall.getEndPoint(), 10, MAPHEIGHT);
  var bottomWall = new Wall(rightWall.getEndPoint(), MAPWIDTH, 10);
  bottomWall.endAtPoint(rightWall.getEndPoint());
  var leftWall = new Wall(topWall.startPoint, 10, MAPHEIGHT);

  House();
  House();
  House();
  House();
  House();
};

createNewMap();

var Bomb = function () {
  var self = Entity();

  self.width = 10;
  self.height = 10;
  self.defused = false;
  self.timer = 0;
  self.timeToExplode = 1000 / 40 * 40;

  self.explode = function() {
    //NEED TO IMPLEMENT
    for (var i = 0; i < 50; i++){
      var bullet = Bullet('bomb', Math.random()*360);
      bullet.x = self.x;
      bullet.y = self.y;
      bullet.width -= 2;
      bullet.height -= 2;
      bullet.damage = 40;
    }
    bomb = undefined;
    teams.attacker.score++;
  };

  self.update = function () {
    if (!self.defused && self.timer++ >= self.timeToExplode){
      self.explode();
    }
  };

  self.getInitPack = function (){
    return{
      x: self.x,
      y: self.y,
      width: self.width,
      height: self.height,
      defused: self.defused,
      timer: self.timer,
      timeToExplode: self.timeToExplode,
    }
  };

  self.getUpdatePack = function (){
    return{
      x: self.x,
      y: self.y,
      width: self.width,
      height: self.height,
      defused: self.defused,
      timer: self.timer,
      timeToExplode: self.timeToExplode,
    }
  };

  initPack.bomb = (self.getInitPack());
  return self;
};

var bomb = undefined;

Bomb.update = function () {
  bomb.update();
  if(bomb !== undefined){
    return bomb.getUpdatePack();
  }
  return undefined
};

var Player = function(id){
  var self = Entity();

  self.id =             id;
  self.name =           "unnamed";
  self.width =          20;
  self.height =         20;
  self.hp =             100;
  self.hpMax =          100;
  self.score =          0;
  self.killCount =      0;
  self.deathCount =     0;
  self.pressingRight =  false;
  self.pressingLeft =   false;
  self.pressingUp =     false;
  self.pressingDown =   false;
  self.pressingShift =  false;
  self.pressingAttack = false;
  self.mouseAngle =     0;
  self.speedX =         0;
  self.speedY =         0;
  self.maxSpeed =       3;
  self.defaultMaxSpeed = 3;
  self.sprintMaxSpeed = 6;
  self.maxStamina =     100;
  self.stamina =        100;
  self.acceleration =   0.2;
  self.attackTimer =    0;
  self.attackRate =     1000 / 100;
  self.team =           '';
  self.pressingInteract = false;
  self.canInteract =    false;
  self.isInteracting =  false;
  self.interactTimer =  0;
  self.timeToInteract = 1000 / 40 * 8;

  var super_update = self.update;
  self.update = function () {
    self.updateSpeed();
    super_update();
    self.handleWallCollision();
    self.updateCanInteract();
    self.updateInteracting();

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

  self.updateCanInteract = function(){
    self.canInteract = false;
    if (self.speedX === 0 && self.speedY === 0){
      if (self.team === 'attacker'){
        if (bomb === undefined){
          if (self.isCollidingWithRect(areas.plant)){
            self.canInteract = true;
          }
        }
      }else {
        if (bomb && !bomb.defused){
          if (self.getDistance(bomb) < 40){
            self.canInteract = true;
          }
        }
      }
    }
  };

  self.updateInteracting = function(){
    if(self.pressingInteract && self.canInteract){
        if (self.interactTimer++ > self.timeToInteract){
          self.interact();
        }
    } else {
      self.interactTimer = 0;
    }
  };

  self.interact = function() {
    if (self.team === 'attacker'){
      bomb = new Bomb();
      bomb.x = self.x + self.width/2 - bomb.width/2;
      bomb.y = self.y + self.height/2 - bomb.height/2;
    } else {
      bomb.defused = true;
      teams.defender.score++;
    }
  };

  self.shootBullet = function(angle){
    var bullet = Bullet(self.id, angle);
    bullet.x = self.x + self.width/2;
    bullet.y = self.y + self.height/2;
  };

  self.isCollidingWithAnyWalls = function() {
    for(var i in Wall.list){
      if(self.isCollidingWithRect(Wall.list[i])){
        return true;
      }
    }
    return false;
  };

  self.updateSpeed = function(){
    if(self.pressingShift && self.stamina > 0){
      self.stamina--;
      self.maxSpeed = self.sprintMaxSpeed;
    } else {
      self.maxSpeed = self.defaultMaxSpeed;

      if (self.speedX > self.maxSpeed){
        self.speedX -= self.acceleration;
      }else if(self.speedX  < -self.maxSpeed){
        self.speedX += self.acceleration;
      }
      if (self.speedY > self.maxSpeed){
        self.speedY -= self.acceleration;
      } else if (self.speedY < -self.maxSpeed){
        self.speedY += self.acceleration;
      }
    }

    if(!self.pressingDown && !self.pressingRight &&
       !self.pressingLeft && !self.pressingUp &&
       self.stamina < self.maxStamina){
      self.stamina++;
    }

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

  self.reSpawn = function () {
    self.hp = self.hpMax;
    self.stamina = self.maxStamina;
    do{
      if(self.team === 'attacker'){
        self.x = Math.random() * areas.attacker.width + areas.attacker.x;
        self.y = Math.random() * areas.attacker.height + areas.attacker.y
      } else {
        self.x = Math.random() * areas.defender.width + areas.defender.x;
        self.y = Math.random() * areas.defender.height + areas.defender.y
      }
    }while (self.isCollidingWithAnyWalls());
  };

  var distanceCounter = 1;
  var DIRECTION = ["UP", "RIGHT", "DOWN", "LEFT"];
  DIRECTION.counter = 0;
  DIRECTION.Next = function () {
    if (DIRECTION.counter++ > 3){
      DIRECTION.counter = 0;
      distanceCounter++;
    }
    return DIRECTION[DIRECTION.counter];
  };

  self.handleWallCollision = function () {
    var firstIteration = false;
    for (var i in Wall.list){
      var wall = Wall.list[i];
      distanceCounter = 1;
      while (self.isCollidingWithRect(wall)){
        //RESET POS BEFORE OFFSET
        if (!firstIteration){
          switch (DIRECTION[DIRECTION.counter]) {
            case "UP":
              self.y += distanceCounter;
              break;
            case "RIGHT":
              self.x -= distanceCounter;
              break;
            case "LEFT":
              self.x += distanceCounter;
              break;
            case "DOWN":
              self.y -= distanceCounter;
          }
        }
        //OFFSET TO SET OUT OF WALL
        switch (DIRECTION.Next()) {
          case "DOWN":
            self.y += distanceCounter;
            break;
          case "LEFT":
            self.x -= distanceCounter;
            break;
          case "RIGHT":
            self.x += distanceCounter;
            break;
          case "UP":
            self.y -= distanceCounter;
            break;
        }
        firstIteration = false;
      }
    }
  };

  self.getInitPack = function(){
    return {
      id:          self.id,
      name:        self.name,
      x:           self.x,
      y:           self.y,
      width:       self.width,
      height:      self.height,
      hp:          self.hp,
      hpMax:       self.hpMax,
      stamina:     self.stamina,
      maxStamina:  self.maxStamina,
      score:       self.score,
      killCount:   self.killCount,
      deathCount:  self.deathCount,
      team:        self.team,
      canInteract: self.canInteract,
      interactTimer: self.interactTimer,
      timeToInteract: self.timeToInteract
    }
  };
  self.getUpdatePack = function(){
    return {
      id:          self.id,
      name:        self.name,
      x:           self.x,
      y:           self.y,
      width:       self.width,
      height:      self.height,
      hp:          self.hp,
      hpMax:       self.hpMax,
      stamina:     self.stamina,
      score:       self.score,
      killCount:   self.killCount,
      deathCount:  self.deathCount,
      team:        self.team,
      canInteract: self.canInteract,
      interactTimer: self.interactTimer
    }
  };

  Player.list[id] = self;
  initPack.player.push(self.getInitPack());
  return self;
};

Player.list = {};

Player.onConnect = function(socket) {
  var player = Player(socket.id);
  if(teams.attacker.players.length > teams.defender.players.length){
    player.team = 'defender';
    teams.defender.players.push(player);
  }else {
    player.team = 'attacker';
    teams.attacker.players.push(player);
  }
  player.reSpawn();

  socket.on('keyPress', function(data){
    switch (data.inputId) {
      case 'left':
        player.pressingLeft = data.state;
        break;
      case 'right':
        player.pressingRight = data.state;
        break;
      case 'up':
        player.pressingUp = data.state;
        break;
      case 'down':
        player.pressingDown = data.state;
        break;
      case 'shift':
        player.pressingShift = data.state;
        break;
      case 'attack':
        player.pressingAttack = data.state;
        break;
      case 'mouseAngle':
        player.mouseAngle = data.state;
        break;
      case 'interact':
        player.pressingInteract = data.state;
        break;
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
    areas:  areas
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
  var player = Player.list[socket.id];
  teams.removePlayer(player);
  delete Player.list[socket.id];
  removePack.player.push(socket.id);
  teams.autoBalance();
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

var teams = {
  attacker: {
    score: 0,
    players: [],
    spawnArea: {
      x: 0,
      y: 0,
      width: 150,
      height: MAPHEIGHT
    }
  },
  defender: {
    score: 0,
    players: [],
    spawnArea: {
      x: MAPWIDTH - 150,
      y: 0,
      width: 150,
      height: MAPHEIGHT
    }
  },
  autoBalance: function () {
    if(teams.attacker.players.length > teams.defender.players.length + 1){
      teams.attacker.players[teams.attacker.players.length - 1].team = 'defender';
      teams.defender.players.push(teams.attacker.players.pop());
    }
    if(teams.attacker.players.length + 1 < teams.defender.players.length ){
      teams.defender.players[teams.defender.players.length - 1].team = 'attacker';
      teams.attacker.players.push(teams.defender.players.pop());
    }
  },
  removePlayer: function (player) {
    if (player.team === 'attacker'){
      teams.attacker.players.splice(teams.attacker.players.indexOf(player), 1);
    } else {
      teams.defender.players.splice(teams.defender.players.indexOf(player), 1);
    }
  }
};

var plantArea = {
  x: 50 + MAPWIDTH / 2 + Math.random() * 50,
  y: Math.random() * (MAPHEIGHT - 250),
  width: 200 + Math.random() * 50,
  height: 200 + Math.random() * 50,
};

var areas = {
  attacker: teams.attacker.spawnArea,
  defender: teams.defender.spawnArea,
  plant: plantArea
};

var Bullet = function(parent, angle){
  var self = Entity();
  self.id =       Math.random();
  self.parent =   parent;
  self.maxSpeed = 8;
  self.width =    5;
  self.height =   5;
  self.damage =   40;
  self.speedX =   Math.cos(angle/180*Math.PI) * self.maxSpeed;
  self.speedY =   Math.sin(angle/180*Math.PI) * self.maxSpeed;

  self.timer =    0;
  self.maxTime =  200;
  self.toRemove = false;

  self.friendlyFire = false;

  var super_update = self.update;
  self.update = function(){
    if(self.timer++ > self.maxTime){
      self.toRemove = true;
    }
    super_update();

    self.speedX /= 1.005;
    self.speedY /= 1.005;
    self.damage /= 1.015;

    for (var i in Wall.list) {
      var wall = Wall.list[i];
      if(self.isCollidingWithRect(wall)){
        self.toRemove = true;
      }
    }

    for (var i in Player.list) {
      var player = Player.list[i];
      if(self.isCollidingWithRect(player)){
        var shooter = Player.list[self.parent];
        var isOpponent = false;
        if (shooter === player){
          isOpponent = false;
        }else if(self.friendlyFire || self.parent === 'bomb'){
          isOpponent = true;
        }else if(shooter.team !== player.team){
          isOpponent = true;
        }
        if (isOpponent){
          player.hp -= self.damage;
          if (player.hp<0){
            if (shooter){
              shooter.score++;
              shooter.killCount++;
            }
            player.deathCount++;
            player.reSpawn();
          }
          self.toRemove = true;
        }
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
  if (bomb !== undefined){
    updatePack.bomb = Bomb.update();
  }
  updatePack.attackerScore = teams.attacker.score;
  updatePack.defenderScore = teams.defender.score;

  for (var id in SOCKET_LIST){
    var socket = SOCKET_LIST[id];
    socket.emit('init', initPack);
    socket.emit('update', updatePack);
    socket.emit('remove', removePack);
  }

  initPack.player = [];
  initPack.bullet = [];
  initPack.wall = [];
  initPack.bomb = undefined;

  removePack.player = [];
  removePack.bullet = [];
  removePack.wall = [];

}, 1000/40);
