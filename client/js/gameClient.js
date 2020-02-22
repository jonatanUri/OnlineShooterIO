var socket = io();
var display = document.getElementById("display");
var WIDTH = display.width;
var HEIGHT = display.height;
var ctx = display.getContext("2d");
ctx.font = "10px Arial";

function emitNewName(){
  socket.emit('newName', nameBox.value);
}

var nameBox = document.getElementById("nameBox");
nameBox.addEventListener("change", emitNewName);
nameBox.addEventListener("onkeypress", emitNewName);

var spawnAreas = {
  attacker: {},
  defender: {}
};

var Player = function(initPack){
  var self = {};
  self.id =         initPack.id;
  self.name =       initPack.name;
  self.x =          initPack.x;
  self.y =          initPack.y;
  self.width =      initPack.width;
  self.height =     initPack.height;
  self.hp =         initPack.hp;
  self.hpMax =      initPack.hpMax;
  self.stamina =    initPack.stamina;
  self.maxStamina = initPack.maxStamina;
  self.score =      initPack.score;
  self.killCount =  initPack.killCount;
  self.deathCount = initPack.deathCount;
  self.team =       initPack.team;
  self.pressingTab = false;

  self.draw = function(){
    var x = self.x - Player.list[selfId].x + WIDTH/2;
    var y = self.y - Player.list[selfId].y + HEIGHT/2;

    var barWidth = 30;

    var hpWidth = barWidth * self.hp / self.hpMax;
    ctx.fillStyle = '#222222A0';
    ctx.fillRect(x - barWidth/2 + self.width/2, y - 10, barWidth, 4);

    if (self.team !== Player.list[selfId].team){
      ctx.fillStyle = '#FF3622C0';
    } else {
      ctx.fillStyle = '#23C216C0'
    }
    ctx.fillRect(x - barWidth/2 + self.width/2, y - 10, hpWidth, 4);
    ctx.fillStyle = '#000000';
    ctx.fillText(self.name, x - ctx.measureText(self.name).width/2 + self.width/2, y - 15);

    if (self.team === 'attacker'){
      ctx.fillStyle = '#ed5f2b';
    } else {
      ctx.fillStyle = '#3694c7';
    }
    ctx.fillRect(x, y, self.width, self.height);
  };

  Player.list[self.id] = self;
  return self;
};
Player.list = {};

var Wall = function (initPack) {
  var self = {};
  self.id =     initPack.id;
  self.x =      initPack.x;
  self.y =      initPack.y;
  self.width =  initPack.width;
  self.height = initPack.height;

  self.draw = function () {
    var x = self.x - Player.list[selfId].x + WIDTH/2;
    var y = self.y - Player.list[selfId].y + HEIGHT/2;
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, self.width, self.height);
  };

  Wall.list[self.id] = self;
  return self;
};
Wall.list = {};


var Bullet = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.x = initPack.x;
  self.y = initPack.y;
  self.width = initPack.width;
  self.height = initPack.height;

  self.draw = function(){
    var x = self.x - Player.list[selfId].x + WIDTH/2;
    var y = self.y - Player.list[selfId].y + HEIGHT/2;
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, self.width, self.height);
  };

  Bullet.list[self.id] = self;
  return self;
};
Bullet.list = {};

var selfId = null;

socket.on('init',function(data){
  if(data.selfId){
    selfId = data.selfId;
  }

  for(var i = 0 ; i < data.player.length; i++){
    new Player(data.player[i]);
  }
  if(data.wall){
    for(var i = 0; i < data.wall.length; i++){
      new Wall(data.wall[i]);
    }
  }
  if(data.bullet){
    for(var i = 0 ; i < data.bullet.length; i++){
      new Bullet(data.bullet[i]);
    }
  }
  if(data.spawnAreas){
    spawnAreas.attacker.x      = data.spawnAreas.attacker.x;
    spawnAreas.attacker.y      = data.spawnAreas.attacker.y;
    spawnAreas.attacker.width  = data.spawnAreas.attacker.width;
    spawnAreas.attacker.height = data.spawnAreas.attacker.height;

    spawnAreas.defender.x      = data.spawnAreas.defender.x;
    spawnAreas.defender.y      = data.spawnAreas.defender.y;
    spawnAreas.defender.width  = data.spawnAreas.defender.width;
    spawnAreas.defender.height = data.spawnAreas.defender.height;
  }
});

socket.on("update", function(data){
  for (var i = 0; i < data.player.length; i++) {
    var packet = data.player[i];
    var player = Player.list[packet.id];
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
    }
  }
  for (var i = 0; i < data.bullet.length; i++) {
    var packet = data.bullet[i];
    var bullet = Bullet.list[packet.id];
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
    }
  }
});

socket.on('remove', function(data) {
  for (var i = 0; i < data.player.length; i++) {
    delete Player.list[data.player[i]];
  }
  for (var i = 0; i < data.bullet.length; i++) {
    delete Bullet.list[data.bullet[i]];
  }
  for (var i = 0; i < data.wall.length; i++){
    delete Wall.list[data.wall[i]];
  }
});

setInterval(function(){
  if(!selfId)
    return;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawSpawnAreas();
  drawScore();
  drawPosition();

  for(var i in Wall.list){
    Wall.list[i].draw();
  }
  for(var i in Player.list){
    Player.list[i].draw();
  }
  for(var i in Bullet.list){
    Bullet.list[i].draw();
  }

  drawHp();
  drawStamina();

}, 1000/45);

var drawSpawnAreas = function () {
  ctx.fillStyle = '#ed5f2b30';
  ctx.fillRect(spawnAreas.attacker.x - Player.list[selfId].x + WIDTH/2,
               spawnAreas.attacker.y - Player.list[selfId].y + WIDTH/2,
                  spawnAreas.attacker.width, spawnAreas.attacker.height);
  ctx.fillStyle = '#3694c730';
  ctx.fillRect(spawnAreas.defender.x - Player.list[selfId].x + WIDTH/2,
               spawnAreas.defender.y - Player.list[selfId].y + WIDTH/2,
                  spawnAreas.defender.width, spawnAreas.defender.height);
};

var drawScore = function(){
  ctx.fillStyle = '#404040';
  ctx.fillText('Score: ' + Player.list[selfId].score, 3, 10);
  ctx.fillText('Kills: ' + Player.list[selfId].killCount, 3, 20);
  ctx.fillText('Deaths: ' + Player.list[selfId].deathCount, 3, 30);
};

var hpBarWidth = 150;
var hpBarHeight = 15;
var drawHp = function () {
  ctx.fillStyle = '#CFFFCCA0';
  ctx.fillRect(WIDTH/2 - hpBarWidth/2, HEIGHT-25, hpBarWidth, hpBarHeight);
  var hpWidth = hpBarWidth * (Player.list[selfId].hp / Player.list[selfId].hpMax);
  ctx.fillStyle = '#23C216C0';
  ctx.fillRect(WIDTH/2 - hpBarWidth/2, HEIGHT-25, hpWidth, hpBarHeight);
};

var staminaBarWidth = 150;
var staminaBarHeight = 10;
var drawStamina = function () {
  ctx.fillStyle = '#FDFFC5A0';
  ctx.fillRect(WIDTH/2 - staminaBarWidth/2, HEIGHT-10, staminaBarWidth, staminaBarHeight);
  var staminaWidth = staminaBarWidth * (Player.list[selfId].stamina / Player.list[selfId].maxStamina);
  ctx.fillStyle = '#FFE300C0';
  ctx.fillRect(WIDTH/2 - staminaBarWidth/2, HEIGHT-10, staminaWidth, staminaBarHeight);
};

var drawPosition = function(){
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
  else  if(event.keyCode === 16){
    socket.emit('keyPress', {inputId: 'shift', state: false});
  }
  else if(event.keyCode === 9){ //Tab
    event.preventDefault();
    Player.list[selfId].pressingTab = false;
  }
};
document.onmousedown = function(event){
  socket.emit('keyPress', {inputId: 'attack', state:true});
};
document.onmouseup = function(event){
  socket.emit('keyPress', {inputId: 'attack', state: false});
};
document.onmousemove = function(event){
  var x = -WIDTH/2 + event.clientX -8;
  var y = -HEIGHT/2 + event.clientY -8;
  var angle = Math.atan2(y,x) / Math.PI * 180;
  socket.emit('keyPress', {inputId: 'mouseAngle', state: angle});
};
