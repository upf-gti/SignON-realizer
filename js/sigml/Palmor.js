import { Quaternion, Vector3 } from "three";
import { mirrorQuat, nlerpQuats } from "./sigmlUtils.js";

let E_HANDEDNESS = { RIGHT: 1, LEFT: 2, BOTH: 3 };

let DEG2RAD = Math.PI / 180;

// convert rotation names into radiants. 'u' and 'ur' are extremes. By setting them to 160 and -135, the interpolation of quaternion choses the correct interpolation path. Otherwise it rotates on the wrong direction
let rotationTable = {
    'u' : 160 * DEG2RAD, 
    'ul': 135 * DEG2RAD,
    'l' : 90 * DEG2RAD,
    'dl' : 45 * DEG2RAD,
    'd' : 0 * DEG2RAD,
    'dr' : -45 * DEG2RAD,
    'r' : -90 * DEG2RAD,
    'ur' : -135 * DEG2RAD,
}

// receives bml instructions and animates the hands
class Palmor {
    constructor( boneMap, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.mirror = !!isLeftHand;
        
        let handName = ( isLeftHand ) ? "L" : "R";
        let bones = this.skeleton.bones;
        this.idx = boneMap[ handName + "Elbow" ]; // elbow (forearm) joint index. 
        this.twistAxisForeArm = ( new Vector3() ).copy( bones[ boneMap[ handName + "Wrist"] ].position ).normalize();
        this.twistAxisWrist =  ( new Vector3() ).copy( bones[ boneMap[ handName + "HandMiddle"] ].position ).normalize();

                
        // store TWIST quaternions for forearm and hand (visally better than just forearm or wrist)
        this.defG = [ new Quaternion(), new Quaternion() ];
        this.trgG = [ new Quaternion(), new Quaternion() ];
        this.srcG = [ new Quaternion(), new Quaternion() ];
        this.curG = [ new Quaternion(), new Quaternion() ];

        this.time = 0; // current time of transition
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0; 
        this.end = 0;
        this.transition = false;
        

        this.tempQuat1 = new Quaternion();
        this.tempQuat2 = new Quaternion();
        
        // set default pose
        this.reset();
    }

    reset() {
        // Force pose update to flat
        this.transition = false;
        this.defG[0].set( 0,0,0,1 );
        this.defG[1].set( 0,0,0,1 );
        this.curG[0].set(0,0,0,1);
        this.curG[1].set(0,0,0,1);
    }

    update( dt ) {
        if ( !this.transition ){ return; } // no animation required
        
        this.time += dt;
        
        // wait in same pose
        if ( this.time < this.start ){ return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ return; }
        
        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            nlerpQuats( this.curG[0], this.srcG[0], this.trgG[0], t );
            nlerpQuats( this.curG[1], this.srcG[1], this.trgG[1], t );
            
            return;
        }

        if ( this.time >= this.relax ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            nlerpQuats( this.curG[0], this.trgG[0], this.defG[0], t );
            nlerpQuats( this.curG[1], this.trgG[1], this.defG[1], t );
        }
        
        if ( this.time > this.end ){ 
            this.transition = false;
        }

    }


    /**
     * bml info
     * start, attackPeak, relax, end
     * palmor: string from rotationTable
     * sym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
     * hand: (optional) "right", "left", "both". Default right
     * shift: (optional) bool - make this the default position
     */
    newGestureBML( bml, symmetry = false ){
        if( !bml.palmor ){ return; }

        let rotationName = bml.palmor;
        if( this.mirror ^ symmetry ){
            if( rotationName[rotationName.length-1] == "l" ){ rotationName = rotationName.slice(0, rotationName.length-1) + "r" ;}
            else if( rotationName[rotationName.length-1] == "r" ){ rotationName = rotationName.slice(0, rotationName.length-1) + "l" ;}
        }
        let angle = rotationTable[ rotationName ];
        if( isNaN( angle ) ){ return; }
        
        // set source pose twist quaternions
        this.srcG[0].copy( this.curG[0] );
        this.srcG[1].copy( this.curG[1] );
        
        // set target pose (and mirror)
        this.trgG[0].setFromAxisAngle( this.twistAxisForeArm, angle * 0.45 );
        this.trgG[1].setFromAxisAngle( this.twistAxisWrist, angle * 0.55 );

        // mirror quaternions for the left. Original quaternions are for right hand
        if ( this.mirror ){
            mirrorQuat( this.trgG[0], this.trgG[0] );
            mirrorQuat( this.trgG[1], this.trgG[1] );
        }

        // set defualt pose if necessary
        if ( bml.shift ){
            this.defG[0].copy( this.trgG[0] );
            this.defG[1].copy( this.trgG[1] );
        }

        // check and set timings
        this.start = bml.start || 0;
        this.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        this.attackPeak = bml.attackPeak || ( (this.end - this.start) * 0.25 + this.start );
        this.relax = bml.relax || ( (this.end - this.attackPeak) * 0.5 + this.attackPeak );
        this.transition = true;
        this.time = 0; 
         
    }

}


export { Palmor };