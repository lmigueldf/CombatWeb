
Game = {};
Game.spawn = {x:0, y:100, z:0};

Game.player = null;
Game.otherPlayers = {};

Game.receivedStateBuffer = [];
Game.projectedStateBuffer = [];

Game.setupPhysics = function(){
    // Setup our world
    Game.world = new CANNON.World();
    Game.world.quatNormalizeSkip = 0;
    Game.world.quatNormalizeFast = false;

    Game.world.defaultContactMaterial.contactEquationStiffness = 1e9;
    Game.world.defaultContactMaterial.contactEquationRegularizationTime = 3;

    Game.world.gravity.set(0,Settings.gravity,0);
    Game.world.broadphase = new CANNON.NaiveBroadphase();

    var solver = new CANNON.GSSolver();
    solver.iterations = Settings.physicsSolverIterations;
    solver.tolerance = Settings.physicsSolverTolerance;

    Game.world.solver = new CANNON.SplitSolver(solver);

    defaultMaterial = new CANNON.Material("defaultMaterial");
    var physicsContactMaterial = new CANNON.ContactMaterial(defaultMaterial,
                                                            defaultMaterial,
                                                            Settings.frictionCoefficient,
                                                            0.3  // restitution
                                                           );
    // We must add the contact materials to the world
    Game.world.addContactMaterial(physicsContactMaterial);

    Game.player = makeLocalPlayer(Network.socket.socket.sessionid);
    Game.world.add(Game.player.body);

}


Game.setupRender = function() {
    Game.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.01, 1000 );

    Game.scene = new THREE.Scene();
    Game.scene.fog = new THREE.Fog( 0x000000, 0, 500 );

    var ambient = new THREE.AmbientLight( Settings.ambientLightColor );
    Game.scene.add( ambient );

    var light = new THREE.DirectionalLight( 0xffffff );
    light.position.set( 10, 60, 20 );
    light.target.position.set( 0, 0, 0 );

    light.castShadow = true;

    light.shadowCameraNear = 3;
    light.shadowCameraFar = Game.camera.far;
    light.shadowCameraFov = 50;

    light.shadowMapDarkness = 1;
    light.shadowMapWidth = 1024;
    light.shadowMapHeight = 1024;
    light.shadowCameraVisible = true;

    Game.scene.add( light );
    Game.controls = new PointerLockControls( Game.camera , Game.player.body );
    Game.scene.add( Game.controls.getObject() );

    // floor
    var floorTexture = THREE.ImageUtils.loadTexture('./assets/checkerboard.jpg');
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set( 10, 10 );
    var material = new THREE.MeshLambertMaterial(  {map:  floorTexture});

    var halfExtents = new CANNON.Vec3(Settings.floorSize,1,Settings.floorSize);
    var boxShape = new CANNON.Box(halfExtents);
    var boxGeometry = new THREE.BoxGeometry(halfExtents.x*2,halfExtents.y*2,halfExtents.z*2);
    var boxBody = new CANNON.RigidBody(0,boxShape);
    boxBody.motionstate = 2; //make bodies motionless
    var boxMesh = new THREE.Mesh( boxGeometry, material);
    boxBody.position.set(0, -1, 0);

    boxBody.position.copy(boxMesh.position);
    boxBody.quaternion.copy(boxMesh.quaternion);

    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;

    Game.scene.add(boxMesh);
    Game.world.add(boxBody);

    // renderer
    Game.renderer = new THREE.WebGLRenderer({ antialias: true });
    Game.renderer.shadowMapEnabled = true;
    Game.renderer.shadowMapSoft = true;
    Game.renderer.setSize( window.innerWidth, window.innerHeight );
    Game.renderer.setClearColor( Game.scene.fog.color, 1 );
    Game.renderer.autoClear = false;

    document.body.appendChild( Game.renderer.domElement );

    // postprocessing
    Game.composer = new THREE.EffectComposer( Game.renderer );
    Game.composer.addPass( new THREE.RenderPass( Game.scene, Game.camera ) );
    Game.shaders = {};

    var fxaaEffect = new THREE.ShaderPass( THREE.FXAAShader );
    fxaaEffect.uniforms[ 'resolution' ].value.set( 1 / Interface.SCREEN_WIDTH, 1 / Interface.SCREEN_HEIGHT );

    fxaaEffect.renderToScreen = true;

    Game.shaders["fxaaEffect"] = fxaaEffect;
    Game.composer.addPass( fxaaEffect );

    // Skybox adapted from https://mrdoob.github.io/three.js/examples/webgl_lights_hemisphere.html
    var vertexShader = document.getElementById( 'skyVertexShader' ).textContent;
    var fragmentShader = document.getElementById( 'skyFragmentShader' ).textContent;
    var uniforms = {
        topColor:        { type: "c", value: new THREE.Color( 0x0077ff ) },
        bottomColor:     { type: "c", value: new THREE.Color( 0xffffff ) },
        offset:          { type: "f", value: 33 },
        exponent:        { type: "f", value: 0.6 }
    }
    Game.scene.fog.color.copy( uniforms.bottomColor.value );

    var skyGeo = new THREE.SphereGeometry( 300, 32, 15 );
    var skyMat = new THREE.ShaderMaterial( { vertexShader: vertexShader,
                                             fragmentShader: fragmentShader,
                                             uniforms: uniforms,
                                             side: THREE.BackSide } );

    var sky = new THREE.Mesh( skyGeo, skyMat );
    Game.scene.add( sky );

}

Game.seedWorld = function(seed) {
    Math.seedrandom(seed);

    var worldObjects = Math.random() * Settings.maxCubes + Settings.minCubes;

    for(var i =0; i < worldObjects; i++) {
        var size = Math.random()*Settings.maxCubeSize + Settings.minCubeSize;
        var halfExtents = new CANNON.Vec3(size, size, size);
        var boxShape = new CANNON.Box(halfExtents);
        var boxGeometry = new THREE.BoxGeometry(halfExtents.x*2,halfExtents.y*2,halfExtents.z*2);
        var boxBody = new CANNON.RigidBody(0,boxShape);
        boxBody.motionstate = 2; //make bodies motionless

        var material = new THREE.ShaderMaterial( {
            uniforms:  {
                redWeight:   { type: "f", value: Math.random() },
                blueWeight:  { type: "f", value: Math.random() },
                greenWeight: { type: "f", value: Math.random() }
            },
            vertexShader: document.getElementById( 'vertexShader' ).textContent,
            fragmentShader: document.getElementById( 'fragment_shader2' ).textContent
        });

        var tempColor = Utils.randomColor();
        var boxMesh = new THREE.Mesh( boxGeometry, material);

        var randomPosition = {  x : Settings.floorSize*2*Math.random() - Settings.floorSize,
                                y : Settings.maxCubeSize*Math.random(),
                                z : Settings.floorSize*2*Math.random() - Settings.floorSize}

        boxBody.position.set(randomPosition.x, randomPosition.y, randomPosition.z);

        boxBody.quaternion.setFromVectors(new CANNON.Vec3(Math.random(), Math.random(), Math.random()),
                                          new CANNON.Vec3(Math.random(), Math.random(), Math.random()));

        boxBody.position.copy(boxMesh.position);
        boxBody.quaternion.copy(boxMesh.quaternion);

        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        boxMesh.body = boxBody;
        boxBody.mesh = boxMesh;

        Game.scene.add(boxMesh);
        Game.world.add(boxBody);
    }
}

Game.updateState = function(newState) {
    Game.currentState = newState;
    for(var playerID in newState.players) {
        if (Game.otherPlayers[playerID])
            Game.otherPlayers[playerID].setState(newState.players[playerID]);
        else if (playerID === Game.player.ID)
            Game.player.setState(newState.players[playerID]);
        else {
            Game.otherPlayers[playerID] = new Player(playerID, newState.players[playerID].name); //player appears unexpectedly
            Game.otherPlayers[playerID].setState(newState.players[playerID]);
            Game.otherPlayers[playerID].spawn();
        }
    }

    for(var playerID in Game.otherPlayers) {
        if (!newState.players[playerID]) {
            Game.scene.remove(Game.otherPlayers[playerID].mesh);
            delete Game.otherPlayers[playerID];
        }
    }

}

Game.interpolate = function(newState) {
    //Drop all previous interpolated states. This prevents any kind of build up of states, if
    //we have < 60 fps etc.
    Game.projectedStateBuffer = [];

    if (!Game.currentState)
        Game.currentState = newState;
    var oldState = Game.currentState;


    Game.interpConst = (Network.latency+50)/(1000/Settings.FPS);

    for(var i=0; i < Game.interpConst; i++) {
        var interpState = jQuery.extend({}, newState);
        for(var player in newState.players) {
            if (oldState.players[player]) {
                interpState.players[player].position = {
                    x : Utils.averageValue(oldState.players[player].position.x,
                                           newState.players[player].position.x,
                                           Game.interpConst,
                                           i),
                    y : Utils.averageValue(oldState.players[player].position.y,
                                           newState.players[player].position.y,
                                           Game.interpConst,
                                           i),
                    z : Utils.averageValue(oldState.players[player].position.z,
                                           newState.players[player].position.z,
                                           Game.interpConst,
                                           i)
                }
            }
            else {
                interpState.players[player] = newState.players[player];
            }
        }

        Game.projectedStateBuffer.push(interpState);
    }
    Game.projectedStateBuffer.push(newState);
}

// Update the local player
Game.updatePlayer = function(time) {
    if (Game.player.live) {
        //Update physics
        Game.world.step(1/Settings.FPS);

        //Update controls
        Game.controls.update(Date.now() - time );

        //Fall death
        if (Game.player.body.position.y < Settings.fallDeathThreshold) {
            Game.player.death();
            Network.socket.emit('playerDied', {reason:" fell to their death",
                                               destination:Game.player.ID});
        }
    }
}

Game.begin = function () {

    Network.socket.emit("playerSpawn", Network.socket.ID);
    Game.player.live = true;
    Interface.scoreboardDisabled = false;
    Interface.stats.domElement.style.visibility = "visible";

    var time = Date.now();
    function update() {
        if(Game.projectedStateBuffer.length > 0) {
            Game.updateState(Game.projectedStateBuffer[0]);
            Game.projectedStateBuffer.splice(0, 1);
        }

        Game.updatePlayer(time);

        //Render scene
        Game.renderer.render( Game.scene, Game.camera );

        //Apply postprocessing
        Game.composer.render(0.05)

        requestAnimationFrame( update );
        Interface.stats.update();
        time = Date.now();
        // Sound.updateListenerPosition();
    }
    update();

    setInterval(Network.findLatency, Settings.latencyUpdateInterval);

    setInterval(function() {
        Network.socket.emit("playerState", Game.player.getState())
    }, 20);
}
