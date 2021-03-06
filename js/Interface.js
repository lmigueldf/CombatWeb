
Interface = {};

Interface.setup = function() {

    Interface.SCREEN_WIDTH = window.innerWidth || 2;
    Interface.SCREEN_HEIGHT = window.innerHeight || 2;

    var havePointerLock = 'pointerLockElement' in document ||
        'mozPointerLockElement' in document ||
        'webkitPointerLockElement' in document;

    if ( havePointerLock ) {
        var element = document.body;

        var pointerlockchange = function ( event ) {
            if ( document.pointerLockElement === element ||
                 document.mozPointerLockElement === element ||
                 document.webkitPointerLockElement === element ) {
                Game.controls.enabled = true;
            } else {
                Game.controls.enabled = false;
            }
        }

        // Hook pointer lock state change events
        document.addEventListener( 'pointerlockchange', pointerlockchange, false );
        document.addEventListener( 'mozpointerlockchange', pointerlockchange, false );
        document.addEventListener( 'webkitpointerlockchange', pointerlockchange, false );
        window.addEventListener( 'resize', Interface.onWindowResize, false );

        var canFire = true;
        var onMouseDown = function( event ) {
            if (canFire && Game.player.live) {
                var projector = new THREE.Projector();
                var vector = new THREE.Vector3(0,0,1);
                projector.unprojectVector(vector, Game.camera);
                var raycaster = new THREE.Raycaster(Game.player.body.position, vector.sub(Game.player.body.position).normalize() );

                var intersects = raycaster.intersectObjects( Game.scene.children );

                if (intersects[0] && intersects[0].point) {
                    Interface.createFire(Game.player, intersects[0].point, true);

                    for (playerID in Game.otherPlayers) {
                        if (intersects[0].object == Game.otherPlayers[playerID].mesh) {
                            Network.socket.emit('playerDied', {source:Game.player.ID, destination:playerID});
                            Game.otherPlayers[playerID].despawn();
                        }
                    }
                }
                else {
                    Interface.createFire(Game.player,
                                         raycaster.ray.origin.vadd((new THREE.Vector3()).copy(raycaster.ray.direction).multiplyScalar(100)),
                                         true);
                }

                Game.player.body.applyForce(new CANNON.Vec3(-raycaster.ray.direction.x*Settings.fireKnockback,
                                                            -raycaster.ray.direction.y*Settings.fireKnockback,
                                                            -raycaster.ray.direction.z*Settings.fireKnockback),
                                            Game.player.body.position);

                canFire = false;
                setTimeout( function(){canFire = true;}, 1000);
            }
        }

        document.addEventListener( 'click', function(event) {
            element.requestPointerLock = element.requestPointerLock ||
                element.mozRequestPointerLock ||
                element.webkitRequestPointerLock;

            if ( /Firefox/i.test( navigator.userAgent ) ) {
                var fullscreenchange = function ( event ) {

                    if ( document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element ) {

                        document.removeEventListener( 'fullscreenchange', fullscreenchange );
                        document.removeEventListener( 'mozfullscreenchange', fullscreenchange );

                        element.requestPointerLock();
                    }
                }
                document.addEventListener( 'fullscreenchange', fullscreenchange, false );
                document.addEventListener( 'mozfullscreenchange', fullscreenchange, false );

                element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;

                element.requestFullscreen();

            } else {
                element.requestPointerLock();
            }

            onMouseDown();

        });
    }
    var container = document.createElement( 'div' );
    document.body.appendChild( container );
    Interface.stats = new Stats();
    Interface.stats.domElement.style.position = 'absolute';
    Interface.stats.domElement.style.top = '0px';
    Interface.stats.domElement.style.visibility = "hidden" //hide stats until the game starts
    container.appendChild( Interface.stats.domElement );

}

Interface.scoreboardDisabled = true;
Interface.showScoreboard = function() {
    $('#innercircle').css('visibility', 'hidden');
    $('#outercircle').css('visibility', 'hidden');
    $('#scoreboard').css('visibility', 'visible').empty();
    $('#scoreboard').append($("<h3>").html("Scores").css("text-align", "center"));

    var players = [];

    for (var id in Game.otherPlayers) {
        players.push(Game.otherPlayers[id]);
    }
    players.push(Game.player);

    players.sort(function(left, right) {
        return left.kills - right.kills;
    });

    var teamdivs = {};
    for(var i in players) {
        if (!teamdivs[players[i].team.name]) {
            var div = $('<table>').addClass("teamscore");
            div.css("background-color", Utils.hexToRGBA(players[i].team.color.toString(16), 50));
            div.append($("<h3>").html(players[i].team.name));
            teamdivs[players[i].team.name] = div;

            var headingsdiv = $('<tr>').css("text-align", "left");
            headingsdiv.append($("<th>").html("Name"));
            headingsdiv.append($("<th>").html("Kills"));
            headingsdiv.append($("<th>").html("Deaths"));
            div.append(headingsdiv);

        }
        var playerdiv = $('<tr>').addClass("playerscore");
        playerdiv.append($("<td>").addClass("playername").html(players[i].name));
        playerdiv.append($("<td>").addClass("playerkills").html(players[i].kills));
        playerdiv.append($("<td>").addClass("playerdeaths").html(players[i].deaths));

        // Make the players score more noticable
        if (players[i] == Game.player)
            playerdiv.css("font-style", "italic");

        teamdivs[players[i].team.name].append(playerdiv);
    }
    for (var i in teamdivs) {
        $('#scoreboard').append(teamdivs[i]);
    }
}

Interface.hideScoreboard = function() {
    $('#innercircle').css('visibility', 'visible');
    $('#outercircle').css('visibility', 'visible');
    $('#scoreboard').css('visibility', 'hidden');
}

Interface.createFire = function(player, destination, local) {
    // player.emitSound(Sound.buffers["laser"], true).source.onended = function() {
    //     player.emitSound(Sound.buffers["recharge"], true);
    // };

    var source = player.body.position;
    var direction = new THREE.Vector3();
    var width = 0.1;
    direction.copy(destination).sub(source);

    var cloud = new THREE.Geometry();

    for(var i =0; i < 2000; i++ ) {
        var vertex = new THREE.Vector3();
        vertex.copy(source).add((new THREE.Vector3()).copy(direction).multiplyScalar(Math.random()));
        vertex.x += Math.random()*width - width/2;
        vertex.y += Math.random()*width - width/2;
        vertex.z += Math.random()*width - width/2;

        cloud.vertices.push(vertex);
    }
    var cloudMaterial = new THREE.ParticleBasicMaterial( {
        size: 0.03,
        color: 0x00A0A0,
        transparent: true,
        opacity: 0.91,
    });

    var particles = new THREE.ParticleSystem( cloud, cloudMaterial );

    Game.scene.add(particles);

    if (local)
        Network.socket.emit('createFire', {id:Game.player.ID, destination:destination});

    var fade = setInterval( function() {
        THREE.ColorConverter.setHSV( particles.material.color,
                                     THREE.ColorConverter.getHSV(particles.material.color).h,
                                     THREE.ColorConverter.getHSV(particles.material.color).s,
                                     THREE.ColorConverter.getHSV(particles.material.color).v - 0.005);
        particles.material.opacity -= 0.02

        for (var i=0; i < cloud.vertices.length; i++) {
            cloud.vertices[i].x += Math.random()*width/2 - width/4;
            cloud.vertices[i].y += Math.random()*width/2 - width/4;
            cloud.vertices[i].z += Math.random()*width/2 - width/4;
        }
        particles.geometry.verticesNeedUpdate = true;

    }, 10);

    setTimeout( function(){
        clearInterval(fade);
        Game.scene.remove(particles);
    }, 700);
}

Interface.onWindowResize = function() {
    Interface.SCREEN_WIDTH = window.innerWidth || 2;
    Interface.SCREEN_HEIGHT = window.innerHeight || 2;

    Game.shaders["fxaaEffect"].uniforms[ 'resolution' ].value.set( 1 / Interface.SCREEN_WIDTH, 1 / Interface.SCREEN_HEIGHT );

    Game.camera.aspect = Interface.SCREEN_WIDTH / Interface.SCREEN_HEIGHT;
    Game.camera.updateProjectionMatrix();

    Game.composer.setSize( Interface.SCREEN_WIDTH, Interface.SCREEN_HEIGHT );
    Game.renderer.setSize( Interface.SCREEN_WIDTH, Interface.SCREEN_HEIGHT );

}
