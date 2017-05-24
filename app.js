//app.js
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started.");

var SOCKET_LIST = [];
var activeGames = [];
var MAP_HEIGHT = 500;

/* ============================== */
/* Game */
/* ============================== */
var Game = function(){

    this.mobileSockets = [];
    this.browserSockets = [];

}

/* ============================== */
/* Player */
/* ============================== */
var Player = function(id){
	var self = {
		x:250,
		y:500,
		id:id,
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,	
		spdX:0,
		spdY:0,
		maxSpd:10,
	}
	self.update = function(){
		self.updateSpd();
		self.x += self.spdX;
		self.y += self.spdY;
        if(self.x > 500-50){
            self.x = 500-50;
        }
        else if(self.x < 0){
            self.x = 0;
        }
        if(self.y > 500-50){
            self.y = 500-50;
        }
        else if(self.y < 0){
            self.y = 0;
        }
        //self.pressingRight = false;
        //self.pressingLeft = false;


	}
	self.updateSpd = function(){
        if(self.pressingRight){
            self.spdX = self.maxSpd;
            
        }           
        else if(self.pressingLeft){
            self.spdX = -self.maxSpd;

        }            
        else
            self.spdX = 0;
       
        if(self.pressingUp)
            self.spdY = -self.maxSpd;
        else if(self.pressingDown)
            self.spdY = self.maxSpd;
        else
            self.spdY = 0;     
    }
    Player.list[id] = self;
	return self;
}
Player.list = {};

Player.onConnect = function(socket){
    var player = Player(socket.id);
    socket.on('keyPress',function(data){
        if(data.inputId === 'left'){
            player.pressingLeft = data.state;
            player.pressingRight = false;
            //console.log(data.state);
        }           
        else if(data.inputId === 'right'){
            player.pressingRight = data.state;
            player.pressingLeft = false;
            //console.log("Right");
        }           
        else if(data.inputId === 'up')
            player.pressingUp = data.state;
        else if(data.inputId === 'down')
            player.pressingDown = data.state;
    });
    
}

Player.onDisconnect = function(socket){
    delete Player.list[socket.id];
}

Player.update = function(){
    var pack = [];
    for(var i in Player.list){
        var player = Player.list[i];
        player.update();
        pack.push({
            x:player.x,
            y:player.y,
            id:player.id
        });    
    }
    return pack;
}

/* ============================== */
/* Enemy */
/* ============================== */
var Enemy = function(id){
	var self = {
		x: 500*Math.random(),
		y: 0,
		id:id,
		maxSpd:10*Math.random()+1,
	}
	self.update = function(){
		self.y += self.maxSpd;
	}
	Enemy.list[id] = self;
	return self;
}
Enemy.list = {};
Enemy.update = function(){
	if(Math.random() < 0.03){
		enemyId = Math.random();
        Enemy(enemyId);
    }
    var pack = [];
    for(var i in Enemy.list){
        var enemy = Enemy.list[i];
        enemy.update();
        if(enemy.y >= MAP_HEIGHT){
            delete enemy;
        }
        else{
            pack.push({
                x:enemy.x,
                y:enemy.y,
            }); 
        }       
    }
    //console.log(pack.length);
    return pack;
}
/* ================================== */




function gameLoop(){
	
	var pack = {
        player:Player.update(),
        enemy:Enemy.update(),
    }
    //activeGames["123"].browserSockets[0].emit('newPositions',pack);

	//Check for collision	
    /*
    for(var i = 0 ; i < pack.player.length; i++){
        var p = pack.player[i];
        for(var j = 0; j < pack.enemy.length; j++){
            var e = pack.enemy[j];
            if(e.x >= p.x && e.x <= p.x+50 && e.y >= p.y && e.y <= p.y+50){
                //console.log("COLLISION!");
                stopUpdateGame();
                var socket = SOCKET_LIST[p.id];
                socket.emit("gameOver");
            }
        }
    }
    */
   
    for(var i in activeGames){
        //Loop through browserSockets and update them
        //console.log("First loop");
        //console.log(i);

        for(var j in activeGames[i].browserSockets){
	        //console.log("Second loop");	  //Does not get here?!?!?!      
	        var socket = activeGames[i].browserSockets[j];
			socket.emit('newPositions', pack);
        } 
    }

   
	
}

function stopUpdateGame(){
    clearInterval(intervalID);
}



var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
    
    console.log("CLIENT CONNECTED");


    
    socket.on('register', function(data){
        if(data.type === 'browser'){
            console.log("BROWSER CONNECTED");

            var game = new Game();
            game.browserSockets.push(socket);
            //console.log(game.browserSockets.length);
            activeGames[data.id] = game;
            //console.log(activeGames["123"].browserSockets.length);
            socket.id = Math.random();
            SOCKET_LIST[socket.id] = socket;
            
        }
        else if(data.type === 'mobile'){
            console.log("MOBILE CONNECTED");
            console.log(data.id);
            //console.log(activeGames["123"]);

            activeGames[data.id].mobileSockets.push(socket);

            socket.id = Math.random();
            SOCKET_LIST[socket.id] = socket;
            Player.onConnect(socket);     
              
            intervalID = setInterval(gameLoop, 1000/30);
        }
        
        
        
    
    });
   
    socket.on('disconnect',function(){
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });
    
});