import { Quaternion, Vector3 } from "three";
import { directionStringSymmetry, mirrorQuat, nlerpQuats } from "./sigmlUtils.js";

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
let leftRotationTable = {
    'l' : 90 * DEG2RAD,
    'dl' : 45 * DEG2RAD,
    'd' : 0 * DEG2RAD,
    'dr' : -45 * DEG2RAD,
    'r' : -90 * DEG2RAD,
    'ur' : -135 * DEG2RAD,
    'u' : -160 * DEG2RAD, 
    'ul': -195 * DEG2RAD,
}

// receives bml instructions and animates the hands
class Palmor {
    constructor( boneMap, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.mirror = !!isLeftHand;
        
        let handName = ( isLeftHand ) ? "L" : "R";
        let bones = this.skeleton.bones;
        this.idx = boneMap[ handName + "Elbow" ]; // elbow (forearm) joint index. 

        // handName = "R";
        this.twistAxisForeArm = ( new Vector3() ).copy( bones[ boneMap[ handName + "Wrist"] ].position ).normalize(); // position is already local to ForeArm bone
        this.twistAxisWrist =  ( new Vector3() ).copy( bones[ boneMap[ handName + "HandMiddle"] ].position ).normalize(); // position is already local to Wrist bone

                
        // store TWIST quaternions for forearm and hand (visally better than just forearm or wrist)
        this.defAngle = 0;
        this.trgAngle = 0;
        this.srcAngle = 0;
        this.curAngle = 0;
        this.curG = [ new Quaternion(), new Quaternion() ];

        this.time = 0; // current time of transition
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0; 
        this.end = 0;
        this.transition = false;
        
        // set default pose
        this.reset();
    }

    reset() {
        // Force pose update to flat
        this.transition = false;
        this.defAngle = 0;
        this.curAngle = 0;
        this.curG[0].set(0,0,0,1);
        this.curG[1].set(0,0,0,1);
    }

    update( dt ) {
        if ( !this.transition ){ return; } // no animation required
        
        this.time += dt;
        
        let foreArmRatio = 0.45;
        let wristRatio = 0.55;

        // wait in same pose
        if ( this.time < this.start ){ return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ 
            this.curAngle = this.trgAngle;
            this.curG[0].setFromAxisAngle( this.twistAxisForeArm, this.trgAngle * foreArmRatio );
            this.curG[1].setFromAxisAngle( this.twistAxisForeArm, this.trgAngle * wristRatio );
            return; 
        }
        
        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1 ){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            let angle = this.srcAngle * ( 1 - t ) + this.trgAngle * t;
            this.curAngle = angle;
            this.curG[0].setFromAxisAngle( this.twistAxisForeArm, angle * foreArmRatio );
            this.curG[1].setFromAxisAngle( this.twistAxisForeArm, angle * wristRatio );
            
            return;
        }

        if ( this.time >= this.relax ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1 ){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            let angle = this.trgAngle * ( 1 - t ) + this.defAngle * t;
            this.curAngle = angle;
            this.curG[0].setFromAxisAngle( this.twistAxisForeArm, angle * foreArmRatio );
            this.curG[1].setFromAxisAngle( this.twistAxisForeArm, angle * wristRatio );
        }
        
        if ( this.time > this.end ){ 
            this.transition = false;
        }

    }


    /**
     * bml info
     * start, attackPeak, relax, end
     * palmor: string from rotationTable
     */
    newGestureBML( bml, symmetry = false ){
        if( !bml.palmor ){ return; }

        let rotationName = bml.palmor;
        if ( symmetry ){ rotationName = directionStringSymmetry( rotationName, symmetry ); }
        let angle = ( this.mirror ) ? leftRotationTable[ rotationName ] : rotationTable[ rotationName ];
        if( isNaN( angle ) ){ return; }
        
        // set source pose twist quaternions
        this.srcAngle = this.curAngle; 

        // set target pose
        this.trgAngle = angle;

        // set defualt pose if necessary
        if ( bml.shift ){
            this.defAngle = this.trgAngle;
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