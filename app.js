let express = require('express');
let app = express();
let serv = require('http').Server(app);

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

let SOCKET_LIST = {};

let initPack = {player:[], bullet:[], wall:[], bomb: undefined, areas:{}};
let removePack = {player:[], bullet:[], wall:[]};
let MAPWIDTH = 2000;
let MAPHEIGHT = 1000;
let playerCount = 0;

let plantAreaA =  function () {
  return {
    x: 50 + MAPWIDTH / 2 + Math.random() * 500,
    y: Math.random() * (MAPHEIGHT/2 - 250),
    width: 200 + Math.random() * 50,
    height: 200 + Math.random() * 50,
  }
};

let plantAreaB = function () {
  return {
    x: 50 + MAPWIDTH / 2 + Math.random() * 500,
    y: Math.random() * (MAPHEIGHT/2 - 250) + MAPHEIGHT/2,
    width: 200 + Math.random() * 50,
    height: 200 + Math.random() * 50,
  }
};

let attackerSpawnArea = function () {
  return{
    x: 0,
    y: 0,
    width: 150,
    height: MAPHEIGHT
  }
};

let defenderSpawnArea = function () {
  return {
    x: MAPWIDTH - 150,
    y: 0,
    width: 150,
    height: MAPHEIGHT
  }
};

let areas = {
  attacker: attackerSpawnArea(),
  defender: defenderSpawnArea(),
  plantA: plantAreaA(),
  plantB: plantAreaB()
};

let Entity = function(){
  let self = {
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
  self.isInsideRect = function(rect){
    return (rect.x + rect.width > self.x + self.width &&
            rect.y + rect.height > self.y + self.height &&
            rect.x < self.x &&
            rect.y < self.y);
  };
  self.isInsidePlantArea = function(){
    return (self.isInsideRect(areas.plantA) || self.isInsideRect(areas.plantB));
  };

  self.isNearToOtherPlayer = function(){
    for (let i in Player.list){
      let prop = {
        x: Player.list[i].x - 400,
        y: Player.list[i].y - 400,
        width: Player.list[i].width + 800,
        height: Player.list[i].height + 800
      }
    
      if (self.isInsideRect(prop)) {
        return true;
      }
    };
    return false;
  };

  self.getDistance = function(pt){
    let distance = Math.sqrt(Math.pow(self.x + (self.width/2) - pt.x + (pt.width/2), 2) +
                                Math.pow(self.y + (self.height/2) - pt.y + (pt.height/2), 2));
    return distance;
  };

  return self;
};

let Wall = function (startPoint, width, height) {
  let self =        Entity();
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
    self.x = point.x - self.width;
    self.y = point.y - self.height;
    Wall.list[self.id] = self;
    initPack.wall.push(self.getInitPack());
    return self;
  };

  Wall.list[self.id] = self;
  initPack.wall.push(self.getInitPack());
  return self;
};
Wall.list = {};

Wall.getAllInitpack = function(){
  let walls = [];
  for(let id in Wall.list){
    walls.push(Wall.list[id].getInitPack());
  }
  return walls;
};

let HorizontalWall = function (startPoint, length) {
  return new Wall(startPoint, length, 8);
};

let VerticalWall = function (startPoint, length) {
  return new Wall(startPoint, 8, length);
};

let House = function () {
  let minDistanceXBorder = 250;
  let minDistanceYBorder = 40;
  let self = {
    id:                   Math.random(),
    widthMin:             200,
    heightMin:            180,
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
    for(let i in House.list){
      if (House.list[i].id !== self.id){
        if(self.isTooCloseToRect(House.list[i])){
          return true;
        }
      }
    }
    return false;
  };

  let tryCount = 0;
  do {
    self.width = self.widthMin + Math.random() * self.widthVariation;
    self.height = self.heightMin + Math.random() * self.heightVariation;
    self.x = minDistanceXBorder + Math.random() * (MAPWIDTH - minDistanceXBorder * 2 - self.width);
    self.y = minDistanceYBorder + Math.random() * (MAPHEIGHT - minDistanceYBorder * 2 - self.height);
  } while (self.isTooCloseToAnyHouse() && tryCount++ < MAPHEIGHT/4);
  if (tryCount >= MAPHEIGHT/4){
    return;
  }

  let numberOfDoors =  1 + Math.ceil(Math.random() * 3);
  let doorPos = {
    leftWall: false,
    topWall: false,
    rightWall: false,
    bottomWall: false,
  };

  let setDoorPositions = function () {
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

  let makeLeftWall = function () {
    let partWalls = {};
    let topWallStartPos = {x: self.x-1, y: self.y};
    if(doorPos.leftWall){
      let topWallLength = Math.random() * (self.height - self.doorSize);
      let bottomWallLength = self.height - self.doorSize - topWallLength;
      let bottomWallStartPos = {x: self.x, y: self.y + self.doorSize + topWallLength};
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
  let makeTopWall = function () {
    let partWalls = {};
    let leftWallStartPos = {x: self.x, y: self.y};
    if(doorPos.topWall){
      let leftWallLength = Math.random() * (self.width - self.doorSize);
      let rightWallLength = self.width - self.doorSize - leftWallLength;
      let rightWallStartPos = {x: self.x + self.doorSize + leftWallLength, y: self.y};
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
  let makeRightWall = function () {
    let partWalls = {};
    let topWallStartPos = {x: self.x + self.width, y: self.y};
    if(doorPos.rightWall){
      let topWallLength = Math.random() * (self.height - self.doorSize);
      let bottomWallLength = self.height - self.doorSize - topWallLength;
      let bottomWallStartPos = {x: self.x + self.width, y: self.y + self.doorSize + topWallLength};
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
  let makeBottomWall = function () {
    let partWalls = {};
    let leftWallStartPos = {x: self.x, y: self.y + self.height};
    if(doorPos.bottomWall){
      let leftWallLength = Math.random() * (self.width - self.doorSize);
      let rightWallLength = self.width - self.doorSize - leftWallLength;
      let rightWallStartPos = {x: self.x + self.doorSize + leftWallLength, y: self.y + self.height};
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

  let rightWall = makeRightWall();
  let topWall = makeTopWall();
  let leftWall = makeLeftWall();
  let bottomWall = makeBottomWall();

  let interiorWalls = [];
  let makeInteriorWalls = function() {
    let wallToExtend;
    let wall;
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
        wall = new HorizontalWall({x:0, y: 0}, 20 + Math.random() * (self.width * 0.7 - 20));
        wall = wall.endAtPoint(wallToExtend.getCenterPoint());
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
        wall = new VerticalWall(wallToExtend.getCenterPoint(), 20 + Math.random() * (self.height * 0.7 - 20));
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
        wall = new HorizontalWall(wallToExtend.getCenterPoint(), 20 + Math.random() * (self.width * 0.7 - 20));
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
        wall = new VerticalWall({x: 0, y: 0}, 50 + Math.random() * (self.height * 0.7 - 50));
        wall = wall.endAtPoint(wallToExtend.getCenterPoint());
        interiorWalls.push(wall);
        break;
    }
  };

  makeInteriorWalls();

  House.list[self.id] = self;
  return self;
};
House.list = {};

let createNewMap = function () {
  MAPWIDTH = 2000 + (playerCount * 100);
  MAPHEIGHT = 1000 + (playerCount * 100);
  areas = {
    attacker: attackerSpawnArea(),
    defender: defenderSpawnArea(),
    plantA: plantAreaA(),
    plantB: plantAreaB()
  };
  initPack.areas = areas;
  House.list = {};
  for (let id in Wall.list){
    delete Wall.list[id];
    removePack.wall.push(id);
  }

  let topWall = new Wall({x: 0, y: 0}, MAPWIDTH, 10);
  let rightWall = new Wall(topWall.getEndPoint(), 10, MAPHEIGHT);
  let leftWall = new Wall(topWall.startPoint, 10, MAPHEIGHT);
  let bottomWall = new Wall(leftWall.getEndPoint(), MAPWIDTH, 10);

  for (let i = 0; i < 5 + playerCount; i++){
    House();
  }
};

createNewMap();

let Mine = function(parent){
  let self =  Bullet(parent, 0);
  self.width = 15;
  self.height = 15;
  self.x = parent.x + parent.width/2 - self.width/2;
  self.y = parent.y + parent.width/2 - self.width/2;
  self.speedX = 0;
  self.speedY = 0;
  self.bulletSpeed = 6;
  self.bulletSize = 3;
  self.bulletDamage = 5;
  self.opacity = 255;

  self.explode = function() {
    for (let i = 0; i < 25; i++) {
      let angle = Math.random() * 360;
      let bullet = Bullet(parent, angle);
      bullet.width = self.bulletSize;
      bullet.height = self.bulletSize;
      bullet.x = self.x + self.width/2 + bullet.width/2;
      bullet.y = self.y + self.height/2 + bullet.height/2;
      bullet.speedX =   Math.cos(angle/180*Math.PI) * self.bulletSpeed;
      bullet.speedY =   Math.sin(angle/180*Math.PI) * self.bulletSpeed;
      bullet.maxSpeed = self.bulletSpeed;
      bullet.damage = self.bulletDamage;
      bullet.maxTime = 100;
    }
  };

  self.update = function () {
    self.opacity--;
    for (let i in Player.list) {
      let player = Player.list[i];
      if (!player.isDead){
        if(self.isCollidingWithRect(player)){
          let shooter = self.parent;
          let isOpponent = false;
          if (shooter === player){
            isOpponent = false;
          }else if(self.friendlyFire || self.parent.id === 'bomb'){
            isOpponent = true;
          }else if(shooter.team !== player.team){
            isOpponent = true;
          }
          if (isOpponent){
            self.explode();
            self.toRemove = true;
          }
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
      opacity: self.opacity,
    }
  };

  self.getUpdatePack = function() {
    return {
      id:      self.id,
      x:      self.x,
      y:      self.y,
      opacity: self.opacity,
    }
  };

  initPack.bullet.push(self.getInitPack());
};

let Bomb = function () {
  let self = Entity();
  self.id = 'bomb';
  self.name = 'Bomb';
  self.team = 'attacker';
  self.width = 10;
  self.height = 10;
  self.defused = false;
  self.timer = 0;
  self.timeToExplode = 1000 / 40 * 40;
  self.bulletSpeed = 8;
  self.bulletSize = 3;

  self.explode = function() {
    for (let i = 0; i < 50; i++){
      let bullet = Bullet(self, Math.random()*360);
      bullet.x = self.x;
      bullet.y = self.y;
      bullet.damage = 40;
    }
    bomb = undefined;
    teams.handleAttackerWin();
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

let bomb = undefined;

Bomb.update = function () {
  bomb.update();
  if(bomb !== undefined){
    return bomb.getUpdatePack();
  }
  return undefined
};

let LevelUPCards = [
  {
    text: "+15DMG",
    doUpgrade: function (player) {
      player.bulletDamage += 15
    }
  },
  {
    text: "+HP Regen",
    doUpgrade: function (player) {
      player.regenaration += 0.1
    }
  },
  {
    text: "+LifeSteal",
    doUpgrade: function (player) {
      player.lifeSteal += 0.05
    }
  },
  {
    text: "+RELOAD",
    doUpgrade: function (player) {
      player.reloadTime /= 1.2
    }
  },
  {
    text: "+ATKSPD",
    doUpgrade: function (player) {
      player.attackRate /= 1.3
    }
  },
  {
    text: "+20HP",
    doUpgrade: function (player) {
      player.hpMax += 20
    }
  },
  {
    text: "+10Ammo",
    doUpgrade: function (player) {
      player.maxAmmo += 10
    }
  },
  {
    text: "+MoveSPD",
    doUpgrade: function (player) {
      player.defaultMaxSpeed += 1.2;
      player.sprintMaxSpeed += 1.2;
    }
  },
  {
    text: "+10%CDR",
    doUpgrade: function (player) {
      player.specQCD *= 0.9;
      player.specECD *= 0.9;
    }
  },
  {
    text: "+BulletSize",
    doUpgrade: function (player) {
      player.bulletSize += 2.5;
    }
  },
  {
    text: "+BulletSpeed",
    doUpgrade: function (player) {
      player.bulletSpeed += 2;
    }
  },
  {
    text: "+1Bullet",
    doUpgrade: function (player) {
      player.bulletCount++;
    }
  }
]


let Player = function(id){
  let self = Entity();

  self.id =             id;
  self.name =           "unnamed";
  self.xp =             0;
  self.level =          1;
  self.upgradeCounter = 0;
  self.avaliableUpgrades = [];
  self.width =          20;
  self.height =         20;
  self.hp =             100;
  self.hpMax =          100;
  self.regenaration =   0.05;
  self.isDead =         true;
  self.score =          0;
  self.killCount =      0;
  self.deathCount =     0;
  self.pressingRight =  false;
  self.pressingLeft =   false;
  self.pressingUp =     false;
  self.pressingDown =   false;
  self.pressingShift =  false;
  self.pressingAttack = false;
  self.pressingSpecQ =  false;
  self.pressingSpecE =  false;
  self.specQTimer =     0;
  self.specETimer =     0;
  self.specQCD =        1000 / 40 * 8;
  self.specECD =        1000 / 40 * 10;
  self.recoil =         8;
  self.mouseAngle =     0;
  self.speedX =         0;
  self.speedY =         0;
  self.maxSpeed =       3;
  self.defaultMaxSpeed = 3;
  self.sprintMaxSpeed = 6;
  self.maxStamina =     100;
  self.stamina =        100;
  self.acceleration =   0.25;
  self.maxAmmo =        30;
  self.ammo =           30;
  self.bulletDamage =   40;
  self.bulletSpeed =    8;
  self.bulletSize =     5;
  self.bulletCount =    1;
  self.lifeSteal =      0;
  self.reloadTimer =    0;
  self.reloadTime =     1000 / 10;
  self.isReloading =    false;
  self.pressingReload = false;
  self.attackTimer =    0;
  self.attackRate =     1000 / 100;
  self.team =           '';
  self.pressingInteract = false;
  self.canInteract =    false;
  self.isInteracting =  false;
  self.interactTimer =  0;
  self.timeToInteract = 1000 / 40 * 6;
  self.class =          "assault";
  self.changeClassTo =  "";
  self.isInvisible = false;
  self.damagedBy = [];

  let super_update = self.update;
  self.update = function () {
    self.updateSpeed();
    super_update();
    if(!self.isDead){
      self.handleOutsideMap();
      self.handleWallCollision();
      self.updateCanInteract();
      self.updateInteracting();

      if (self.hp<self.hpMax) {
        self.hp += self.regenaration
      }

      self.attackTimer++;
      if (self.pressingAttack &&
        self.attackTimer >= self.attackRate &&
        !self.isInteracting &&
        !self.isReloading &&
        self.ammo > 0){
          if (self.nextAttack){
            self.nextAttack();
            self.nextAttack = undefined;
          } else {
            self.shoot();
          }
          self.attackTimer = 0;
          self.ammo--;
      }
      if (self.pressingReload && self.ammo < self.maxAmmo && !self.isInteracting){
        self.isReloading = true
      }
      if (self.isReloading){
        if (self.reloadTimer++ >= self.reloadTime){
          self.ammo = self.maxAmmo;
          self.isReloading = false;
          self.reloadTimer = 0;
        }
      }
      if (self.specQTimer < self.specQCD){
        self.specQTimer++;
      }
      if (self.specETimer < self.specECD){
        self.specETimer++;
      }
      if (self.specQTimer >= self.specQCD && self.pressingSpecQ){
        self.specQTimer = 0;
        self.specQ();
      }
      if (self.specETimer >= self.specECD && self.pressingSpecE){
        self.specETimer = 0;
        self.specE();
      }
      if (self.specQDurationTimer !== undefined){
        if (self.specQDurationTimer++ > self.specQDuration){
          self.specQDisable();
        }
      }
      if (self.specEDurationTimer !== undefined){
        if (self.specEDurationTimer++ > self.specEDuration){
          self.specEDisable();
        }
      }
    }
  };

  self.specQ = function () {
    if(self.hp < self.hpMax){
      self.hp += 20;
    }
    if(self.hp > self.hpMax){
      self.hp = self.hpMax;
    }
  };
  self.specE = function () {
    var flashDistance = 100;
    self.x += Math.cos(self.mouseAngle/180*Math.PI) * flashDistance;
    self.y += Math.sin(self.mouseAngle/180*Math.PI) * flashDistance;
  };

  self.handleClassChange = function(){
    switch (self.changeClassTo) {
      case "":
        break;
      case 'assault':
        self.becomeAssault();
        break;
      case 'shotgun':
        self.becomeShotgun();
        break;
      case 'minigun':
        self.becomeMinigun();
        break;
      case 'sniper':
        self.becomeSniper();
        break;
    }
  };

  self.becomeAssault = function(){
    self.recoil =           8;
    self.maxAmmo =          30;
    self.bulletDamage =     40;
    self.bulletSpeed =      8;
    self.bulletSize =       5;
    self.bulletCount =      1;
    self.maxSpeed =         3;
    self.defaultMaxSpeed =  3;
    self.sprintMaxSpeed =   6;
    self.acceleration =     0.25;
    self.attackRate =       1000 / 100;
    self.reloadTime =       1000 / 10;
    self.specQCD =          1000 / 40 * 12;
    self.specECD =          1000 / 40 * 15;
    self.class =            "assault";
    self.changeClassTo =    "";

    self.specQ = function () {
      if(self.hp < self.hpMax){
        self.hp += 20;
      }
      if(self.hp > self.hpMax){
        self.hp = self.hpMax;
      }
    };
    self.specE = function () {
      var flashDistance = 100;
      self.x += Math.cos(self.mouseAngle/180*Math.PI) * flashDistance;
      self.y += Math.sin(self.mouseAngle/180*Math.PI) * flashDistance;
    };
  };

  self.becomeShotgun = function(){
    self.recoil =           20;
    self.maxAmmo =          8;
    self.bulletDamage =     20;
    self.bulletSpeed =      8;
    self.bulletSize =       4;
    self.bulletCount =      6;
    self.maxSpeed =         3;
    self.defaultMaxSpeed =  3;
    self.sprintMaxSpeed =   6;
    self.acceleration =     0.23;
    self.attackRate =       1000 / 70;
    self.reloadTime =       1000 / 8;
    self.specQCD =          1000 / 40 * 10;
    self.specECD =          1000 / 40 * 7;
    self.specQDuration =    1000 / 40 * 5;
    self.specQDurationTimer = undefined;
    self.class =            "shotgun";
    self.changeClassTo =    "";

    self.specQ = function () {
      self.specQEnable();
    };

    self.specQEnable = function (){
      self.maxSpeed +=         3;
      self.defaultMaxSpeed +=  3;
      self.sprintMaxSpeed +=   3;
      self.acceleration =     1;
      self.specQDurationTimer = 0;
    };

    self.specQDisable = function(){
      self.maxSpeed -=         3;
      self.defaultMaxSpeed -=  3;
      self.sprintMaxSpeed -=   3;
      self.acceleration =     0.23;
      self.specQDurationTimer = undefined;
    };

    self.specE = function () {
      self.nextAttack = function () {
        for (let i = -6; i < 6; i++){
          self.shootBullet(i*2 + self.mouseAngle + Math.random() * self.recoil - self.recoil/2)
        }
      }
    };
  };

  self.becomeMinigun = function(){
    self.recoil =           15;
    self.maxAmmo =          100;
    self.bulletDamage =     20;
    self.bulletSpeed =      8;
    self.bulletSize =       3;
    self.bulletCount =      1;
    self.maxSpeed =         2.5;
    self.defaultMaxSpeed =  2.5;
    self.sprintMaxSpeed =   5;
    self.acceleration =     0.2;
    self.attackRate =       1000 / 500;
    self.reloadTime =       1000 / 4;
    self.specQCD =          1000 / 40 * 25;
    self.specECD =          1000 / 40 * 20;
    self.specQDuration =    1000 / 40 * 10;
    self.class =            "minigun";
    self.changeClassTo =    "";

    self.specQ = function () {
      self.specQEnable();
    };
    self.specE = function () {
      self.ammo = self.maxAmmo;
      self.isReloading = false;
      self.reloadTimer = 0;
    };

    self.specQEnable = function () {
      self.isInvisible = true;
      self.specQDurationTimer = 0;
      
      self.nextAttack = function () {
        self.isInvisible = false;
        self.shoot()
      }
    };

    self.specQDisable = function () {
      self.isInvisible = false;
      self.specQDurationTimer = undefined;
    };
  };

  self.becomeSniper = function(){
    self.recoil =           0;
    self.maxAmmo =          5;
    self.bulletDamage =     110;
    self.bulletSpeed =      15;
    self.bulletSize =       5;
    self.bulletCount =      1;
    self.maxSpeed =         2.75;
    self.defaultMaxSpeed =  2.75;
    self.sprintMaxSpeed =   6.5;
    self.acceleration =     0.175;
    self.attackRate =       1000 / 40;
    self.reloadTime =       1000 / 8;
    self.specQCD =          1000 / 40 * 15;
    self.specECD =          1000 / 40 * 15;
    self.specQDuration =    1000 / 40 * 5;
    self.class =            "sniper";
    self.changeClassTo =    "";

    self.specQ = function () {
      self.specQEnable();
    };
    self.specE = function () {
      new Mine(self);
    };

    self.specQEnable = function () {
      self.attackRate = 1000 / 40 / 2;
      self.specQDurationTimer = 0;
    };

    self.specQDisable = function () {
      self.attackRate =       1000 / 40;
      self.specQDurationTimer = undefined;
    };
  };

  self.updateCanInteract = function(){
    self.canInteract = false;
    if (self.speedX === 0 && self.speedY === 0 && !self.isReloading){
      if (self.team === 'attacker'){
        if (bomb === undefined){
          if (self.isInsidePlantArea() && !round.isRestarting){
            self.canInteract = true;
          }
        }
      }else {
        if (bomb && !bomb.defused){
          if (self.isCollidingWithRect(bomb)){
            self.canInteract = true;
          }
        }
      }
    }
  };

  self.updateInteracting = function(){
    if(self.pressingInteract && self.canInteract){
      self.isInteracting = true;
      if (self.interactTimer++ > self.timeToInteract){
        self.interact();
      }
    } else {
      self.isInteracting = false;
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
      teams.handleDefenderWin();
    }
    self.score += 2;
    self.xp += 5;
  };

  self.shootBullet = function(angle){
    let bullet = Bullet(self, angle);
    bullet.x = self.x + self.width/2 - bullet.width;
    bullet.y = self.y + self.height/2 - bullet.height;
  };

  self.shootNBullets = function(n){
    let angle = self.mouseAngle + Math.random() * self.recoil - self.recoil/2
    let bullet = Bullet(self, angle);
    bullet.x = self.x + self.width/2 - bullet.width;
    bullet.y = self.y + self.height/2 - bullet.height;
    if (n>1)
      setTimeout(self.shootNBullets, 3, n-1)
  };

  self.shoot = function(){
    self.shootNBullets(self.bulletCount);
  };

  self.isCollidingWithAnyWalls = function() {
    for(let i in Wall.list){
      if(self.isCollidingWithRect(Wall.list[i])){
        return true;
      }
    }
    return false;
  };

  self.updateSpeed = function(){
    if (self.isDead){
      self.stamina++;
    }

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
    } else if (!self.pressingShift&&
      self.stamina < self.maxStamina) {
      self.stamina+=0.15;
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

  self.timeoutId = null
  self.reSpawn = function () {
    if (!self.timeoutId) {
      self.timeoutId = setTimeout(() => {
        self.handleClassChange();
        self.speedX = 0;
        self.speedY = 0;
        self.hp = self.hpMax;
        self.isDead = false;
        self.stamina = self.maxStamina;
        self.ammo = self.maxAmmo;
        self.isReloading = false;
        self.reloadTimer = 0;
        self.specQTimer = self.specQCD;
        self.specETimer = self.specECD;
        if(self.team === 'attacker'){
          do {
            self.x = Math.random() * areas.attacker.width + areas.attacker.x;
            self.y = Math.random() * areas.attacker.height + areas.attacker.y
          } while (!self.isInsideRect(areas.attacker));
        } else if (self.team === 'defender') {
          do {
            self.x = Math.random() * areas.defender.width + areas.defender.x;
            self.y = Math.random() * areas.defender.height + areas.defender.y;
          } while (!self.isInsideRect(areas.defender));
        } else {
          do {
            self.x = Math.random() * MAPWIDTH;
            self.y = Math.random() * MAPHEIGHT;
          } while (!self.isNearToOtherPlayer());
      }
        

        self.timeoutId = null;
      },2000);
    }
  };

  let distanceCounter = 1;
  let DIRECTION = ["UP", "RIGHT", "DOWN", "LEFT"];
  DIRECTION.counter = 0;
  DIRECTION.Next = function () {
    if (DIRECTION.counter++ > 3){
      DIRECTION.counter = 0;
      distanceCounter++;
    }
    return DIRECTION[DIRECTION.counter];
  };

  self.handleWallCollision = function () {
    let firstIteration = false;
    for (let i in Wall.list){
      let wall = Wall.list[i];
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

  self.handleOutsideMap = function (){
    if (self.x < 0){
      self.x = 0;
    }
    if (self.x > MAPWIDTH){
      self.x = MAPWIDTH - 10;
    }
    if (self.y < 0){
      self.y = 0;
    }
    if (self.y > MAPHEIGHT){
      self.y = MAPHEIGHT - 10;
    }
  };

  self.getInitPack = function(){
    return {
      id:             self.id,
      name:           self.name,
      xp:             self.xp,
      level:          self.level,
      upgradeCounter: self.upgradeCounter,
      avaliableUpgrades: self.avaliableUpgrades,
      x:              self.x,
      y:              self.y,
      width:          self.width,
      height:         self.height,
      hp:             self.hp,
      hpMax:          self.hpMax,
      isDead:         self.isDead,
      stamina:        self.stamina,
      maxStamina:     self.maxStamina,
      score:          self.score,
      killCount:      self.killCount,
      deathCount:     self.deathCount,
      team:           self.team,
      canInteract:    self.canInteract,
      interactTimer:  self.interactTimer,
      timeToInteract: self.timeToInteract,
      maxAmmo:        self.maxAmmo,
      ammo:           self.ammo,
      reloadTimer:    self.reloadTimer,
      reloadTime:     self.reloadTime,
      isReloading:    self.isReloading,
      specQTimer:     self.specQTimer,
      specQCD:        self.specQCD,
      specETimer:     self.specETimer,
      specECD:        self.specECD,
      isInvisible:    self.isInvisible,
    }
  };
  self.getUpdatePack = function(){
    return {
      id:          self.id,
      name:        self.name,
      xp:          self.xp,
      level:       self.level,
      upgradeCounter: self.upgradeCounter,
      avaliableUpgrades: self.avaliableUpgrades,
      x:           self.x,
      y:           self.y,
      width:       self.width,
      height:      self.height,
      hp:          self.hp,
      hpMax:       self.hpMax,
      isDead:      self.isDead,
      stamina:     self.stamina,
      score:       self.score,
      killCount:   self.killCount,
      deathCount:  self.deathCount,
      team:        self.team,
      canInteract: self.canInteract,
      interactTimer: self.interactTimer,
      ammo:           self.ammo,
      maxAmmo:        self.maxAmmo,
      reloadTimer:    self.reloadTimer,
      reloadTime:     self.reloadTime,
      isReloading:    self.isReloading,
      specQTimer:     self.specQTimer,
      specQCD:        self.specQCD,
      specETimer:     self.specETimer,
      specECD:        self.specECD,
      isInvisible:    self.isInvisible,
    }
  };

  Player.list[id] = self;
  initPack.player.push(self.getInitPack());
  return self;
};

Player.list = {};

Player.onConnect = function(socket) {
  let player = Player(socket.id);
  playerCount++;

  for (let i in Player.list){
    if (Player.list[i].id !== socket.id && !Player.list[i].isDead){
      player.x = Player.list[i].x;
      player.y = Player.list[i].y;
      break;
    }
  }
  if (round.selectedType == "base") {
    if(teams.attacker.players.length > teams.defender.players.length){
      player.team = 'defender';
      teams.defender.players.push(player);
    }else {
      player.team = 'attacker';
      teams.attacker.players.push(player);
    }
  }
  if (round.selectedType == "ffa") {
    player.team = Math.random()
  }


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
      case 'reload':
        player.pressingReload = data.state;
        break;
      case 'specQ':
        player.pressingSpecQ = data.state;
        break;
      case 'specE':
        player.pressingSpecE = data.state;
        break;
    }
  });

  socket.on('levelup', function(data){
    if (player.upgradeCounter>0 & player.avaliableUpgrades.length>0) {
      player.avaliableUpgrades[data].doUpgrade(player)
      player.avaliableUpgrades = []
      
      player.upgradeCounter--;
      if (player.upgradeCounter>1){
        while (player.avaliableUpgrades.length<3){

          randomItem = LevelUPCards[Math.floor(Math.random()*LevelUPCards.length)]
          if (!player.avaliableUpgrades.includes(randomItem)) {
            player.avaliableUpgrades.push(randomItem)
          }
        }
      }
    }
  });

  socket.on('newName', function(data){
    player.name = data.substr(0,16);
  });

  socket.on('changeClass', function(data) {
    player.changeClassTo = data;
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
  let players = [];
  for(let i in Player.list){
    players.push(Player.list[i].getInitPack());
  }
  return players;
};

Player.onDisconnect = function(socket){
  let player = Player.list[socket.id];
  teams.removePlayer(player);
  playerCount--;
  delete Player.list[socket.id];
  removePack.player.push(socket.id);
};

Player.update = function() {
  let packet = [];
  for (let id in Player.list){
    let player = Player.list[id];
    player.update();
    packet.push(player.getUpdatePack());
  }
  return packet;
};

let teams = {
  attacker: {
    score: 0,
    players: [],
    spawnArea: attackerSpawnArea
  },
  defender: {
    score: 0,
    players: [],
    spawnArea: defenderSpawnArea
  },
  autoBalance: function () {
    while(teams.attacker.players.length > teams.defender.players.length + 1){
      teams.attacker.players[teams.attacker.players.length - 1].team = 'defender';
      teams.defender.players.push(teams.attacker.players.pop());
    }
    while(teams.attacker.players.length + 1 < teams.defender.players.length ){
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
  },
  isAllAttackersDead: function () {
    if (teams.attacker.players.length > 0){
      for(let i = 0; i < teams.attacker.players.length; i++){
        if (!teams.attacker.players[i].isDead){
          return false;
        }
      }
      return true;
    }
    return false;
  },
  isAllDefendersDead: function () {
    if (teams.defender.players.length > 0){
      for(let i = 0; i < teams.defender.players.length; i++){
        if (!teams.defender.players[i].isDead){
          return false;
        }
      }
      return true;
    }
    return false;
  },
  handleAttackerWin: function () {
    teams.attacker.score++;
    for (let id in SOCKET_LIST){
      let socket = SOCKET_LIST[id];
      socket.emit('attackerWin');
      round.isFinished = true;
    }
  },
  handleDefenderWin: function () {
    teams.defender.score++;
    for (let id in SOCKET_LIST){
      let socket = SOCKET_LIST[id];
      socket.emit('defenderWin');
      round.isFinished = true;
    }
  }
};



let round = {
  maxTime: 120,
  timer: 120,
  counter: 0,
  isFinished: false,
  isRestarting: false,


  selectedType: "ffa", 

  gameTypes: {
    "base" : {
      update: function () {
        if(!round.isFinished && teams.attacker.players.length > 0){
          if(bomb !== undefined && bomb.defused){
            teams.handleDefenderWin();
          }
          if (round.timer <= 0){
            teams.handleDefenderWin();
          }
          if(bomb === undefined && teams.isAllAttackersDead()){
            teams.handleDefenderWin();
          }
          if(teams.isAllDefendersDead()){
            teams.handleAttackerWin();
          }
        }
      },
      startNewRound: function () {
        round.counter++;
    
        bomb = undefined;
        round.isFinished = false;
        round.isRestarting = false;
        round.maxTime = 200;
        round.timer = round.maxTime;
    
        teams.autoBalance();
        for (let i in Player.list){
          Player.list[i].handleClassChange();
          Player.list[i].reSpawn();
        }
        for (let i in Bullet.list){
          Bullet.list[i].toRemove = true;
        }
    
        createNewMap();
      }
    },
    "ffa": {
      update: function () {
        if (round.timer <= 0){
          teams.handleDefenderWin();
        }
        
        for (let i in Player.list){
          if (Player.list[i].isDead)
            Player.list[i].reSpawn();
        }

        handleLevelUp()

      },
      startNewRound: function () {
        round.counter++;
    
        bomb = undefined;
        round.isFinished = false;
        round.isRestarting = false;
        round.timer = 600;
        round.maxTime = 600;
    
        for (let i in Player.list){
          Player.list[i].reSpawn();
        }
        for (let i in Bullet.list){
          Bullet.list[i].toRemove = true;
        }
    
        createNewMap();
        areas.plantA.x = 0
        areas.plantA.y = 0
        areas.plantA.height = 0
        areas.plantA.width = 0
        areas.plantB.x = 0
        areas.plantB.y = 0
        areas.plantB.height = 0
        areas.plantB.width = 0
      }
    }
  },


  update: function () {
    if(!round.isFinished && teams.attacker.players.length > 0){
      if(bomb !== undefined && bomb.defused){
        teams.handleDefenderWin();
      }
      if (round.timer <= 0){
        teams.handleDefenderWin();
      }
      if(bomb === undefined && teams.isAllAttackersDead()){
        teams.handleDefenderWin();
      }
      if(teams.isAllDefendersDead()){
        teams.handleAttackerWin();
      }
    }
  },
};

let Bullet = function(parent, angle){
  let self = Entity();
  self.id =       Math.random();
  self.parent =   parent;
  self.maxSpeed = parent.bulletSpeed;
  self.width =    parent.bulletSize;
  self.height =   parent.bulletSize;
  self.damage =   parent.bulletDamage;
  self.speedX =   Math.cos(angle/180*Math.PI) * self.maxSpeed;
  self.speedY =   Math.sin(angle/180*Math.PI) * self.maxSpeed;

  self.timer =    0;
  self.maxTime =  200;
  self.toRemove = false;

  self.decreaseSpeed = 1.005;
  self.decreaseDamage = 1.010;
  if(parent.class === 'shotgun'){
    self.decreaseSpeed *= 1.007;
    self.decreaseDamage *= 1.01;
  }

  self.friendlyFire = false;

  let super_update = self.update;
  self.update = function(){
    if(self.timer++ > self.maxTime){
      self.toRemove = true;
    }
    super_update();

    self.speedX /= self.decreaseSpeed;
    self.speedY /= self.decreaseSpeed;
    self.damage /= self.decreaseDamage;

    for (let i in Wall.list) {
      let wall = Wall.list[i];
      if(self.isCollidingWithRect(wall)){
        self.toRemove = true;
      }
    }

    for (let i in Player.list) {
      let player = Player.list[i];
      if (!player.isDead){
        if(self.isCollidingWithRect(player)){
          let shooter = self.parent;
          let isOpponent = false;
          if (shooter === player){
            isOpponent = false;
          }else if(self.friendlyFire || self.parent.id === 'bomb'){
            isOpponent = true;
          }else if(shooter.team !== player.team){
            isOpponent = true;
          }
          if (isOpponent){
            player.hp -= self.damage;
            shooter.hp += self.damage * shooter.lifeSteal
            if (!player.damagedBy.includes(shooter))
              player.damagedBy.push(shooter)
            if (player.hp<0){
              player.damagedBy.forEach(assister => {
                assister.xp+=2;
              });
              player.damagedBy = []
              if (shooter){
                shooter.xp+=3;
                shooter.score++;
                shooter.killCount++;
              }
              player.isDead = true;
              player.deathCount++;

              if (player.xp<0)
                player.xp-=1;

              if (self.parent !== 'bomb'){
                sendKillFeed(shooter, player);
              }
            }
            self.toRemove = true;
          }
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
  let packet = [];
  for (let id in Bullet.list){
    let bullet = Bullet.list[id];
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
  let bullets = [];
  for(let id in Bullet.list){
    bullets.push(Bullet.list[id].getInitPack());
  }
  return bullets;
};

let sendKillFeed = function (shooter, killed) {
  let killFeedData = {
    shooterName:  shooter.name,
    shooterTeam:  shooter.team,
    killedName:   killed.name,
    killedTeam:   killed.team,
    opacity:      300
  };
  for (let id in SOCKET_LIST){
    let socket = SOCKET_LIST[id];
    socket.emit('killFeed', killFeedData);
  }
};

let io = require('socket.io')(serv,{});
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

function handleLevelUp() {
  for (let i in Player.list) {
    while (Player.list[i].xp > 9) {
      Player.list[i].xp -= 10;
      Player.list[i].level++;

      Player.list[i].upgradeCounter++;

      while (Player.list[i].avaliableUpgrades.length < 3) {

        randomItem = LevelUPCards[Math.floor(Math.random() * LevelUPCards.length)];
        if (!Player.list[i].avaliableUpgrades.includes(randomItem)) {
          Player.list[i].avaliableUpgrades.push(randomItem);
        }
      }
    }
  }
}

setInterval(function(){
  let updatePack = {
    player: Player.update(),
    bullet: Bullet.update(),
  };
  if (bomb !== undefined){
    updatePack.bomb = Bomb.update();
  }

  if(!round.isRestarting){
    round.gameTypes[round.selectedType].update();

    if(round.isFinished){
      round.isRestarting = true;
      
      handleLevelUp();
      setTimeout(round.gameTypes[round.selectedType].startNewRound, 8000) ;
    }
  }

  updatePack.attackerScore = teams.attacker.score;
  updatePack.defenderScore = teams.defender.score;

  for (let id in SOCKET_LIST){
    let socket = SOCKET_LIST[id];
    socket.emit('init', initPack);
    socket.emit('update', updatePack);
    socket.emit('remove', removePack);
  }

  initPack.player = [];
  initPack.bullet = [];
  initPack.wall = [];
  initPack.bomb = undefined;
  initPack.areas = {};

  removePack.player = [];
  removePack.bullet = [];
  removePack.wall = [];


  
}, 1000/40);

setInterval(function () {
  if(round.timer > 0 && bomb === undefined && !round.isRestarting){
    round.timer--;
  }
  for (let id in SOCKET_LIST){
    let socket = SOCKET_LIST[id];
    socket.emit('roundTime', round.timer);
  }
}, 1000);