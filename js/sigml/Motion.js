import * as THREE from "three";
import { cubicBezierVec3, directionStringSymmetry, nlerpQuats } from "./SigmlUtils.js";

let _tempVec3_0 = new THREE.Vector3(0,0,0);
let _tempQuat_0 = new THREE.Quaternion(0,0,0,1);

let motionDirectionTable = {
    'u'     : (new THREE.Vector3(  0,   1,   0 )).normalize(),   
    'ul'    : (new THREE.Vector3(  1,   1,   0 )).normalize(),   
    'l'     : (new THREE.Vector3(  1,   0,   0 )).normalize(),   
    'dl'    : (new THREE.Vector3(  1,  -1,   0 )).normalize(),   
    'd'     : (new THREE.Vector3(  0,  -1,   0 )).normalize(),   
    'dr'    : (new THREE.Vector3( -1,  -1,   0 )).normalize(),  
    'r'     : (new THREE.Vector3( -1,   0,   0 )).normalize(),  
    'ur'    : (new THREE.Vector3( -1,   1,   0 )).normalize(),  

    "uo"    : (new THREE.Vector3(  0,   1,   1 )).normalize(),
    "uol"   : (new THREE.Vector3(  1,   1,   1 )).normalize(),
    "ol"    : (new THREE.Vector3(  1,   0,   1 )).normalize(),
    "dol"   : (new THREE.Vector3(  1,  -1,   1 )).normalize(),
    "do"    : (new THREE.Vector3(  0,  -1,   1 )).normalize(),
    "dor"   : (new THREE.Vector3( -1,  -1,   1 )).normalize(),
    "or"    : (new THREE.Vector3( -1,   0,   1 )).normalize(),
    "uor"   : (new THREE.Vector3( -1,   1,   1 )).normalize(),
    "o"     : (new THREE.Vector3(  0,   0,   1 )).normalize(),
    
    "ui"    : (new THREE.Vector3(  0,   1,  -1 )).normalize(),
    "uil"   : (new THREE.Vector3(  1,   1,  -1 )).normalize(),
    "il"    : (new THREE.Vector3(  1,   0,  -1 )).normalize(),
    "dil"   : (new THREE.Vector3(  1,  -1,  -1 )).normalize(),
    "di"    : (new THREE.Vector3(  0,  -1,  -1 )).normalize(),
    "dir"   : (new THREE.Vector3( -1,  -1,  -1 )).normalize(),
    "ir"    : (new THREE.Vector3( -1,   0,  -1 )).normalize(),
    "uir"   : (new THREE.Vector3( -1,   1,  -1 )).normalize(),
    "i"     : (new THREE.Vector3(  0,   0,  -1 )).normalize(),
}

// in x,y plane -> angle with respect to +y axis
let motionCurveTable = {
    'u'     : 0 * Math.PI / 180,   
    'ul'    : 315 * Math.PI / 180,   
    'l'     : 270 * Math.PI / 180,   
    'dl'    : 225 * Math.PI / 180,   
    'd'     : 180 * Math.PI / 180,   
    'dr'    : 135 * Math.PI / 180,  
    'r'     : 90 * Math.PI / 180,  
    'ur'    : 45 * Math.PI / 180,  
}

class DirectedMotion {
    constructor(){
        this.finalOffset = new THREE.Vector3(0,0,0);        
        this.bezier = [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ]

        this.distance = 0.05; // metres
        this.steepness = 0.5; // [0,1] curve steepness

        this.zigzagDir = new THREE.Vector3(0,0,1);
        this.zigzagSize = 0.01; // metres. Complete amplitude. Motion will move half to dir and half to -dir
        this.zigzagSpeed = 2; // loops per second

        this.transition = false;
        this.time = 0;

        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
    }

    reset(){
        this.transition = false;
        this.finalOffset.set(0,0,0);
    }

    update( dt ){
        if ( !this.transition ){ return; }
        
        this.time += dt;
        if ( this.time < this.start ){ return this.finalOffset; }

        else if ( this.time < this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            // t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5; // commented because of sigml purposes
            cubicBezierVec3( this.bezier[0], this.bezier[1], this.bezier[2], this.bezier[3], this.finalOffset, t );

            let zigzagAttenuation = Math.min( ( this.attackPeak - this.time ) / 0.5, Math.min( 1, ( this.time - this.start ) / 0.5 ) );  // min( outro, full, intro ). 0.5 seconds of intro and 0.5 of outro if possible
            let zigzagt = Math.sin( Math.PI * 2 * this.zigzagSpeed * ( this.time - this.start ) ) * this.zigzagSize * 0.5 * zigzagAttenuation;
            this.finalOffset.x = this.finalOffset.x + this.zigzagDir.x * zigzagt;
            this.finalOffset.y = this.finalOffset.y + this.zigzagDir.y * zigzagt;
            this.finalOffset.z = this.finalOffset.z + this.zigzagDir.z * zigzagt;
        }

        else if ( this.time < this.relax ){ 
            this.finalOffset.copy( this.bezier[3] );
        }

        else if ( this.time < this.end ){ // lerp to origin (0,0,0) 
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            // t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5; // commented because of sigml purposes
            this.finalOffset.copy( this.bezier[3] );
            this.finalOffset.multiplyScalar( 1.0 - t );
        }

        else { this.transition = false; this.finalOffset.set(0,0,0); }

        return this.finalOffset;
    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * direction: string from motionDirectionTable
     * secondDirection: (optional)
     * distance: (optional) size in metres of the displacement. Default 0.2 m (20 cm)
     * curve: (optional) string from motionCurveTable. Default to none
     * secondCurve: (optional)
     * curveSteepness: (optional) number from [0,1] meaning the sharpness of the curve
     * zigzag: (optional) string from motionDirectionTable
     * zigzagSize: (optional) amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
     * zigzagSpeed: (optional) cycles per second. Default 2
     */
    newGestureBML( bml, symmetry ){
        this.finalOffset.set(0,0,0);
          
        this.distance = isNaN( bml.distance ) ? 0.2 : bml.distance; // metres
        this.steepness = isNaN( bml.curveSteepness ) ? 0.5 : Math.max( 0, Math.min( 1, bml.curveSteepness ) );
        
        // fetch curve direction and adjust steepness if not present
        let curveDir = bml.curve;
        if ( curveDir && symmetry ){ curveDir = directionStringSymmetry( curveDir, symmetry ); }
        curveDir = motionCurveTable[ curveDir ];
        if ( isNaN( curveDir ) ){ this.steepness = 0; }
        else{
            //second curve direction
            let secondCurveDir = bml.secondCurve;
            if ( secondCurveDir && symmetry ){ secondCurveDir = directionStringSymmetry( secondCurveDir, symmetry ); }
            secondCurveDir = motionCurveTable[ secondCurveDir ];
            if ( isNaN( secondCurveDir ) ){ secondCurveDir = curveDir; }
            else{
                // find shortest path in circle
                if ( ( curveDir - secondCurveDir ) < -Math.PI ){ secondCurveDir -= 2 * Math.PI; }
                else if ( ( curveDir - secondCurveDir ) > Math.PI ){ secondCurveDir += 2 * Math.PI; }
            }
            curveDir = 0.5 * curveDir + 0.5 * secondCurveDir;
        }


        // set default direction (+z), default curve direction (+y) and ajust with size and curve steepness
        this.bezier[0].set(0,0,0);
        this.bezier[3].set(0,0,1).multiplyScalar( this.distance );
        this.bezier[1].set(0,1,0.5).multiplyScalar( this.distance * this.steepness );
        this.bezier[2].set(0,1,-0.5).multiplyScalar( this.distance * this.steepness ).add( this.bezier[3] );
                
        // rotate default curve direction (+y) to match user's one
        if ( !isNaN( curveDir ) ){
            _tempVec3_0.set(0,0,1);        
            this.bezier[1].applyAxisAngle( _tempVec3_0, curveDir );
            this.bezier[2].applyAxisAngle( _tempVec3_0, curveDir );
        }

        // fetch direction and secondDirection
        let direction = bml.direction;
        if ( direction && symmetry ){ direction = directionStringSymmetry( direction, symmetry ); }
        direction = motionDirectionTable[ direction ];
        if ( !direction ){ 
            console.warn( "Gesture: Location Motion no direction found with name \"" + bml.direction + "\"" );
            return;
        }
        let secondDirection = bml.secondDirection;
        if ( secondDirection && symmetry ){ secondDirection = directionStringSymmetry( secondDirection, symmetry ); }
        secondDirection = motionDirectionTable[ secondDirection ];
        if ( !secondDirection ){ secondDirection = direction; }
        
        let finalDir = _tempVec3_0;
        finalDir.lerpVectors( direction, secondDirection, 0.5 );
        finalDir.normalize();
        if( finalDir.lengthSq < 0.0001 ){ finalDir.copy( direction ); }

        // default looks at +z. If direction falls in -z, change default to -z to avoid accidental left-right, up-down mirror
        if ( finalDir.z < 0 ){
            this.bezier[0].z *= -1;
            this.bezier[1].z *= -1;
            this.bezier[2].z *= -1;
            this.bezier[3].z *= -1;
        }
        
        // rotate default direction to match the user's one
        let lookAtQuat = _tempQuat_0;
        if ( Math.abs(finalDir.dot(this.bezier[3])) > 0.999 ){ lookAtQuat.set(0,0,0,1); }
        else{ 
            let angle = finalDir.angleTo( this.bezier[3] );
            _tempVec3_0.crossVectors( this.bezier[3], finalDir );
            _tempVec3_0.normalize();
            lookAtQuat.setFromAxisAngle( _tempVec3_0, angle );
        }
        this.bezier[0].applyQuaternion( lookAtQuat );
        this.bezier[1].applyQuaternion( lookAtQuat );
        this.bezier[2].applyQuaternion( lookAtQuat );
        this.bezier[3].applyQuaternion( lookAtQuat );

        // zig-zag
        let zigzag = motionDirectionTable[ bml.zigzag ];
        if ( !zigzag ){
            this.zigzagDir.set(0,0,0);
            this.zigzagSize = 0.0; // metres
            this.zigzagSpeed = 0; // rps
        }else{
            this.zigzagDir.copy( zigzag );
            this.zigzagSize = isNaN( bml.zigzagSize ) ? 0.01 : bml.zigzagSize; // metres
            this.zigzagSpeed = isNaN( bml.zigzagSpeed ) ? 2 : bml.zigzagSpeed; // rps
        }

        // check and set timings
        this.start = bml.start || 0;
        this.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        this.attackPeak = bml.attackPeak || ( (this.end - this.start) * 0.25 + this.start );
        this.relax = bml.relax || ( (this.end - this.attackPeak) * 0.5 + this.attackPeak );
        this.time = 0; 

        // flag to start 
        this.transition = true;
    }
}

class CircularMotion {
    constructor(){
        this.finalOffset = new THREE.Vector3(0,0,0);

        this.startPoint = new THREE.Vector3(0,0,0);
        this.targetDeltaAngle = 0;
        this.axis = new THREE.Vector3(0,0,0);
        
        this.zigzagDir = new THREE.Vector3(0,0,1);
        this.zigzagSize = 0.01; // metres. Complete amplitude. Motion will move half to dir and half to -dir
        this.zigzagSpeed = 2; // loops per second

        this.transition = false;
        this.time = 0;

        this.start = 0;
        this.end = 0;
    }

    reset(){
        this.transition = false;
        this.finalOffset.set(0,0,0);
    }

    update( dt ){
        if ( !this.transition ){ return this.finalOffset; }
        
        this.time += dt;
        if ( this.time < this.start ){ return this.finalOffset; }
        if ( this.time >= this.attackPeak && this.time <= this.relax ){ // necessary to update (at least once) or there might be a jump
            this.finalOffset.copy( this.startPoint );
            this.finalOffset.applyAxisAngle( this.axis, this.targetDeltaAngle );
            this.finalOffset.sub( this.startPoint );
            return this.finalOffset; 
        }
        if ( this.time >= this.relax && this.time <= this.end ){ 
            this.finalOffset.copy( this.startPoint );
            this.finalOffset.applyAxisAngle( this.axis, this.targetDeltaAngle );
            this.finalOffset.sub( this.startPoint );
            this.finalOffset.multiplyScalar( ( this.end - this.time ) / ( this.end - this.relax ) );
            return this.finalOffset;
        }
        if ( this.time >= this.end ){ 
            this.transition = false; 
            this.finalOffset.set(0,0,0); 
            return this.finalOffset;
        }

        //if ( time > start && time < attackpeak ) start attackpeak
        let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
        // t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5;  // commented because of sigml purposes
        t = ( t > 1 ) ? 1 : t;
        
        // angle to rotate startPoint
        let angle = this.targetDeltaAngle * t;
        
        this.finalOffset.copy( this.startPoint );
        this.finalOffset.applyAxisAngle( this.axis, angle )

        // zigzag 
        if ( Math.abs(this.zigzagSize) > 0.0001 ){
            let easing = Math.max( 0, Math.min( 1, Math.min( ( this.time - this.start ) / 0.5, ( this.attackPeak - this.time ) / 0.5 ) ) );
            let zigzagt = Math.sin( Math.PI * 2 * this.zigzagSpeed * ( this.time - this.start ) ) * this.zigzagSize * 0.5 * easing;
            this.finalOffset.x = this.finalOffset.x + this.zigzagDir.x * zigzagt;
            this.finalOffset.y = this.finalOffset.y + this.zigzagDir.y * zigzagt;
            this.finalOffset.z = this.finalOffset.z + this.zigzagDir.z * zigzagt;
        }

        this.finalOffset.sub( this.startPoint );
        return this.finalOffset;
    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * direction: string from motionDirectionTable. Axis of rotation
     * secondDirection: (optional)
     * distance: (optional) radius in metres of the circle. Default 0.05 m (5 cm)
     * startAngle: (optional) where in the circle to start. 0º indicates up. Indicated in degrees. Default to 0º. [-infinity, +infinity]
     * endAngle: (optional) where in the circle to finish. 0º indicates up. Indicated in degrees. Default to 360º. [-infinity, +infinity]
     * zigzag: (optional) string from motionDirectionTable
     * zigzagSize: (optional) amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
     * zigzagSpeed: (optional) cycles per second. Default 2
     */
    newGestureBML( bml, symmetry ){
        // debug
        // this.color = Math.floor( Math.random() * 0xffffff );                
        this.finalOffset.set(0,0,0);
        
        // axis
        let direction = bml.direction;
        if ( direction && symmetry ){ direction = directionStringSymmetry( direction, symmetry ); }
        direction = motionDirectionTable[ direction ];
        if ( !direction ) { direction = motionDirectionTable['o']; }
        
        let secondDirection = bml.secondDirection;
        if ( secondDirection && symmetry ){ secondDirection = directionStringSymmetry( secondDirection, symmetry ); }
        secondDirection = motionDirectionTable[ secondDirection ];
        if ( !secondDirection ) { secondDirection = direction; }

        this.axis.lerpVectors( direction, secondDirection, 0.5 );
        this.axis.normalize();
        if( this.axis.lengthSq() < 0.0001 ){ this.axis.copy( direction ); }

        // angle computations
        let startAngle = isNaN( bml.startAngle ) ? 0 : ( bml.startAngle * Math.PI / 180.0 );
        let endAngle = isNaN( bml.endAngle ) ? ( startAngle + 2 * Math.PI ) : ( bml.endAngle * Math.PI / 180.0 );
        this.targetDeltaAngle = endAngle - startAngle; //variable endAngle is no longer used
        if( symmetry ){ // all symmetries mirror the same
            this.targetDeltaAngle *= -1;
            startAngle = -startAngle;
        }
       
        // rotate starting point from default plane (xy) to the user's specified (given by axis)
        _tempVec3_0.set(0,0,1);        // default axis
        let dot = _tempVec3_0.dot( this.axis );
        if ( dot > 0.999 ){ _tempQuat_0.set(0,0,0,1); }
        else if ( dot < -0.999 ){ _tempVec3_0.set(0,1,0); _tempQuat_0.setFromAxisAngle( _tempVec3_0, Math.PI ); }
        else{
            let angle = _tempVec3_0.angleTo( this.axis );
            _tempVec3_0.crossVectors( _tempVec3_0, this.axis );
            _tempVec3_0.normalize();
            _tempQuat_0.setFromAxisAngle( _tempVec3_0, angle );
        }

        let distance = isNaN( bml.distance ) ? 0.05 : bml.distance;
        this.startPoint.set(0,1,0).multiplyScalar( distance );
        this.startPoint.applyQuaternion( _tempQuat_0 );

        // apply starting angle to startPoint
        this.startPoint.applyAxisAngle( this.axis, startAngle );

        // zig-zag
        let zigzag = motionDirectionTable[ bml.zigzag ];
        if ( !zigzag ){
            this.zigzagDir.set(0,0,0);
            this.zigzagSize = 0.0; // metres
            this.zigzagSpeed = 0; // rps
        }else{
            this.zigzagDir.copy( zigzag );
            this.zigzagSize = isNaN( bml.zigzagSize ) ? 0.01 : bml.zigzagSize; // metres
            this.zigzagSpeed = isNaN( bml.zigzagSpeed ) ? 2 : bml.zigzagSpeed; // rps
        }

        // check and set timings
        this.start = bml.start || 0;
        this.end = bml.end || (bml.start + 1);
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.time = 0; 

        // flag to start 
        this.transition = true;
    }
}




class FingerPlay {
    constructor(){ 
        this.curBends = [ 0, 0, 0, 0, 0 ]; // thumb, index, middle, ring, pinky
        this.fingerEnabler = 0x00; // flags. bit0 = thumb, bit1 = index, bit2 = middle, bit3 = ring, bit4 = pinky
        
        this.transition = false;
        this.time = 0;
        this.speed = 3;
        this.intensity = 0.3;

        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
    }

    reset(){
        this.transition = false;
        this.curBends.fill( 0 );
    }

    update( dt ){
        if ( !this.transition ){ return; }

        this.time += dt;
        let intensity = 0;
        if ( this.time < this.start ){ intensity = 0; }
        else if ( this.time < this.attackPeak ){ intensity = ( this.time - this.start ) / ( this.attackPeak - this.start ); }
        else if ( this.time < this.relax ){ intensity = 1; }
        else if ( this.time < this.end ){ intensity = ( this.time - this.relax ) / ( this.end - this.relax ); intensity = 1.0-intensity; }
        else {
            intensity = 0; 
            this.transition = false;
        }

        intensity *= this.intensity * 0.5; // intensity = amplitude

        // interpolation -- cos(t + X) where X is different for each finger
        if ( this.fingerEnabler & 0x01 ) { 
            this.curBends[0] = ( Math.cos( Math.PI * 2 * this.speed * this.time + Math.PI * 0.25 ) ) * intensity;
        }
        if ( this.fingerEnabler & 0x02 ) { 
            this.curBends[1] = ( Math.cos( Math.PI * 2 * this.speed * this.time ) ) * intensity;
        }
        if ( this.fingerEnabler & 0x04 ) { 
            this.curBends[2] = ( Math.cos( Math.PI * 2 * this.speed * this.time + Math.PI * 0.65 ) ) * intensity;
        }
        if ( this.fingerEnabler & 0x08 ) { 
            this.curBends[3] = ( Math.cos( Math.PI * 2 * this.speed * this.time + Math.PI * 1.05 ) ) * intensity;
        }
        if ( this.fingerEnabler & 0x10 ) { 
            this.curBends[4] =  ( Math.cos( Math.PI * 2 * this.speed * this.time + Math.PI * 1.35 ) ) * intensity;
        }
    }

     /**
     * bml info
     * start, attackPeak, relax, end
     * speed = (optional) oscillations per second. Default 3
     * intensity = (optional) [0,1]. Default 0.3
     * fingers = (optional) string with numbers. Each number present activates a finger. 0=thumb, 1=index, 2=middle, 3=ring, 4=pinky. I.E. "123" activates index, middle, ring but not pinky. Default all enabled
     * exemptedFingers = (optional) string with numbers. Blocks a finger from doing the finger play. Default all fingers move
     */
    newGestureBML( bml ){

        this.speed = isNaN( bml.speed ) ? 3 : bml.speed;
        this.intensity = isNaN( bml.intensity ) ? 0.3 : bml.intensity;
        this.intensity = Math.min( 1, Math.max( 0, this.intensity ) );

        this.transition = true;

        this.fingerEnabler = 0x1f;
        if ( typeof( bml.fingers ) == 'string' ){
            // enable only the specified fingers (bits)
            this.fingerEnabler = 0x00; 
            for( let i = 0; i < bml.fingers.length; ++i ){
                let val = parseInt( bml.fingers[i] );
                if ( !isNaN( val ) ){ this.fingerEnabler |= 0x01 << val; }
            }
            this.fingerEnabler &= 0x1f; // mask unused bits
        }
        if ( typeof( bml.exemptedFingers ) == 'string' ){
            // enable only the specified fingers (bits)
            for( let i = 0; i < bml.exemptedFingers.length; ++i ){
                let val = parseInt( bml.exemptedFingers[i] );
                if ( !isNaN( val ) ){ this.fingerEnabler &= ~(0x01 << val); }
            }
            this.fingerEnabler &= 0x1f; // mask unused bits
        }

        // check and set timings
        this.start = bml.start || 0;
        this.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        this.attackPeak = bml.attackPeak || ( (this.end - this.start) * 0.25 + this.start );
        this.relax = bml.relax || ( (this.end - this.attackPeak) * 0.5 + this.attackPeak );
        this.time = 0; 
    }

};



class WristMotion {
    constructor( wristBone ){
        this.wristBone = wristBone;
        
        this.mode = 0; // FLAGS 0=NONE, 1=TWIST, 2=NOD, 4=SWING 
        this.intensity = 1;
        this.speed = 1;

        this.time = 0;
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        this.transition = false;
    }

    reset(){
        this.time = 0;
        this.mode = 0;
        this.transition = false;
    }

    update( dt ){
        if ( !this.transition ){ return; }

        this.time += dt;
        let intensity = 0;
        if ( this.time < this.start ){ intensity = 0; }
        else if ( this.time < this.attackPeak ){ intensity = ( this.time - this.start ) / ( this.attackPeak - this.start ); }
        else if ( this.time < this.relax ){ intensity = 1; }
        else if ( this.time < this.end ){ intensity = ( this.time - this.relax ) / ( this.end - this.relax ); intensity = 1.0-intensity; }
        else {
            intensity = 0; 
            this.mode = 0x00;
            this.transition = false;
        }
        intensity *= this.intensity;

        if ( this.mode & 0x01 ){ // TWIST
            let twistAxis = _tempVec3_0;
            twistAxis.set(0,0,1);
            twistAxis.applyQuaternion( this.wristBone.quaternion );
            let angle = Math.cos( 2 * Math.PI * this.speed * this.time ) * intensity * ( Math.PI * 0.5 );
            _tempQuat_0.setFromAxisAngle( twistAxis, angle );
            this.wristBone.quaternion.premultiply( _tempQuat_0 );
        }
        if ( this.mode & 0x02 ){ // NOD
            let nodAxis = _tempVec3_0;
            nodAxis.set(1,0,0);
            nodAxis.applyQuaternion( this.wristBone.quaternion );
            let angle = Math.cos( 2 * Math.PI * this.speed * this.time ) * intensity * ( Math.PI * 0.5 );
            _tempQuat_0.setFromAxisAngle( nodAxis, angle );
            this.wristBone.quaternion.premultiply( _tempQuat_0 );
        }
        if ( this.mode & 0x04 ){ // SWING
            let swingAxis = _tempVec3_0;
            swingAxis.set(0,1,0);
            swingAxis.applyQuaternion( this.wristBone.quaternion );
            let angle = Math.sin( 2 * Math.PI * this.speed * this.time ) * intensity * ( Math.PI * 0.5 ); // PHASE of 90ª with respect to NOD (see newGestureBML)
            _tempQuat_0.setFromAxisAngle( swingAxis, angle );
            this.wristBone.quaternion.premultiply( _tempQuat_0 );
        }

    }

     /**
     * bml info
     * start, attackPeak, relax, end
     * mode = either a: 
     *          - string from [ "nod", "nodding", "swing", "swinging", "twist", "twisting", "stirCW", "stircw", "stirCCW", "stirccw", "all" ]
     *          - or a value from [ 0 = None, 1 = twist, 2 = nod, swing = 4 ]. 
     *            Several values can co-occur by using the OR (|) operator. I.E. ( 2 | 4 ) = stirCW
     *            Several values can co-occur by summing the values. I.E. ( 2 + 4 ) = stirCW
     * speed = (optional) oscillations per second. A negative values accepted. Default 3. 
     * intensity = (optional) [0,1]. Default 0.3
     */
    newGestureBML( bml ){
        
        this.speed = isNaN( bml.speed ) ? 3 : bml.speed;
        this.intensity = isNaN( bml.intensity ) ? 0.3 : bml.intensity;
        this.intensity = Math.min( 1, Math.max( 0, this.intensity ) );
        
        if ( typeof( bml.mode ) == "string" ){
            switch( bml.mode ){
                case "nod": case "nodding": this.mode = 0x02; break;
                case "swing": case "swinging": this.mode = 0x04; break;
                case "twist": case "twisting": this.mode = 0x01; break;
                case "stirCW": case "stircw": this.mode = 0x06; break; // 0x02 | 0x04
                case "stirCCW": case "stirccw":this.mode = 0x06; this.speed *= -1; break;
                case "all": this.mode = 0x07; break;
                default:
                    console.warn( "Gesture: No wrist motion called \"", bml.mode, "\" found" );
                    return;
            }
        }
        else if ( isNaN( bml.mode ) ) {
            console.warn( "Gesture: No wrist motion called \"", bml.mode, "\" found" );
            return;
        }
        else{
            this.mode = bml.mode & 0x07; // take only the necessary bits
        }
        
        // check and set timings
        this.start = bml.start || 0;
        this.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        this.attackPeak = bml.attackPeak || ( (this.end - this.start) * 0.25 + this.start );
        this.relax = bml.relax || ( (this.end - this.attackPeak) * 0.5 + this.attackPeak );
        this.time = 0; 

        this.transition = true;
    }
};
    
export { DirectedMotion, CircularMotion, FingerPlay, WristMotion }