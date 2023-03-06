let socket = io({transports: ['websocket']});
let display = document.getElementById("display");
let WIDTH = display.width;
let HEIGHT = display.height;
let MINIMAPSCALE = 0.1
let Xminimap = 10
let Yminimap = 450
let ctx = display.getContext("2d");
ctx.font = "10px Arial";

function emitNewName(){
  socket.emit('newName', nameBox.value);
}

let nameBox = document.getElementById("nameBox");
nameBox.addEventListener("change", emitNewName);
nameBox.addEventListener("onkeypress", emitNewName);

let areas = {
  attacker: {},
  defender: {},
  plantA: {},
  plantB: {},
};

let attackerScore = 0;
let defenderScore = 0;

let bomb = undefined;

let DebrisParticle = function(){
  let self = {
    id: Math.random(),
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    maxSpeed: 3,
  };
  self.speedX = Math.cos(Math.random() * 2 * Math.PI) * self.maxSpeed;
  self.speedY = Math.sin(Math.random() * 2 * Math.PI) * self.maxSpeed;
  self.toRemove = false;
  self.decreaseSpeed = 1.1;
  self.opacity = 150;

  self.isCollidingWithRect = function(rect){
    return (self.x < rect.x + rect.width &&
        self.x + self.width > rect.x &&
        self.y < rect.y + rect.height &&
        self.y + self.height > rect.y)
  };

  self.isCollidingWithAnything = function() {
    for(let i in Wall.list){
      if(self.isCollidingWithRect(Wall.list[i])){
        return true;
      }
    }
    for(let i in Player.list){
      if(self.isCollidingWithRect(Player.list[i])){
        return true;
      }
    }
    return false;
  };

  self.draw = function () {
    let x = self.x - Player.list[selfId].x + WIDTH / 2;
    let y = self.y - Player.list[selfId].y + HEIGHT / 2;
    let opacity;
    if (self.opacity > 255) {
      opacity = 'FF';
    } else {
      opacity = self.opacity.toString(16);
    }
    if (opacity.length < 2) {
      opacity = 0 + opacity;
    }
    ctx.fillStyle = "#303030" + opacity;
    ctx.fillRect(x, y, self.width, self.height);
  };


  self.update = function () {
    self.speedX /= self.decreaseSpeed;
    self.speedY /= self.decreaseSpeed;
    self.x += self.speedX;
    self.y += self.speedY;

    self.opacity -= 3;
    if(self.opacity <= 0 || self.isCollidingWithAnything()){
      delete DebrisParticle.list[self.id];
    }
  };

  DebrisParticle.list[self.id] = self;
  return self;
};
DebrisParticle.list = {};

let Player = function(initPack){
  let self = {};
  self.id =         initPack.id;
  self.name =       initPack.name;
  self.xp =         initPack.xp;
  self.level =      initPack.level;
  self.upgradeCounter = initPack.upgradeCounter;
  self.avaliableUpgrades = initPack.avaliableUpgrades;
  self.x =          initPack.x;
  self.y =          initPack.y;
  self.width =      initPack.width;
  self.height =     initPack.height;
  self.hp =         initPack.hp;
  self.hpMax =      initPack.hpMax;
  self.isDead =     initPack.isDead;
  self.stamina =    initPack.stamina;
  self.maxStamina = initPack.maxStamina;
  self.score =      initPack.score;
  self.killCount =  initPack.killCount;
  self.deathCount = initPack.deathCount;
  self.team =       initPack.team;
  self.canInteract = initPack.canInteract;
  self.pressingTab = false;
  self.interactTimer = initPack.interactTimer;
  self.timeToInteract = initPack.timeToInteract;
  self.maxAmmo =        initPack.maxAmmo;
  self.ammo =           initPack.ammo;
  self.reloadTimer =    initPack.reloadTimer;
  self.reloadTime =     initPack.reloadTime;
  self.isReloading =    initPack.isReloading;
  self.specQTimer =     initPack.specQTimer;
  self.specETimer =     initPack.specETimer;
  self.specQCD =        initPack.specQCD;
  self.specECD =        initPack.specECD;
  self.isInvisible =    initPack.isInvisible;


  self.draw = function(){
    if(!self.isDead){
      let x = self.x - Player.list[selfId].x + WIDTH/2;
      let y = self.y - Player.list[selfId].y + HEIGHT/2;

      let barWidth = 30;

      let hpWidth = barWidth * self.hp / self.hpMax;

      var opacity = 'FF';
      if (self.isInvisible){
        if(self.team === Player.list[selfId].team){
          opacity = '77';
        } else {
          opacity = '00';
        }
      }

      ctx.fillStyle = '#222222' + opacity;
      ctx.fillRect(x - barWidth/2 + self.width/2, y - 10, barWidth, 4);

      if (self.team !== Player.list[selfId].team){
        ctx.fillStyle = '#FF3622' + opacity;
      } else {
        ctx.fillStyle = '#23C216' + opacity;
      }
      ctx.fillRect(x - barWidth/2 + self.width/2, y - 10, hpWidth, 4);
      ctx.fillStyle = '#000000' + opacity;
      ctx.fillText(self.level+" "+self.name, x - ctx.measureText(self.level+" "+self.name).width/2 + self.width/2, y - 15);

      if (self.team === 'attacker'){
        ctx.fillStyle = '#ed5f2b' + opacity;
      } else {
        ctx.fillStyle = '#3694c7' + opacity;
      }
      ctx.fillRect(x, y, self.width, self.height);
    }
  };
  self.drawOnMiniMap = function(){
    if(!self.isDead & self.team === Player.list[selfId].team){
      let x = Xminimap + self.x * MINIMAPSCALE - self.width * MINIMAPSCALE * 2;
      let y = Yminimap + self.y * MINIMAPSCALE - self.width * MINIMAPSCALE * 2;


      var opacity = 'FF';
      if (self.isInvisible){
        if(self.team === Player.list[selfId].team){
          opacity = '77';
        } else {
          opacity = '00';
        }
      }

      if (self.team === 'attacker'){
        ctx.fillStyle = '#ed5f2b' + opacity;
      } else {
        ctx.fillStyle = '#3694c7' + opacity;
      }
      ctx.fillRect(x, y, self.width * MINIMAPSCALE * 2, self.height * MINIMAPSCALE * 2);
      if (self.id === selfId) 
      {
        ctx.fillStyle = "green"
        ctx.fillRect(x-2, y-2, self.width * MINIMAPSCALE * 2+2, self.height * MINIMAPSCALE * 2+2);

      }
    }
  };

  Player.list[self.id] = self;
  return self;
};
Player.list = {};

let Wall = function (initPack) {
  let self = {};
  self.id =     initPack.id;
  self.x =      initPack.x;
  self.y =      initPack.y;
  self.width =  initPack.width;
  self.height = initPack.height;

  self.topLeftPoint = {x: self.x, y: self.y, nextPoint: function () {
      return self.topRightPoint;
    }};
  self.topRightPoint = {x: self.x + self.width, y: self.y, nextPoint: function () {
      return self.bottomRightPoint;
    }};
  self.bottomLeftPoint = {x: self.x, y: self.y + self.height, nextPoint: function () {
      return self.topLeftPoint;
    }};
  self.bottomRightPoint = {x: self.x + self.width, y: self.y + self.height, nextPoint: function () {
      return self.bottomLeftPoint;
    }};

  self.draw = function () {
    let x = self.x - Player.list[selfId].x + WIDTH/2;
    let y = self.y - Player.list[selfId].y + HEIGHT/2;
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, self.width, self.height);
  };

  self.drawOnMiniMap = function () {
    let x = Xminimap + self.x * MINIMAPSCALE;
    let y = Yminimap + self.y * MINIMAPSCALE;
    ctx.fillStyle = "#000000AA";
    ctx.fillRect(x, y, self.width * MINIMAPSCALE, self.height * MINIMAPSCALE);
  }


  Wall.list[self.id] = self;
  return self;
};
Wall.list = {};


let Bullet = function(initPack){
  let self = {};
  self.id = initPack.id;
  self.x = initPack.x;
  self.y = initPack.y;
  self.width = initPack.width;
  self.height = initPack.height;

  if (initPack.opacity !== undefined){
    self.opacity = initPack.opacity;
    self.draw = function () {
      if (self.opacity > 0){
        let x = self.x - Player.list[selfId].x + WIDTH/2;
        let y = self.y - Player.list[selfId].y + HEIGHT/2;
        let opacity;
        if (self.opacity > 255){
          opacity = 'FF';
        } else {
          opacity = self.opacity.toString(16);
        }
        if (opacity.length < 2){
          opacity = 0 + opacity;
        }
        ctx.fillStyle = "#CC0000" + opacity;
        ctx.fillRect(x, y, self.width, self.height);
      }
    }
  } else {
    self.draw = function(){
      let x = self.x - Player.list[selfId].x + WIDTH/2;
      let y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, self.width, self.height);
    };
  }

  Bullet.list[self.id] = self;
  return self;
};
Bullet.list = {};

let selfId = null;

socket.on('init',function(data){
  if(data.selfId){
    selfId = data.selfId;
  }

  for(let i = 0 ; i < data.player.length; i++){
    new Player(data.player[i]);
  }
  if(data.wall){
    for(let i = 0; i < data.wall.length; i++){
      new Wall(data.wall[i]);
    }
  }
  if(data.bullet){
    for(let i = 0 ; i < data.bullet.length; i++){
      new Bullet(data.bullet[i]);
    }
  }
  if(data.areas){
    areas.attacker.x      = data.areas.attacker.x;
    areas.attacker.y      = data.areas.attacker.y;
    areas.attacker.width  = data.areas.attacker.width;
    areas.attacker.height = data.areas.attacker.height;

    areas.defender.x      = data.areas.defender.x;
    areas.defender.y      = data.areas.defender.y;
    areas.defender.width  = data.areas.defender.width;
    areas.defender.height = data.areas.defender.height;

    areas.plantA.x         = data.areas.plantA.x;
    areas.plantA.y         = data.areas.plantA.y;
    areas.plantA.width     = data.areas.plantA.width;
    areas.plantA.height    = data.areas.plantA.height;

    areas.plantB.x         = data.areas.plantB.x;
    areas.plantB.y         = data.areas.plantB.y;
    areas.plantB.width     = data.areas.plantB.width;
    areas.plantB.height    = data.areas.plantB.height;
  }
  if(data.bomb){
    bomb = data.bomb
  }
});

socket.on("update", function(data){
  for (let i = 0; i < data.player.length; i++) {
    let packet = data.player[i];
    let player = Player.list[packet.id];
    if(player){
      if(packet.name !== undefined){
        player.name = packet.name;
      }
      if(packet.x !== undefined){
        player.x = packet.x;
      }
      if(packet.y !== undefined){
        player.y = packet.y;
      }
      if(packet.xp !== undefined){
        player.xp = packet.xp;
      }
      if(packet.level !== undefined){
        player.level = packet.level;
      }
      if(packet.upgradeCounter !== undefined){
        player.upgradeCounter = packet.upgradeCounter;
      }
      if(packet.avaliableUpgrades !== undefined){
        player.avaliableUpgrades = packet.avaliableUpgrades;
      }
      if(packet.width !== undefined){
        player.width = packet.width;
      }
      if(packet.height !== undefined){
        player.height = packet.height;
      }
      if(packet.hp !== undefined){
        player.hp = packet.hp;
      }
      if(packet.hpMax !== undefined){
        player.hpMax = packet.hpMax;
      }
      if(packet.stamina !== undefined){
        player.stamina = packet.stamina;
      }
      if(packet.maxStamina !== undefined){
        player.maxStamina = packet.maxStamina;
      }
      if(packet.score !== undefined){
        player.score = packet.score;
      }
      if(packet.killCount !== undefined){
        player.killCount = packet.killCount;
      }
      if(packet.deathCount !== undefined){
        player.deathCount = packet.deathCount;
      }
      if(packet.team !== undefined){
        player.team = packet.team;
      }
      if(packet.canInteract !== undefined){
        player.canInteract = packet.canInteract;
      }
      if(packet.interactTimer !== undefined){
        player.interactTimer = packet.interactTimer;
      }
      if(packet.isDead !== undefined){
        player.isDead = packet.isDead;
      }
      if(packet.interactTime !== undefined){
        player.interactTime = packet.interactTime;
      }
      if(packet.ammo !== undefined){
        player.ammo = packet.ammo;
      }
      if(packet.maxAmmo !== undefined){
        player.maxAmmo = packet.maxAmmo;
      }
      if(packet.reloadTime !== undefined){
        player.reloadTime = packet.reloadTime;
      }
      if(packet.reloadTimer !== undefined){
        player.reloadTimer = packet.reloadTimer;
      }
      if(packet.isReloading !== undefined){
        player.isReloading = packet.isReloading;
      }
      if(packet.specQTimer !== undefined){
        player.specQTimer = packet.specQTimer;
      }
      if(packet.specETimer !== undefined){
        player.specETimer = packet.specETimer;
      }
      if(packet.specQCD !== undefined){
        player.specQCD = packet.specQCD;
      }
      if(packet.specECD !== undefined){
        player.specECD = packet.specECD;
      }
      if(packet.isInvisible !== undefined){
        player.isInvisible = packet.isInvisible;
      }
    }
  }
  for (let i = 0; i < data.bullet.length; i++) {
    let packet = data.bullet[i];
    let bullet = Bullet.list[packet.id];
    if (bullet){
      if(packet.x !== undefined){
        bullet.x = packet.x;
      }
      if(packet.y !== undefined){
        bullet.y = packet.y;
      }
      if(packet.width !== undefined){
        bullet.width = packet.width;
      }
      if(packet.height !== undefined){
        bullet.height = packet.height;
      }
      if(packet.opacity !== undefined){
        bullet.opacity = packet.opacity;
      }
    }
  }

  bomb = data.bomb;

  if (data.attackerScore !== undefined){
    attackerScore = data.attackerScore;
  }
  if (data.defenderScore !== undefined){
    defenderScore = data.defenderScore;
  }
});

socket.on('remove', function(data) {
  for (let i = 0; i < data.player.length; i++) {
    delete Player.list[data.player[i]];
  }
  for (let i = 0; i < data.bullet.length; i++) {
    for (let j = 0; j < 10; j++){
      let particle = new DebrisParticle();
      particle.x = Bullet.list[data.bullet[i]].x;
      particle.y = Bullet.list[data.bullet[i]].y;
    }
    delete Bullet.list[data.bullet[i]];
  }
  for (let i = 0; i < data.wall.length; i++){
    delete Wall.list[data.wall[i]];
  }
});

let roundTime = 0;

socket.on('roundTime', function (data) {
  if (data){
    roundTime = data;
  }
});

setInterval(function(){
  if(!selfId)
    return;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawAreas();

  for(let i in Player.list){
    Player.list[i].draw();
  }
  for(let i in Bullet.list){
    Bullet.list[i].draw();
  }
  for(let i in DebrisParticle.list){
    DebrisParticle.list[i].update();
  }
  for(let i in DebrisParticle.list){
    DebrisParticle.list[i].draw();
  }
  drawBomb();
  drawWallShadow();
  for(let i in Wall.list){
    Wall.list[i].draw();
    Wall.list[i].drawOnMiniMap();
  }
  drawAreasOnMinimap();

  for(let i in Player.list){
    Player.list[i].drawOnMiniMap();
  }

  drawXP();
  drawLevelUP();
  drawScore();
  drawPosition();
  drawTeamScore();
  drawAlivePlayerCount();
  drawRoundTime();
  drawKillFeed();
  drawWinText();
  if (!Player.list[selfId].isDead){
    drawInteract();
    drawHp();
    drawStamina();
    drawAmmo();
    drawSpec();
  }
  drawClassChange();

  if(Player.list[selfId].isDead){
    ctx.fillStyle = '#00000030';
    ctx.fillRect(0,0, WIDTH, HEIGHT);

    ctx.font = '15px Arial';
    ctx.fillStyle = '#000000AA';
    let deadText = 'You are dead, wait for respawn!';
    let x = WIDTH/2 - ctx.measureText(deadText).width/2;
    ctx.fillText(deadText, x, HEIGHT/2 + 50);
    ctx.font = '10px Arial';
  }

}, 1000/45);

let drawWallShadow = function(){
  for (let i in Wall.list){
    let wall = Wall.list[i];
    let point = wall.topLeftPoint;

    let x = point.x - Player.list[selfId].x - Player.list[selfId].width/2;
    let y = point.y - Player.list[selfId].y - Player.list[selfId].height/2;
    let angle = Math.atan2(y,x) / Math.PI * 180;
    let lineEndPoint = {
      x: point.x + Math.cos(angle/180*Math.PI) * 300,
      y: point.y + Math.sin(angle/180*Math.PI) * 300,
    };

    for (let i = 0; i < 4; i++){

      ctx.beginPath();
      ctx.moveTo(point.x - Player.list[selfId].x + WIDTH/2, point.y - Player.list[selfId].y + HEIGHT/2);
      ctx.lineTo(lineEndPoint.x  - Player.list[selfId].x + WIDTH/2, lineEndPoint.y - Player.list[selfId].y + HEIGHT/2);

      point = point.nextPoint();
      x = point.x - Player.list[selfId].x - Player.list[selfId].width/2;
      y = point.y - Player.list[selfId].y - Player.list[selfId].height/2;
      angle = Math.atan2(y,x) / Math.PI * 180;
      lineEndPoint = {
        x: point.x + Math.cos(angle/180*Math.PI) * 20000,
        y: point.y + Math.sin(angle/180*Math.PI) * 20000,
      };
      ctx.lineTo(lineEndPoint.x  - Player.list[selfId].x + WIDTH/2, lineEndPoint.y - Player.list[selfId].y + HEIGHT/2);
      ctx.lineTo(point.x  - Player.list[selfId].x + WIDTH/2, point.y - Player.list[selfId].y + HEIGHT/2);

      ctx.closePath();
      ctx.fillStyle = '#606060';
      ctx.fill();
    }
  }
};

let drawSpec = function() {
  let player = Player.list[selfId];
  let fullSpecBarSize = 100;
  let maxSpecQBarSize = fullSpecBarSize / 2;
  let maxSpecEBarSize = fullSpecBarSize / 2;
  let specBarHeight = 12;
  let specQBarSize = 0;
  let specEBarSize = 0;

  let x = WIDTH/2 - fullSpecBarSize / 2 + player.width/2;
  let y = HEIGHT - 72;

  ctx.fillStyle = '#30303030';
  ctx.fillRect(x, y, fullSpecBarSize, specBarHeight);

  if (player.specQTimer < player.specQCD){
    specQBarSize = player.specQTimer / player.specQCD * maxSpecQBarSize;
    ctx.fillStyle = '#E05050AA';
    ctx.fillRect(x, y, specQBarSize, specBarHeight);
  } else {
    ctx.fillStyle = '#50E050DD';
    ctx.fillRect(x, y, maxSpecQBarSize, specBarHeight);
  }
  let QPercent = Math.floor(player.specQTimer / player.specQCD * 100);
  let QSpace = "";
  if (QPercent < 100){
    QSpace += " ";
    if(QPercent < 10){
      QSpace += " ";
    }
  }
  let QPercentText = 'Q: ' + QSpace + QPercent + '%';
  let QPercentX = x + maxSpecQBarSize/2 - ctx.measureText(QPercentText).width/2;
  ctx.fillStyle = '#000000';
  ctx.fillText(QPercentText, QPercentX, y + 10);
  x += maxSpecQBarSize;

  if (player.specETimer < player.specECD){

    specEBarSize = player.specETimer / player.specECD * maxSpecEBarSize;
    ctx.fillStyle = '#E05050AA';
    ctx.fillRect(x, y, specEBarSize, specBarHeight);
  } else {
    ctx.fillStyle = '#50E050DD';
    ctx.fillRect(x, y, maxSpecEBarSize, specBarHeight);
  }
  let EPercent = Math.floor(player.specETimer / player.specECD * 100);
  let ESpace = "";
  if (EPercent < 100){
    ESpace += " ";
    if(EPercent < 10){
      ESpace += " ";
    }
  }
  let EPercentText = 'E: ' + ESpace + EPercent + '%';
  let EPercentX = x + maxSpecEBarSize/2 - ctx.measureText(EPercentText).width/2;
  ctx.fillStyle = '#000000';
  ctx.fillText(EPercentText, EPercentX, y + 10);
};

let drawAmmo = function () {
  let maxAmmoBarSize = 100;
  let ammoBarHeight = 12;
  let ammoBarSize = 0;
  let x = WIDTH/2 - maxAmmoBarSize/2 + Player.list[selfId].width/2;
  let y = HEIGHT - 60;
  ctx.fillStyle = '#30303030';
  ctx.fillRect(x, y, maxAmmoBarSize, ammoBarHeight);

  if(Player.list[selfId].isReloading){
    ammoBarSize = Player.list[selfId].reloadTimer / Player.list[selfId].reloadTime * maxAmmoBarSize;
    ctx.fillStyle = '#B5C143AA';
    ctx.fillRect(x, y, ammoBarSize, ammoBarHeight);
  } else {
    ammoBarSize = Player.list[selfId].ammo / Player.list[selfId].maxAmmo * maxAmmoBarSize;
    ctx.fillStyle = '#B5C143';
    ctx.fillRect(x, y, ammoBarSize, ammoBarHeight);
    if (Player.list[selfId].ammo === 0){
      ctx.fillStyle = '#000000AA';
      let reloadText = 'Press R to reload';
      let textX = WIDTH/2 - ctx.measureText(reloadText).width/2 + Player.list[selfId].width/2;
      let textY = y+10;
      ctx.fillText(reloadText, textX, textY);
    } else {
      ctx.fillStyle = '#000000AA';
      let ammoText = Player.list[selfId].ammo.toString();
      let ammoX = WIDTH/2 - ctx.measureText(ammoText).width/2 + Player.list[selfId].width/2;
      let ammoY = y+10;
      ctx.fillText(ammoText, ammoX, ammoY);
    }
  }
};

let winText = '';
let winnerTeam = '';
let winTextOpacity = 0;

socket.on('attackerWin', function () {
  winText = 'Attackers won!';
  winnerTeam = 'attacker';
  winTextOpacity = 500;
});

socket.on('defenderWin', function () {
  winText = 'Defenders won!';
  winnerTeam = 'defender';
  winTextOpacity = 500;
});

let drawWinText = function () {
  if (winTextOpacity-- > 0){
    let opacity;
    if (winTextOpacity > 255){
      opacity = 'FF';
    } else {
      opacity = winTextOpacity.toString(16);
    }
    if (opacity.length < 2){
      opacity = 0 + opacity;
    }
    ctx.font = "20px Arial";
    let x = WIDTH/2 - ctx.measureText(winText).width/2;
    let y = 70;
    if(winnerTeam === 'attacker'){
      ctx.fillStyle = '#ed5f2b' + opacity;
    } else {
      ctx.fillStyle = '#3694c7' + opacity;
    }
    ctx.fillText(winText, x, y);
    ctx.font = "10px Arial";
  }
};

let killFeedList = [];

socket.on('killFeed', function (data) {
  killFeedList.push(data);
});

let drawKillFeed = function () {
  let y = 20;
  ctx.font = '15px Arial';
  for (let i = 0; i < killFeedList.length; i++){
    if (killFeedList[i].opacity-- === 0){
      killFeedList.splice(i, 1);
    } else {
      let x = 400;
      let opacity;
      if (killFeedList[i].opacity > 255){
        opacity = 'FF';
      } else {
        opacity = killFeedList[i].opacity.toString(16);
      }

      if (opacity.length < 2){
        opacity = 0 + opacity;
      }
      if(killFeedList[i].shooterTeam === 'attacker'){
        ctx.fillStyle = '#ed5f2b' + opacity;
      } else {
        ctx.fillStyle = '#3694c7' + opacity;
      }
      ctx.fillText(killFeedList[i].shooterName, x, y);
      x += ctx.measureText(killFeedList[i].shooterName).width;
      ctx.fillStyle = '#404040' + opacity;
      ctx.fillText(' killed ', x, y);
      x += ctx.measureText(' killed ').width;
      if(killFeedList[i].killedTeam === 'attacker'){
        ctx.fillStyle = '#ed5f2b' + opacity;
      } else {
        ctx.fillStyle = '#3694c7' + opacity;
      }
      ctx.fillText(killFeedList[i].killedName, x, y);
      y += 15;
    }
  }
  ctx.font = '10px Arial';
};

let drawBomb = function () {
  if (bomb !== undefined){
    let x = bomb.x - Player.list[selfId].x + WIDTH/2;
    let y = bomb.y - Player.list[selfId].y + HEIGHT/2;
    if(!bomb.defused){
      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, bomb.width, bomb.height);
      ctx.fillStyle = bombColor;
    }
    else {
      ctx.fillStyle = '#26BB37'
    }
    ctx.fillRect(x, y, bomb.width, bomb.height);
  }
};

let bombColor = "#FF0000";
let bombColorCounter = 255;
let bombSound = new Audio('../client/audio/bombSound.mp3');
bombSound.volume = 0.2;
setInterval(function () {
  if (bomb !== undefined && !bomb.defused){
    let counterMinus = Math.floor(bomb.timer / bomb.timeToExplode * 25);
    bombColorCounter -= counterMinus;
    if (bombColorCounter <= 0){
      bombColorCounter = 255;
      bombSound.currentTime = 0;
      bombSound.play();
    }
    let bombColorCounterHexa = bombColorCounter;
    bombColor = "#FF0000" + Math.floor(bombColorCounterHexa).toString(16);
  }
}, 1000/45);

let interactBarWidth = 40;
let interactBarHeight = 5;

let drawInteract = function () {
  if(Player.list[selfId].canInteract){
    let interactText = '';
    let barStyle = '';
    if(Player.list[selfId].team === 'attacker'){
      interactText = 'Hold F to plant the bomb';
      barStyle = '#FF0000';
    } else {
      interactText = 'Hold F to defuse';
      barStyle = '#0000FF';
    }
    let textWidth = ctx.measureText(interactText).width;
    ctx.fillStyle = '#000000';
    ctx.fillText(interactText, WIDTH/2 - textWidth/2 + Player.list[selfId].width/2, HEIGHT/2 + 30);
    if(Player.list[selfId].interactTimer > 0){
      ctx.fillStyle = '#10101030';
      ctx.fillRect(WIDTH/2 - interactBarWidth/2 + Player.list[selfId].width/2, HEIGHT/2 + 40, interactBarWidth, interactBarHeight);
      let interactWidth = interactBarWidth * (Player.list[selfId].interactTimer / Player.list[selfId].timeToInteract);
      ctx.fillStyle = barStyle;
      ctx.fillRect(WIDTH/2 - interactBarWidth/2 + Player.list[selfId].width/2, HEIGHT/2 + 40, interactWidth, interactBarHeight);

    }
  }
};

let drawAreas = function () {
  ctx.fillStyle = '#ed5f2b30';
  ctx.fillRect(areas.attacker.x - Player.list[selfId].x + WIDTH/2,
               areas.attacker.y - Player.list[selfId].y + HEIGHT/2,
                  areas.attacker.width, areas.attacker.height);
  ctx.fillStyle = '#3694c730';
  ctx.fillRect(areas.defender.x - Player.list[selfId].x + WIDTH/2,
               areas.defender.y - Player.list[selfId].y + HEIGHT/2,
                  areas.defender.width, areas.defender.height);
  ctx.fillStyle = '#D8181870';
  ctx.fillRect( areas.plantA.x - Player.list[selfId].x + WIDTH/2,
                areas.plantA.y - Player.list[selfId].y + HEIGHT/2,
                   areas.plantA.width, areas.plantA.height);
  ctx.fillRect( areas.plantB.x - Player.list[selfId].x + WIDTH/2,
                areas.plantB.y - Player.list[selfId].y + HEIGHT/2,
                   areas.plantB.width, areas.plantB.height);
};
let drawAreasOnMinimap = function () {
  ctx.fillStyle = '#ed5f2b30';
  ctx.fillRect(Xminimap + areas.attacker.x * MINIMAPSCALE,
               Yminimap + areas.attacker.y * MINIMAPSCALE,
                          areas.attacker.width * MINIMAPSCALE, areas.attacker.height * MINIMAPSCALE);
  ctx.fillStyle = '#3694c730';
  ctx.fillRect(Xminimap + areas.defender.x * MINIMAPSCALE,
               Yminimap + areas.defender.y * MINIMAPSCALE,
                          areas.defender.width * MINIMAPSCALE, areas.defender.height * MINIMAPSCALE);
  ctx.fillStyle = '#D8181870';
  ctx.fillRect( Xminimap + areas.plantA.x * MINIMAPSCALE,
                Yminimap + areas.plantA.y * MINIMAPSCALE,
                   areas.plantA.width * MINIMAPSCALE, areas.plantA.height * MINIMAPSCALE);
  ctx.fillRect( Xminimap + areas.plantB.x * MINIMAPSCALE,
                Yminimap + areas.plantB.y * MINIMAPSCALE,
                   areas.plantB.width * MINIMAPSCALE, areas.plantB.height * MINIMAPSCALE);

}

let drawScore = function(){
  ctx.fillStyle = '#404040';
  ctx.fillText('Score: ' + Player.list[selfId].score, 3, 10);
  ctx.fillText('Kills: ' + Player.list[selfId].killCount, 3, 20);
  ctx.fillText('Deaths: ' + Player.list[selfId].deathCount, 3, 30);
};

let drawTeamScore = function () {
  ctx.font = "20px Arial";
  let x = WIDTH/2 - ctx.measureText(attackerScore.toString() + ' : ' + defenderScore.toString()).width/2;
  ctx.fillStyle = '#ed5f2b';
  ctx.fillText(attackerScore.toString(), x, 20);
  x += ctx.measureText(attackerScore.toString()).width;
  ctx.fillStyle = '#000000';
  ctx.fillText(' : ', x, 20);
  x += ctx.measureText(' : ').width;
  ctx.fillStyle = '#3694c7';
  ctx.fillText(defenderScore.toString(), x, 20);

  ctx.font = "10px Arial";
};

let drawAlivePlayerCount = function () {
  let attackerAllCount = 0;
  let defenderAllCount = 0;
  let attackerAliveCount = 0;
  let defenderAliveCount = 0;
  for (let i in Player.list){
    if (Player.list[i].team === 'attacker'){
      attackerAllCount++;
      if (!Player.list[i].isDead){
        attackerAliveCount++;
      }
    } else {
      defenderAllCount++;
      if (!Player.list[i].isDead){
        defenderAliveCount++;
      }
    }
  }

  ctx.font = "12px Arial";
  let x = WIDTH/2 - ctx.measureText(attackerAllCount + '/' + attackerAliveCount + '   ' +
                                          defenderAllCount + '/' + defenderAliveCount).width/2;
  ctx.fillStyle = '#ed5f2b';
  ctx.fillText(attackerAllCount + '/' + attackerAliveCount + '   ', x, 32);
  x += ctx.measureText(attackerAllCount + '/' + attackerAliveCount + '   ').width;
  ctx.fillStyle = '#3694c7';
  ctx.fillText(defenderAllCount + '/' + defenderAliveCount, x, 32);

  ctx.font = "10px Arial";
};

let drawRoundTime = function () {
  if (bomb === undefined){
    let minutes = Math.floor(roundTime / 60);
    let seconds = roundTime - minutes * 60;
    if(seconds < 10){
      seconds = '0'+seconds;
    }
    let timeString = minutes + ':' + seconds;
    let x = WIDTH/2 - ctx.measureText(timeString).width/2;
    ctx.fillStyle = '#555555';
    ctx.fillText(timeString, x, 45);
  }else {
    let x = WIDTH/2 - bomb.width/2;
    let y = 40;
    if(!bomb.defused){
      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, bomb.width, bomb.height);
      ctx.fillStyle = bombColor;
    }
    else {
      ctx.fillStyle = '#26BB37'
    }
    ctx.fillRect(x, y, bomb.width, bomb.height);

  }

};

let xpTextB = document.getElementById("currentXPText")
let infoTextB = document.getElementById("XPinfoText")
let drawXP = function () {
  xpTextB.innerText = Player.list[selfId].xp
  if (Player.list[selfId].xp >= 10){
    infoTextB.innerHTML = "Level up at end of the round"
  }
}
let levelUPDiv = document.getElementById("levelUP")
let drawLevelUP = function () {
  if (Player.list[selfId].upgradeCounter < 1) {
    levelUPDiv.innerHTML = ""
  }
  else {
    if (levelUPDiv.childElementCount<3) {

      let choise0 = document.createElement("button");
      choise0.innerText = Player.list[selfId].avaliableUpgrades[0].text
      choise0.onclick = function () {
        socket.emit("levelup", 0)
      }
      let choise1 = document.createElement("button");
      choise1.innerText = Player.list[selfId].avaliableUpgrades[1].text
      choise1.onclick = function () {
        socket.emit("levelup", 1)
      }
      let choise2 = document.createElement("button");
      choise2.innerText = Player.list[selfId].avaliableUpgrades[2].text
      choise2.onclick = function () {
        socket.emit("levelup", 2)
      }
      levelUPDiv.appendChild(choise0)
      levelUPDiv.appendChild(choise1)
      levelUPDiv.appendChild(choise2)
    }
  }
}

let hpBarWidth = 150;
let hpBarHeight = 15;
let drawHp = function () {
  ctx.fillStyle = '#CFFFCCA0';
  ctx.fillRect(WIDTH/2 - hpBarWidth/2 + Player.list[selfId].width/2, HEIGHT-25, hpBarWidth, hpBarHeight);
  let hpWidth = hpBarWidth * (Player.list[selfId].hp / Player.list[selfId].hpMax);
  ctx.fillStyle = '#23C216C0';
  ctx.fillRect(WIDTH/2 - hpBarWidth/2 + Player.list[selfId].width/2, HEIGHT-25, hpWidth, hpBarHeight);
};

let staminaBarWidth = 150;
let staminaBarHeight = 10;
let drawStamina = function () {
  ctx.fillStyle = '#FDFFC5A0';
  ctx.fillRect(WIDTH/2 - staminaBarWidth/2 + Player.list[selfId].width/2, HEIGHT-10, staminaBarWidth, staminaBarHeight);
  let staminaWidth = staminaBarWidth * (Player.list[selfId].stamina / Player.list[selfId].maxStamina);
  ctx.fillStyle = '#FFE300C0';
  ctx.fillRect(WIDTH/2 - staminaBarWidth/2 + Player.list[selfId].width/2, HEIGHT-10, staminaWidth, staminaBarHeight);
};

let drawPosition = function(){
  ctx.fillStyle = "#404040";
  ctx.fillText('x: ' + Player.list[selfId].x +
              ' y: ' + Player.list[selfId].y,
               3, HEIGHT - 5);
};

document.onkeydown = function(event){
  if(event.keyCode === 68){ //D
    socket.emit('keyPress', {inputId: 'right', state:true});
  }
  else if(event.keyCode === 83){ //S
    socket.emit('keyPress', {inputId: 'down', state:true});
  }
  else if(event.keyCode === 65){ //A
    socket.emit('keyPress', {inputId: 'left', state:true});
  }
  else if(event.keyCode === 87){ //W
    socket.emit('keyPress', {inputId: 'up', state:true});
  }
  else if(event.keyCode === 16){ //Shift
    socket.emit('keyPress', {inputId: 'shift', state: true});
  }
  else if(event.keyCode === 9){ //Tab
    event.preventDefault();
    Player.list[selfId].pressingTab = true;
  }
  else if(event.keyCode === 70){ //F
    socket.emit('keyPress', {inputId: 'interact', state: true});
  }
  else if(event.keyCode === 82){ //R
    socket.emit('keyPress', {inputId: 'reload', state: true});
  }
  else if(event.keyCode === 81){ //Q
    socket.emit('keyPress', {inputId: 'specQ', state: true});
  }
  else if(event.keyCode === 69){ //E
    socket.emit('keyPress', {inputId: 'specE', state: true});
  }
};
document.onkeyup = function(event){
  if(event.keyCode === 68){ //D
    socket.emit('keyPress', {inputId: 'right', state:false});
  }
  else if(event.keyCode === 83){ //S
    socket.emit('keyPress', {inputId: 'down', state:false});
  }
  else if(event.keyCode === 65){ //A
    socket.emit('keyPress', {inputId: 'left', state:false});
  }
  else if(event.keyCode === 87){ //W
    socket.emit('keyPress', {inputId: 'up', state:false});
  }
  else if(event.keyCode === 16){ //Shift
    socket.emit('keyPress', {inputId: 'shift', state: false});
  }
  else if(event.keyCode === 9){ //Tab
    event.preventDefault();
    Player.list[selfId].pressingTab = false;
  }
  else if(event.keyCode === 70){ //F
    socket.emit('keyPress', {inputId: 'interact', state: false});
  }
  else if(event.keyCode === 82){ //R
    socket.emit('keyPress', {inputId: 'reload', state: false});
  }
  else if(event.keyCode === 81){ //Q
    socket.emit('keyPress', {inputId: 'specQ', state: false});
  }
  else if(event.keyCode === 69){ //E
    socket.emit('keyPress', {inputId: 'specE', state: false});
  }
};
document.onmousedown = function(event){
  socket.emit('keyPress', {inputId: 'attack', state:true});
};
document.onmouseup = function(event){
  socket.emit('keyPress', {inputId: 'attack', state: false});
};
document.onmousemove = function(event){
  let x = -WIDTH/2 + event.clientX - Player.list[selfId].width;
  let y = -HEIGHT/2 + event.clientY - Player.list[selfId].height;
  let angle = Math.atan2(y,x) / Math.PI * 180;
  socket.emit('keyPress', {inputId: 'mouseAngle', state: angle});
};

let classChangeOpacity = 0;
let classChangeText = "";
let classSpecText = "";

let drawClassChange = function () {
  if (classChangeOpacity-- > 0) {
    let opacity;
    if (classChangeOpacity > 255) {
      opacity = 'FF';
    } else {
      opacity = classChangeOpacity.toString(16);
    }
    if (opacity.length < 2) {
      opacity = 0 + opacity;
    }

    ctx.font = "16px Arial";
    let x = WIDTH / 2 - ctx.measureText(classChangeText).width / 2;
    let y = HEIGHT - 100;
    ctx.fillStyle = "#303030" + opacity;
    ctx.fillText(classChangeText, x, y);
    ctx.font = "12px Arial";
    ctx.fillText(classSpecText, x, y + 15);
    ctx.font = "10px Arial";
  }
};

let assaultButtonClick = function () {
  classChangeOpacity = 255;
  classChangeText = "Next round you'll respawn as Assault";
  classSpecText = "Q: Restores 20 HP     E: Flash a small distance towards mouse";
  socket.emit('changeClass', 'assault');
};
let shotgunButtonClick = function () {
  classChangeOpacity = 255;
  classChangeText = "Next round you'll respawn as Shotgun";
  classSpecText = "Q: Increase speed    E: Next shot shoot more pellets";
  socket.emit('changeClass', 'shotgun');
};
let minigunButtonClick = function () {
  classChangeOpacity = 255;
  classChangeText = "Next round you'll respawn as Minigun";
  classSpecText = "Q: Becomes invisible     E: Instant reload";
  socket.emit('changeClass', 'minigun');
};
let sniperButtonClick = function () {
  classChangeOpacity = 255;
  classChangeText = "Next round you'll respawn as Sniper";
  classSpecText = "Q: Increase fire rate     E: Plants a mine";
  socket.emit('changeClass', 'sniper');
};

