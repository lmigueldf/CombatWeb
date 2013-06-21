
Network = {};
Network.latency = 0;

Network.setup = function() {
	Network.socket = io.connect();

	Network.socket.on('currentState', function (data) {
		data.time = Date.now();
		Game.interpolate(data)
	});
	
	/*
		The socket has likely not been connected at the time the player is made,
		so it will have no id. Set the ID here.
	*/
	Network.socket.on('connected', function (data) {
		Game.player.ID = Network.socket.socket.sessionid;
		Game.player.name = data.name;
		Network.ID = Network.socket.socket.sessionid;
		Game.seed = data.seed;
		Game.interpolate(data.state);
		console.log(data.state);
		Game.seedWorld(Game.seed);
	});
	
	Network.socket.on('playerConnected', function(data) {
		console.log(data.name, "connected");
		Game.otherPlayers[data.id] = new Player(data.id, data.name);
	});
	
	Network.socket.on('playerSpawn', function(data) {
	console.log(Game.otherPlayers[data].name, "spawned");
		if (Game.otherPlayers[data])
			Game.otherPlayers[data].spawn();
	});
	
	Network.socket.on('playerDied', function(data) {
		//console.log(Game.otherPlayers[data].name || Game.player.name, "died");
		if (Game.otherPlayers[data.destination])
			Game.otherPlayers[data.destination].despawn();
		else if (data.destination == Game.player.ID) {
			Game.player.live = false;
			
			setTimeout( function() {
				Game.player.live = true;
				Game.player.body.position.set(Game.spawn.x, 
												Game.spawn.y, 
												Game.spawn.z)
				Network.socket.emit('playerSpawn');
			}, 3000);
		}
	});
	
	Network.socket.on('createFire', function(data) {
		Interface.createFire(data.source, data.destination, false);
	});
	
	
	Network.socket.on('playerDisconnected', function(data) {
		console.log("received disconnect");
		if (Game.otherPlayers[data]) {
			Game.scene.remove(Game.otherPlayers[data].mesh);
			delete Game.otherPlayers[data];
		}
	});
}

Network.findLatency = function() {
	/*
		It seems this is the best we can do to measure latency in-browser. Obviously
		there are problems with this approach, it is really more a measurement of bw and
		does not account for the tcp handshake, etc.
	*/

	var ts, img = new Image;
	img.onload = function() { Network.latency=(+new Date - ts); };
	ts = +new Date;
	img.src = "/assets/1x1.GIF";
}
