import { Matrix3, Matrix4, Mesh, MeshPhongMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { CCDIKSolver, FABRIKSolver } from "./IKSolver.js";
import { cubicBezierVec3 } from "./sigmlUtils.js";

let directionTable = {
    'u'     : (new Vector3(  0,   1,   0 )).normalize(),   
    'ul'    : (new Vector3(  1,   1,   0 )).normalize(),   
    'l'     : (new Vector3(  1,   0,   0 )).normalize(),   
    'dl'    : (new Vector3(  1,  -1,   0 )).normalize(),   
    'd'     : (new Vector3(  0,  -1,   0 )).normalize(),   
    'dr'    : (new Vector3( -1,  -1,   0 )).normalize(),  
    'r'     : (new Vector3( -1,   0,   0 )).normalize(),  
    'ur'    : (new Vector3( -1,   1,   0 )).normalize(),  

    "uo"    : (new Vector3(  0,   1,   1 )).normalize(),
    "uol"   : (new Vector3(  1,   1,   1 )).normalize(),
    "ol"    : (new Vector3(  1,   0,   1 )).normalize(),
    "dol"   : (new Vector3(  1,  -1,   1 )).normalize(),
    "do"    : (new Vector3(  0,  -1,   1 )).normalize(),
    "dor"   : (new Vector3( -1,  -1,   1 )).normalize(),
    "or"    : (new Vector3( -1,   0,   1 )).normalize(),
    "uor"   : (new Vector3( -1,   1,   1 )).normalize(),
    "o"     : (new Vector3(  0,   0,   1 )).normalize(),
    
    "ui"    : (new Vector3(  0,   1,  -1 )).normalize(),
    "uil"   : (new Vector3(  1,   1,  -1 )).normalize(),
    "il"    : (new Vector3(  1,   0,  -1 )).normalize(),
    "dil"   : (new Vector3(  1,  -1,  -1 )).normalize(),
    "di"    : (new Vector3(  0,  -1,  -1 )).normalize(),
    "dir"   : (new Vector3( -1,  -1,  -1 )).normalize(),
    "ir"    : (new Vector3( -1,   0,  -1 )).normalize(),
    "uir"   : (new Vector3( -1,   1,  -1 )).normalize(),
    "i"     : (new Vector3(  0,   0,  -1 )).normalize(),
}

let curveDirectionTable = {
    'u'     : directionTable['u'],   
    'ul'    : directionTable['ul'],   
    'l'     : directionTable['l'],   
    'dl'    : directionTable['dl'],   
    'd'     : directionTable['d'],   
    'dr'    : directionTable['dr'],  
    'r'     : directionTable['r'],  
    'ur'    : directionTable['ur'],  
}

// has the ikSolver and the several motions for each arm
class LocationMotionManager {
    constructor( character ){
        this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                this.skeleton = o.skeleton;
            }
        } );

        this.ikSolver = new FABRIKSolver( this.skeleton );
        this.ikTarget = { position: new Vector3(0,0,0) }; // worldposition
        this._ikCreateChains( "LeftHand", "LeftShoulder" );
        this._ikCreateChains( "RightHand", "RightArm" );
        this.ikSolver.constraintsEnabler = false;
        this.ikSolver.setChainEnablerAll(false);
        this.ikSolver.setIterations(4);


        this.leftHandChain = this.ikSolver.getChain("mixamorig_LeftHand");
        this.rightHandChain = this.ikSolver.getChain("mixamorig_RightHand");

        this.leftMotions = [ new DirectedMotion(), new CircularMotion() ];
        this.rightMotions = [ new DirectedMotion(), new CircularMotion() ];

        this.updateOffset = new Vector3();
    }

    update( dt ){
        this._updateArm( dt, this.leftHandChain, this.leftMotions );
        this._updateArm( dt, this.rightHandChain, this.rightMotions );
    } 

    _updateArm( dt, chain, motions ){
        this.updateOffset.set(0,0,0);
        let computeFlag = false;

        // check if any motion is active and update it
        for ( let i = 0; i < motions.length; ++i ){
            if ( motions[i].transition ){
                computeFlag = true;
                this.updateOffset.add( motions[i].update( dt ) );
            }
        }

        // compute ik only if necessary
        if( computeFlag ){
            this.skeleton.bones[ chain.chain[0] ].getWorldPosition( this.ikTarget.position );
            this.ikTarget.position.add( this.updateOffset );

            // debug points desired location
            // let k = new Mesh( new SphereGeometry(0.005, 16, 16), new MeshPhongMaterial({ color: this.color , depthTest:false, depthWrite: false }) );
            // k.position.copy(this.ikTarget.position);
            // window.global.app.scene.add( k );
    
            chain.enabler = true;
            this.ikSolver.update();
            chain.enabler = false;
    
            // debug points position after ik
            // this.skeleton.bones[ chain.chain[0] ].getWorldPosition( this.ikTarget.position );
            // k = new Mesh( new SphereGeometry(0.005, 16, 16), new MeshPhongMaterial({ color: this.color , depthTest:false, depthWrite: false }) );
            // k.position.copy(this.ikTarget.position);
            // window.global.app.scene.add( k );
        }            
    }

    newGestureBML( bml ){
        // debug
        // this.color = Math.floor( Math.random() * 0xffffff );

        let left = null; let right = null; 
        if ( bml.motion == "directed" ){
            left = this.leftMotions[0];
            right = this.rightMotions[0];
        }
        if ( bml.motion == "circular" ){
            left = this.leftMotions[1];
            right = this.rightMotions[1];
        }

        if ( bml.hand == "left" || bml.hand == "both" ){ left.newGestureBML( bml ); }
        if ( !bml.hand || bml.hand == "right" || bml.hand == "both" ){ right.newGestureBML( bml ); }

    }

    _ikCreateChains( effectorName, rootName ) {
        let bones = this.skeleton.bones;
        let effector = this.skeleton.getBoneByName( effectorName );
        let root = this.skeleton.getBoneByName( rootName );

        if ( !effector ) { // find similarly named bone
            for ( let i = 0; i < bones.length; ++i ) {
                if ( bones[ i ].name.includes( effectorName ) ) {
                    effector = bones[ i ];
                    break;
                }
            }
        }
        if ( !root ) { // bind similarly named bone
            for ( let i = 0; i < bones.length; ++i ) {
                if ( bones[ i ].name.includes( rootName ) ) {
                    root = bones[ i ];
                    break;
                }
            }
        }
        if ( !effector || !root ) { return; }

        let chain = []
        let bone = effector;
        while ( true ) {
            let i = bones.indexOf( bone );
            if ( i < 0 ) { console.warn( "IK chain: Skeleton root was reached before chain root " ); break; }

            chain.push( i );

            if ( bone == root ) { break; }
            bone = bone.parent;
        }

        effector = bones[ chain[ 0 ] ];
        while ( effector != root ) {
            if ( !this.ikSolver.getChain( effector.name ) ) {
                this.ikSolver.createChain( chain, null, this.ikTarget, effector.name );
            }
            chain.splice( 0, 1 );
            effector = bones[ chain[ 0 ] ];
        }
    }
}


// TODO: check parameters from bml, zig zag attenuation (on update)
class DirectedMotion {
    constructor(){
        this.lookAtQuat = new Quaternion();
        this.baseOffset = new Vector3(0,0,0);
        this.finalOffset = new Vector3(0,0,0);        
        this.bezier = [ new Vector3(), new Vector3(), new Vector3(), new Vector3() ]

        this.distance = 0.05; // cm
        this.steepness = 0.5; // [0,1] curve steepness

        this.zigzagDir = new Vector3(0,0,1);
        this.zigzagSize = 0.01; // cm. Complete amplitude. Motion will move half to dir and half to -dir
        this.zigzagSpeed = 2; // loops per second

        this.transition = false;
        this.time = 0;

        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
    }

    update( dt ){
        if ( !this.transition ){ return; }
        
        this.time += dt;
        if ( this.time < this.start ){ 
            this.finalOffset.copy( this.baseOffset );
        }

        else if ( this.time < this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            cubicBezierVec3( this.bezier[0], this.bezier[1], this.bezier[2], this.bezier[3], this.finalOffset, t );
            this.finalOffset.add( this.baseOffset );

            let zigzagt = Math.sin( Math.PI * 2 * this.zigzagSpeed * this.time ) * this.zigzagSize *0.5;
            this.finalOffset.x = this.finalOffset.x + this.zigzagDir.x * zigzagt;
            this.finalOffset.y = this.finalOffset.y + this.zigzagDir.y * zigzagt;
            this.finalOffset.z = this.finalOffset.z + this.zigzagDir.z * zigzagt;
        }

        else if ( this.time < this.relax ){ 
            this.finalOffset.addVectors( this.bezier[3], this.baseOffset );
        }

        else if ( this.time < this.end ){ // lerp to origin (0,0,0) 
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            this.finalOffset.addVectors( this.bezier[3], this.baseOffset );
            this.finalOffset.multiplyScalar( 1.0 - t );
        }

        else { this.transition = false; this.finalOffset.set(0,0,0); }

        return this.finalOffset;
    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * direction: string from directionTable
     * distance: (optional) size in metres of the displacement. Default 0.2 m (20 cm)
     * curve: (optional) string from curveDirectionTable. Default to none
     * curveSteepness: (optional) number from [0,1] meaning the sharpness of the curve
     * zigzag: (optional) string from directionTable
     * zigzagSize: (optional) amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
     * zigzagSpeed: (optional) cycles per second. Default 2
     * hand: (optional) "right", "left", "both". Default right  
     */
    newGestureBML( bml ){
        let tempV = new Vector3(0,0,0);
                
        this.time = 0;
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        
        this.baseOffset.copy( this.finalOffset );
        
        this.distance = isNaN( bml.distance ) ? 0.2 : bml.distance;//0.20; // cm
        this.steepness = isNaN( bml.curveSteepness ) ? 0.5 : Math.max( 0, Math.min( 1, bml.curveSteepness ) );
        let curveDir = curveDirectionTable[ bml.curve ];
        if ( !curveDir ){ this.steepness = 0; }

        // set default direction (+z), default curve direction (+y) and ajust with size and curve steepness
        this.bezier[0].set(0,0,0);
        this.bezier[3].set(0,0,1).multiplyScalar( this.distance );
        this.bezier[1].set(0,1,0.5).multiplyScalar( this.distance * this.steepness );
        this.bezier[2].set(0,1,-0.5).multiplyScalar( this.distance * this.steepness ).add( this.bezier[3] );
                
        // rotate default curve direction (+y) to match user's one
        if ( curveDir ){
            let angle = curveDir.angleTo( curveDirectionTable['u'] ); // [0º,180º]
            if ( curveDir.x > 0.0 ){ angle = Math.PI * 2 - angle; }   // [0º,360º]

            tempV.set(0,0,1);
        
            this.bezier[1].applyAxisAngle( tempV, angle );
            this.bezier[2].applyAxisAngle( tempV, angle );
        }

        // rotate default direction to match the user's one
        let direction = directionTable[ bml.direction ];
        if ( !direction ){ 
            console.warn( "Gesture: Location Motion no direction found with name \"" + bml.direction + "\"" );
            return;
        }

        // instead of rotating +90º, change point of view (mirror on xy plane)
        if ( direction.z < 0 ){
            this.bezier[0].z *= -1;
            this.bezier[1].z *= -1;
            this.bezier[2].z *= -1;
            this.bezier[3].z *= -1;
        }

        if ( Math.abs(direction.dot(this.bezier[3])) > 0.999 ){ this.lookAtQuat.set(0,0,0,1); }
        else{ 
            let angle = direction.angleTo( this.bezier[3] );
            tempV.crossVectors( this.bezier[3], direction );
            tempV.normalize();
            this.lookAtQuat.setFromAxisAngle( tempV, angle );
        }

        this.bezier[0].applyQuaternion( this.lookAtQuat );
        this.bezier[1].applyQuaternion( this.lookAtQuat );
        this.bezier[2].applyQuaternion( this.lookAtQuat );
        this.bezier[3].applyQuaternion( this.lookAtQuat );

        // zig-zag
        let zigzag = directionTable[ bml.zigzag ];
        if ( !zigzag ){
            this.zigzagDir.set(0,0,0);
            this.zigzagSize = 0.0; // cm
            this.zigzagSpeed = 0; // rps
        }else{
            this.zigzagDir.copy( zigzag );
            this.zigzagSize = isNaN( bml.zigzagSize ) ? 0.01 : bml.zigzagSize; // cm
            this.zigzagSpeed = isNaN( bml.zigzagSpeed ) ? 2 : bml.zigzagSpeed; // rps
        }

        // flag to start 
        this.transition = true;
    }
}

// TODO: check parameters from bml, zig zag attenuation (on update, missing outro ending attenuation)
class CircularMotion {
    constructor(){
        this.baseOffset = new Vector3(0,0,0);
        this.finalOffset = new Vector3(0,0,0);

        this.startPoint = new Vector3(0,0,0);
        this.easingAngle = 60.0 * Math.PI/180.0; // entry/outro extra angle  
        this.targetDeltaAngle = 0; // entry easing + user specified. Outro will be computed on each update if necessary
        this.axis = new Vector3(0,0,0);
        
        this.zigzagDir = new Vector3(0,0,1);
        this.zigzagSize = 0.01; // cm. Complete amplitude. Motion will move half to dir and half to -dir
        this.zigzagSpeed = 2; // loops per second

        this.transition = false;
        this.time = 0;

        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
    }

    update( dt ){
        if ( !this.transition ){ return; }
        
        this.time += dt;
        if ( this.time < this.start ){ 
            this.finalOffset.copy( this.baseOffset );
        }

        else if ( this.time < this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            let angle = this.targetDeltaAngle * t;

            this.finalOffset.copy( this.startPoint );
            this.finalOffset.applyAxisAngle( this.axis, angle )

            let zigzagAttenuation = 1;
            // entry easing
            if ( Math.abs( angle ) < this.easingAngle ){ 
                let easingT = Math.abs( angle ) / this.easingAngle;
                easingT = Math.sin( Math.PI * easingT - Math.PI*0.5 ) * 0.5 + 0.5;
                this.finalOffset.multiplyScalar( easingT );
                zigzagAttenuation = easingT;
            }
            this.finalOffset.add( this.baseOffset );

            // zigzag 
            let zigzagt = Math.sin( Math.PI * 2 * this.zigzagSpeed * this.time ) * this.zigzagSize * 0.5 * zigzagAttenuation;
            this.finalOffset.x = this.finalOffset.x + this.zigzagDir.x * zigzagt;
            this.finalOffset.y = this.finalOffset.y + this.zigzagDir.y * zigzagt;
            this.finalOffset.z = this.finalOffset.z + this.zigzagDir.z * zigzagt;
        }

        else if ( this.time < this.relax ){ 
            this.finalOffset.copy( this.startPoint );
            this.finalOffset.applyAxisAngle( this.axis, this.targetDeltaAngle )
            this.finalOffset.add( this.baseOffset );
        }

        else if ( this.time < this.end ){ // lerp to origin (0,0,0) 
            this.finalOffset.copy( this.startPoint );
            this.finalOffset.applyAxisAngle( this.axis, this.targetDeltaAngle )
            this.finalOffset.add( this.baseOffset );
            
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            this.finalOffset.multiplyScalar( 1.0 - t );
        }

        else { this.transition = false; this.finalOffset.set(0,0,0); }
        
        return this.finalOffset;
    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * direction: string from directionTable. Axis of rotation
     * distance: (optional) radius in metres of the circle. Default 0.05 m (5 cm)
     * startAngle: (optional) where in the circle to start. 0º indicates up. Indicated in degrees. Default to 0º. [-infinity, +infinity]
     * endAngle: (optional) where in the circle to finish. 0º indicates up. Indicated in degrees. Default to 360º. [-infinity, +infinity]
     * zigzag: (optional) string from directionTable
     * zigzagSize: (optional) amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
     * zigzagSpeed: (optional) cycles per second. Default 2
     * hand: (optional) "right", "left", "both". Default right  
     */
    newGestureBML( bml ){
        // debug
        // this.color = Math.floor( Math.random() * 0xffffff );
        let tempV = new Vector3(0,0,0);
        let tempQ = new Quaternion(0,0,0,1);
                
        this.time = 0;
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        
        this.baseOffset.copy( this.finalOffset );
        
        // axis
        let direction = directionTable[ bml.direction ];
        if ( !direction ) {
            direction = directionTable['o'];
        }
        this.axis.copy(direction);

        // angle computations
        let startAngle = isNaN( bml.startAngle ) ? 0 : ( bml.startAngle  * Math.PI / 180.0 );
        let endAngle = isNaN( bml.endAngle ) ? 0 : ( bml.endAngle  * Math.PI / 180.0 );
        this.targetDeltaAngle = endAngle - startAngle;
        if( this.targetDeltaAngle >= 0 ){ // add extra angle for ease-in
            startAngle -= this.easingAngle;
            this.targetDeltaAngle += this.easingAngle;
        }else{
            startAngle += this.easingAngle;
            this.targetDeltaAngle -= this.easingAngle;
        }
        
        // rotate starting point from default plane (xy) to the user's specified (given by axis)
        tempV.set(0,0,1);        // default axis
        let dot = tempV.dot( direction );
        if ( dot > 0.999 ){ tempQ.set(0,0,0,1); }
        else if ( dot < -0.999 ){ tempV.set(0,1,0); tempQ.setFromAxisAngle( tempV, Math.PI ); }
        else{
            let angle = tempV.angleTo( direction );
            tempV.crossVectors( tempV, direction );
            tempV.normalize();
            tempQ.setFromAxisAngle( tempV, angle );
        }

        let distance = isNaN( bml.distance ) ? 0.05 : bml.distance;
        this.startPoint.set(0,1,0).multiplyScalar( distance );
        this.startPoint.applyQuaternion( tempQ );

        // apply starting angle to startPoint
        this.startPoint.applyAxisAngle( this.axis, startAngle );

        // zig-zag
        let zigzag = directionTable[ bml.zigzag ];
        if ( !zigzag ){
            this.zigzagDir.set(0,0,0);
            this.zigzagSize = 0.0; // cm
            this.zigzagSpeed = 0; // rps
        }else{
            this.zigzagDir.copy( zigzag );
            this.zigzagSize = isNaN( bml.zigzagSize ) ? 0.01 : bml.zigzagSize; // cm
            this.zigzagSpeed = isNaN( bml.zigzagSpeed ) ? 2 : bml.zigzagSpeed; // rps
        }

        // flag to start 
        this.transition = true;
    }
}

export {LocationMotionManager}