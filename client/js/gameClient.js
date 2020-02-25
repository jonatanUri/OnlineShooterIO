var socket = io({transports: ['websocket']});
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

var areas = {
  attacker: {},
  defender: {},
  plant: {},
};

var attackerScore = 0;
var defenderScore = 0;

var bomb = undefined;

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

  self.draw = function(){
    if(!self.isDead){
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
    }
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
  if(data.areas){
    areas.attacker.x      = data.areas.attacker.x;
    areas.attacker.y      = data.areas.attacker.y;
    areas.attacker.width  = data.areas.attacker.width;
    areas.attacker.height = data.areas.attacker.height;

    areas.defender.x      = data.areas.defender.x;
    areas.defender.y      = data.areas.defender.y;
    areas.defender.width  = data.areas.defender.width;
    areas.defender.height = data.areas.defender.height;

    areas.plant.x         = data.areas.plant.x;
    areas.plant.y         = data.areas.plant.y;
    areas.plant.width     = data.areas.plant.width;
    areas.plant.height    = data.areas.plant.height;
  }
  if(data.bomb){
    bomb = data.bomb
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
      if(packet.canInteract !== undefined){
        player.canInteract = packet.canInteract;
      }
      if(packet.interactTimer !== undefined){
        player.interactTimer = packet.interactTimer;
      }
      if(packet.isDead !== undefined){
        player.isDead = packet.isDead;
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

  bomb = data.bomb;

  if (data.attackerScore !== undefined){
    attackerScore = data.attackerScore;
  }
  if (data.defenderScore !== undefined){
    defenderScore = data.defenderScore;
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
  drawAreas();
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

  drawTeamScore();
  drawInteract();
  drawBomb();
  drawHp();
  drawStamina();

  if(Player.list[selfId].isDead){
    ctx.fillStyle = '#00000030';
    ctx.fillRect(0,0, WIDTH, HEIGHT);
  }

}, 1000/45);

var drawBomb = function () {
  if (bomb !== undefined){
    var x = bomb.x - Player.list[selfId].x + WIDTH/2;
    var y = bomb.y - Player.list[selfId].y + HEIGHT/2;
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

var bombColor = "#FF0000";
var bombColorCounter = 255;
var bombSound = new Audio('../client/audio/bombSound.mp3');
setInterval(function () {
  if (bomb !== undefined && !bomb.defused){
    var counterMinus = Math.floor(bomb.timer / bomb.timeToExplode * 25);
    bombColorCounter -= counterMinus;
    if (bombColorCounter <= 0){
      bombColorCounter = 255;
      bombSound.currentTime = 0;
      bombSound.play();
    }
    var bombColorCounterHexa = bombColorCounter;
    bombColor = "#FF0000" + Math.floor(bombColorCounterHexa).toString(16);
  }
}, 1000/45);

var interactBarWidth = 40;
var interactBarHeight = 5;

var drawInteract = function () {
  if(Player.list[selfId].canInteract){
    var interactText = '';
    var barStyle = '';
    if(Player.list[selfId].team === 'attacker'){
      interactText = 'Hold F to plant the bomb';
      barStyle = '#FF0000';
    } else {
      interactText = 'Hold F to defuse';
      barStyle = '#0000FF';
    }
    var textWidth = ctx.measureText(interactText).width;
    ctx.fillStyle = '#000000';
    ctx.fillText(interactText, WIDTH/2 - textWidth/2 + Player.list[selfId].width/2, HEIGHT/2 + 30);
    if(Player.list[selfId].interactTimer > 0){
      ctx.fillStyle = '#10101030';
      ctx.fillRect(WIDTH/2 - interactBarWidth/2 + Player.list[selfId].width/2, HEIGHT/2 + 40, interactBarWidth, interactBarHeight);
      var interactWidth = interactBarWidth * (Player.list[selfId].interactTimer / Player.list[selfId].timeToInteract);
      ctx.fillStyle = barStyle;
      ctx.fillRect(WIDTH/2 - interactBarWidth/2 + Player.list[selfId].width/2, HEIGHT/2 + 40, interactWidth, interactBarHeight);

    }
  }
};

var drawAreas = function () {
  ctx.fillStyle = '#ed5f2b30';
  ctx.fillRect(areas.attacker.x - Player.list[selfId].x + WIDTH/2,
               areas.attacker.y - Player.list[selfId].y + HEIGHT/2,
                  areas.attacker.width, areas.attacker.height);
  ctx.fillStyle = '#3694c730';
  ctx.fillRect(areas.defender.x - Player.list[selfId].x + WIDTH/2,
               areas.defender.y - Player.list[selfId].y + HEIGHT/2,
                  areas.defender.width, areas.defender.height);
  ctx.fillStyle = '#D8181870';
  ctx.fillRect( areas.plant.x - Player.list[selfId].x + WIDTH/2,
                areas.plant.y - Player.list[selfId].y + HEIGHT/2,
                   areas.plant.width, areas.plant.height);
};

var drawScore = function(){
  ctx.fillStyle = '#404040';
  ctx.fillText('Score: ' + Player.list[selfId].score, 3, 10);
  ctx.fillText('Kills: ' + Player.list[selfId].killCount, 3, 20);
  ctx.fillText('Deaths: ' + Player.list[selfId].deathCount, 3, 30);
};

var drawTeamScore = function () {
  ctx.font = "20px Arial";
  var x = WIDTH/2 - ctx.measureText(attackerScore.toString() + ' : ' + defenderScore.toString()).width;
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

var hpBarWidth = 150;
var hpBarHeight = 15;
var drawHp = function () {
  ctx.fillStyle = '#CFFFCCA0';
  ctx.fillRect(WIDTH/2 - hpBarWidth/2 + Player.list[selfId].width/2, HEIGHT-25, hpBarWidth, hpBarHeight);
  var hpWidth = hpBarWidth * (Player.list[selfId].hp / Player.list[selfId].hpMax);
  ctx.fillStyle = '#23C216C0';
  ctx.fillRect(WIDTH/2 - hpBarWidth/2 + Player.list[selfId].width/2, HEIGHT-25, hpWidth, hpBarHeight);
};

var staminaBarWidth = 150;
var staminaBarHeight = 10;
var drawStamina = function () {
  ctx.fillStyle = '#FDFFC5A0';
  ctx.fillRect(WIDTH/2 - staminaBarWidth/2 + Player.list[selfId].width/2, HEIGHT-10, staminaBarWidth, staminaBarHeight);
  var staminaWidth = staminaBarWidth * (Player.list[selfId].stamina / Player.list[selfId].maxStamina);
  ctx.fillStyle = '#FFE300C0';
  ctx.fillRect(WIDTH/2 - staminaBarWidth/2 + Player.list[selfId].width/2, HEIGHT-10, staminaWidth, staminaBarHeight);
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
  else if(event.keyCode === 70){ //F
    socket.emit('keyPress', {inputId: 'interact', state: true});
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
