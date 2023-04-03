import { Quaternion, Vector3 } from "three";
import { cubicBezierVec3, directionStringSymmetry, nlerpQuats } from "./sigmlUtils.js";

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


// TODO: check parameters from bml, zig zag attenuation (on update)
class DirectedMotion {
    constructor(){
        this.lookAtQuat = new Quaternion();
        this.baseOffset = new Vector3(0,0,0);
        this.finalOffset = new Vector3(0,0,0);        
        this.bezier = [ new Vector3(), new Vector3(), new Vector3(), new Vector3() ]

        this.distance = 0.05; // metres
        this.steepness = 0.5; // [0,1] curve steepness

        this.zigzagDir = new Vector3(0,0,1);
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
        this.baseOffset.set(0,0,0);
    }

    update( dt ){
        if ( !this.transition ){ return; }
        
        this.time += dt;
        if ( this.time < this.start ){ 
            this.finalOffset.copy( this.baseOffset );
        }

        else if ( this.time < this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5;
            cubicBezierVec3( this.bezier[0], this.bezier[1], this.bezier[2], this.bezier[3], this.finalOffset, t );
            this.finalOffset.add( this.baseOffset );

            let zigzagAttenuation = Math.min( ( this.attackPeak - this.time ) / 0.5, Math.min( 1, ( this.time - this.start ) / 0.5 ) );  // min( outro, full, intro ). 0.5 seconds of intro and 0.5 of outro if possible
            let zigzagt = Math.sin( Math.PI * 2 * this.zigzagSpeed * ( this.time - this.start ) ) * this.zigzagSize * 0.5 * zigzagAttenuation;
            this.finalOffset.x = this.finalOffset.x + this.zigzagDir.x * zigzagt;
            this.finalOffset.y = this.finalOffset.y + this.zigzagDir.y * zigzagt;
            this.finalOffset.z = this.finalOffset.z + this.zigzagDir.z * zigzagt;
        }

        else if ( this.time < this.relax ){ 
            this.finalOffset.addVectors( this.bezier[3], this.baseOffset );
        }

        else if ( this.time < this.end ){ // lerp to origin (0,0,0) 
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5;
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
     */
    newGestureBML( bml, symmetry ){
        let tempV = new Vector3(0,0,0);
                
        this.time = 0;
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        
        this.baseOffset.copy( this.finalOffset );
        
        this.distance = isNaN( bml.distance ) ? 0.2 : bml.distance; // metres
        this.steepness = isNaN( bml.curveSteepness ) ? 0.5 : Math.max( 0, Math.min( 1, bml.curveSteepness ) );
        
        // fetch curve direction and adjust steepness if not present
        let curveDir = bml.curve;
        if ( curveDir && symmetry ){ curveDir = directionStringSymmetry( curveDir, symmetry ); }
        curveDir = curveDirectionTable[ curveDir ];
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

        // fetch direction
        let direction = bml.direction;
        if ( direction && symmetry ){ direction = directionStringSymmetry( direction, symmetry ); }
        direction = directionTable[ direction ];
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
        
        // rotate default direction to match the user's one
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
            this.zigzagSize = 0.0; // metres
            this.zigzagSpeed = 0; // rps
        }else{
            this.zigzagDir.copy( zigzag );
            this.zigzagSize = isNaN( bml.zigzagSize ) ? 0.01 : bml.zigzagSize; // metres
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
        this.baseOffset.set(0,0,0);
    }

    update( dt ){
        if ( !this.transition ){ return; }
        
        this.time += dt;
        if ( this.time < this.start ){ 
            this.finalOffset.copy( this.baseOffset );
        }

        else if ( this.time < this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5;

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
            zigzagAttenuation = Math.min( ( this.attackPeak - this.time ) / 0.5, Math.min( 1, zigzagAttenuation ) );  // min( outro, full, intro ). X seconds of intro and 0.5 of outro if possible
            let zigzagt = Math.sin( Math.PI * 2 * this.zigzagSpeed * ( this.time - this.start ) ) * this.zigzagSize * 0.5 * zigzagAttenuation;
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
            
            let t = ( this.end - this.time ) / ( this.end - this.relax );
            t = Math.sin( Math.PI * t - Math.PI * 0.5 ) * 0.5 + 0.5;
            this.finalOffset.multiplyScalar( t );
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
     */
    newGestureBML( bml, symmetry ){
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
        let direction = bml.direction;
        if ( direction && symmetry ){ direction = directionStringSymmetry( direction, symmetry ); }
        direction = directionTable[ direction ];
        if ( !direction ) {
            direction = directionTable['o'];
        }
        this.axis.copy(direction);

        // angle computations
        let startAngle = isNaN( bml.startAngle ) ? 0 : ( bml.startAngle  * Math.PI / 180.0 );
        let endAngle = isNaN( bml.endAngle ) ? ( Math.PI * 2 ) : ( bml.endAngle  * Math.PI / 180.0 );
        this.targetDeltaAngle = endAngle - startAngle;
        if( this.targetDeltaAngle >= 0 ){ // add extra angle for ease-in
            startAngle -= this.easingAngle;
            this.targetDeltaAngle += this.easingAngle;
        }else{
            startAngle += this.easingAngle;
            this.targetDeltaAngle -= this.easingAngle;
        }
        if( symmetry ){ // startAngle does not need to change. EndAngle is no longer used
            this.targetDeltaAngle *= -1;
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
            this.zigzagSize = 0.0; // metres
            this.zigzagSpeed = 0; // rps
        }else{
            this.zigzagDir.copy( zigzag );
            this.zigzagSize = isNaN( bml.zigzagSize ) ? 0.01 : bml.zigzagSize; // metres
            this.zigzagSpeed = isNaN( bml.zigzagSpeed ) ? 2 : bml.zigzagSpeed; // rps
        }

        // flag to start 
        this.transition = true;
    }
}



let fingerPlayTable = {
    index : new Quaternion ( 0.3056621,  0.0039430, -0.0053422, 0.9521169 ),
    middle: new Quaternion ( 0.3522030,  0.0105015, -0.0046960, 0.9358529 ),
    ring  : new Quaternion ( 0.2910635,  0.0143004,  0.0083483, 0.9565603 ),
    pinky : new Quaternion ( 0.2807940, -0.0096333,  0.0081887, 0.9596847 ),
}

class FingerPlay {
    constructor(){ 
        this.index = new Quaternion(0,0,0,1);
        this.middle = new Quaternion(0,0,0,1);
        this.ring = new Quaternion(0,0,0,1);
        this.pinky = new Quaternion(0,0,0,1);

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
        this.index.set(0,0,0,1);
        this.middle.set(0,0,0,1);
        this.ring.set(0,0,0,1);
        this.pinky.set(0,0,0,1);
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

        intensity *= this.intensity;

        // 2 t: entry T, interpolation t 
        // interpolatino -- cos(t + X) where is different for each finger
        if ( this.fingerEnabler & 0x02 ) { 
            this.index.identity();
            nlerpQuats( this.index, this.index, fingerPlayTable.index,    ( Math.cos( Math.PI * 2 * this.speed * this.time ) * 0.5 + 0.5 ) * intensity );
        }
        if ( this.fingerEnabler & 0x04 ) { 
            this.middle.identity();
            nlerpQuats( this.middle, this.middle, fingerPlayTable.middle, ( Math.cos( Math.PI * 2 * this.speed * this.time + Math.PI * 0.65 ) * 0.5 + 0.5 ) * intensity * 0.9);
        }
        if ( this.fingerEnabler & 0x08 ) { 
            this.ring.identity();
            nlerpQuats( this.ring, this.ring, fingerPlayTable.ring,       ( Math.cos( Math.PI * 2 * this.speed * this.time + Math.PI * 1.05 ) * 0.5 + 0.5 ) * intensity * 0.7 );
        }
        if ( this.fingerEnabler & 0x10 ) { 
            this.pinky.identity();
            nlerpQuats( this.pinky, this.pinky, fingerPlayTable.pinky,    ( Math.cos( Math.PI * 2 * this.speed * this.time + Math.PI * 1.35 ) * 0.5 + 0.5 ) * intensity * 0.5 );
        }
    }

     /**
     * bml info
     * start, attackPeak, relax, end
     * speed = (optional) oscillations per second. Default 3
     * intensity = (optional) [0,1]. Default 0.3
     * fingers = (optional) string with numbers. Each number present activates a finger. 1=index, 2=middle, 3=ring, 4=pinky. I.E. "123" activates index, middle, ring but not pinky. Default all enabled
     */
    newGestureBML( bml ){
        this.time = 0;
        
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;

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

    }

};



class WristMotion {
    constructor( wristBone ){
        this.wristBone = wristBone;
        
        // for the EVA model 
        this.nodAxis = new Vector3(1,0,0);
        this.swingAxis = new Vector3(0,1,0);
        this.twistAxis = new Vector3(0,0,1);

        this.mode = 0; // FLAGS 0=NONE, 1=TWIST, 2=NOD, 4=SWING 
        this.intensity = 1;
        this.speed = 1;
        this.tempQ = new Quaternion(0,0,0,1);

        this.time = 0;
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
    }

    reset(){
        this.time = 0;
        this.mode = 0;
    }

    update( dt ){
        if ( !this.mode ){ return; }

        this.time += dt;
        let intensity = 0;
        if ( this.time < this.start ){ intensity = 0; }
        else if ( this.time < this.attackPeak ){ intensity = ( this.time - this.start ) / ( this.attackPeak - this.start ); }
        else if ( this.time < this.relax ){ intensity = 1; }
        else if ( this.time < this.end ){ intensity = ( this.time - this.relax ) / ( this.end - this.relax ); intensity = 1.0-intensity; }
        else {
            intensity = 0; 
            this.mode = 0x00; // tansition = false
        }
        intensity *= this.intensity;

        if ( this.mode & 0x01 ){ // TWIST
            this.twistAxis.set(0,0,1);
            this.twistAxis.applyQuaternion( this.wristBone.quaternion );
            let angle = Math.cos( 2 * Math.PI * this.speed * this.time ) * intensity * ( Math.PI * 0.5 );
            this.tempQ.setFromAxisAngle( this.twistAxis, angle );
            this.wristBone.quaternion.premultiply( this.tempQ );
        }
        if ( this.mode & 0x02 ){ // NOD
            this.nodAxis.set(1,0,0);
            this.nodAxis.applyQuaternion( this.wristBone.quaternion );
            let angle = Math.cos( 2 * Math.PI * this.speed * this.time ) * intensity * ( Math.PI * 0.5 );
            this.tempQ.setFromAxisAngle( this.nodAxis, angle );
            this.wristBone.quaternion.premultiply( this.tempQ );
        }
        if ( this.mode & 0x04 ){ // SWING
            this.swingAxis.set(0,1,0);
            this.swingAxis.applyQuaternion( this.wristBone.quaternion );
            let angle = Math.sin( 2 * Math.PI * this.speed * this.time ) * intensity * ( Math.PI * 0.5 ); // PHASE of 90ª with respect to NOD (see newGestureBML)
            this.tempQ.setFromAxisAngle( this.swingAxis, angle );
            this.wristBone.quaternion.premultiply( this.tempQ );
        }

    }

     /**
     * bml info
     * start, attackPeak, relax, end
     * mode = either a: 
     *          - string from [ "nod", "swing", "twist", "stirCW", "stirCCW", "all" ]
     *          - or a value from [ 0 = None, 1 = twist, 2 = nod, swing = 4 ]. 
     *            Several values can co-occur by using the OR (|) operator. I.E. ( 2 | 4 ) = stirCW
     *            Several values can co-occur by summing the values. I.E. ( 2 + 4 ) = stirCW
     * speed = (optional) oscillations per second. A negative values accepted. Default 3. 
     * intensity = (optional) [0,1]. Default 0.3
     */
    newGestureBML( bml ){
        this.time = 0;
        
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;

        this.speed = isNaN( bml.speed ) ? 3 : bml.speed;
        this.intensity = isNaN( bml.intensity ) ? 0.3 : bml.intensity;
        this.intensity = Math.min( 1, Math.max( 0, this.intensity ) );

        if ( typeof( bml.mode ) == "string" ){
            switch( bml.mode ){
                case "nod": this.mode = 0x02; break;
                case "swing": this.mode = 0x04; break;
                case "twist": this.mode = 0x01; break;
                case "stirCW": this.mode = 0x06; break; // 0x02 | 0x04
                case "stirCCW": this.mode = 0x06; this.speed *= -1; break;
                case "all": this.mode = 0x07; break;
                default:
                    console.warn( "Gesture: No wrist motion called \"", bml.mode, "\" found" );
                    return;
            }
        }
        else if ( !isNaN( bml.mode ) ) {
            console.warn( "Gesture: No wrist motion called \"", bml.mode, "\" found" );
            return;
        }
        else{
            this.mode = bml.mode & 0x07; // take only the necessary bits
        }

    }
};

export { DirectedMotion, CircularMotion, FingerPlay, WristMotion }