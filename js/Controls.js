/**
 * Based on https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html
 * by mrdoob and schteppe
 */
var PointerLockControls = function ( camera, cannonBody ) {
    var scope = this;

    var pitchObject = new THREE.Object3D();
    pitchObject.add( camera );

    var yawObject = new THREE.Object3D();
    yawObject.position.y = Settings.playerEyePosition;
    yawObject.add( pitchObject );

    var quat = new THREE.Quaternion();

    var moveForward = false;
    var moveBackward = false;
    var moveLeft = false;
    var moveRight = false;
    var jump = false; //for bunny-hopping

    this.canJump = false;

    var contactNormal = new CANNON.Vec3(); // Normal in the contact, pointing *out* of whatever the player touched
    var upAxis = new CANNON.Vec3(0,1,0);
    cannonBody.addEventListener("collide",function(e){
        var contact = e.contact;

        // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
        // We do not yet know which one is which! Let's check.
        if(contact.bi.id == cannonBody.id)  // bi is the player body, flip the contact normal
            contact.ni.negate(contactNormal);
        else
            contact.ni.copy(contactNormal); // bi is something else. Keep the normal as it is

        // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
        if(contactNormal.dot(upAxis) > 0.5) {
            scope.canJump = true;
            if (jump) {
                velocity.y = Settings.playerJumpVelocity;
                scope.canJump = false;
            }
        }
    });

    var velocity = cannonBody.velocity;

    var PI_2 = Math.PI / 2;

    var onMouseMove = function ( event ) {

        var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        yawObject.rotation.y -= movementX * 0.002;
        pitchObject.rotation.x -= movementY * 0.002;

        pitchObject.rotation.x = Math.max( - PI_2, Math.min( PI_2, pitchObject.rotation.x ) );
    };

    var onKeyDown = function ( event ) {
    if (!scope.enabled) return

        switch ( event.keyCode ) {
        case 38: // up
        case 87: // w
            moveForward = true;
            break;

        case 37: // left
        case 65: // a
            moveLeft = true;
            break;

        case 40: // down
        case 83: // s
            moveBackward = true;
            break;

        case 39: // right
        case 68: // d
            moveRight = true;
            break;

        case 32: // space
            if ( scope.canJump === true ){
                velocity.y = Settings.playerJumpVelocity;
            }
            scope.canJump = false;
            jump = true;
            break;

        case 84: // t
            $('#chat_input').focus();
            break;

        case 9: // tab
            if (!Interface.scoreboardDisabled)
                Interface.showScoreboard();
            break;

        case 16: // shift
            Game.player.attachGrapple();
            break;
        }
        event.preventDefault();

    };

    var onKeyUp = function ( event ) {
    if (!scope.enabled) return
        switch( event.keyCode ) {

        case 38: // up
        case 87: // w
            moveForward = false;
            break;

        case 37: // left
        case 65: // a
            moveLeft = false;
            break;

        case 40: // down
        case 83: // a
            moveBackward = false;
            break;

        case 39: // right
        case 68: // d
            moveRight = false;
            break;

        case 16: // shift
            Game.player.detachGrapple();
            break;

        case 32: // space
            jump = false;
            break;

        case 9: // tab
            if (!Interface.scoreboardDisabled)
                Interface.hideScoreboard();
            break;
        }

    };

    document.addEventListener( 'mousemove', onMouseMove, false );
    document.addEventListener( 'keydown', onKeyDown, false );
    document.addEventListener( 'keyup', onKeyUp, false );

    this.enabled = false;

    this.getObject = function () {
        return yawObject;
    };

    this.getDirection = function(targetVec){
        targetVec.set(0,0,-1);
        targetVec.applyQuaternion(quat);
    }

    // Moves the camera to the Cannon.js object position and adds velocity to the object if the run key is down
    var inputVelocity = new THREE.Vector3();
    this.update = function ( delta ) {
        delta *= 0.5;

        inputVelocity.set(0,0,0);

        if ( moveForward){
            inputVelocity.z = -Settings.playerVelocityFactor * delta;
            if (!scope.canJump)
                inputVelocity.z *= Settings.playerAirControlFactor;
        }

        if ( moveBackward){
            inputVelocity.z = Settings.playerVelocityFactor * delta;
            if (!scope.canJump)
                    inputVelocity.z *= Settings.playerAirControlFactor;
        }

        if ( moveLeft){
            inputVelocity.x = -Settings.playerVelocityFactor * delta;
            if (!scope.canJump)
                inputVelocity.x *= Settings.playerAirControlFactor;
        }

        if ( moveRight){
            inputVelocity.x = Settings.playerVelocityFactor * delta;
            if (!scope.canJump)
                inputVelocity.x *= Settings.playerAirControlFactor;
        }

        if (scope.canJump) {
            velocity.x *= Settings.playerFriction;
            velocity.z *= Settings.playerFriction;
        }

        // Convert velocity to world coordinates
        quat.setFromEuler(new THREE.Euler(pitchObject.rotation.x, yawObject.rotation.y, 0, "XYZ"));
        inputVelocity.applyQuaternion(quat);

    if ( Utils.vectMag( {x: velocity.x + inputVelocity.x,
                 y: velocity.y + inputVelocity.y,
                 z: velocity.z}) < Settings.playerMaxVelocity) {

        // Add to the object
        velocity.x += inputVelocity.x;
        velocity.z += inputVelocity.z;
    }

        cannonBody.position.copy(yawObject.position);
    };
};
