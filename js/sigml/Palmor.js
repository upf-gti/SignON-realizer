import * as THREE from "three";
import { directionStringSymmetry, mirrorQuat, nlerpQuats } from "./SigmlUtils.js";

// convert rotation names into radiants. 'u' and 'ur' are extremes. By setting them to 160 and -135, the interpolation of quaternion choses the correct interpolation path. Otherwise it rotates on the wrong direction
let palmorRightTable = {
    'u' : 160 * Math.PI / 180, 
    'ul': 135 * Math.PI / 180,
    'l' : 90 * Math.PI / 180,
    'dl': 45 * Math.PI / 180,
    'd' : 0 * Math.PI / 180,
    'dr': -45 * Math.PI / 180,
    'r' : -90 * Math.PI / 180,
    'ur': -135 * Math.PI / 180,
}
let palmorLeftTable = {
    'l' : 90 * Math.PI / 180,
    'dl': 45 * Math.PI / 180,
    'd' : 0 * Math.PI / 180,
    'dr': -45 * Math.PI / 180,
    'r' : -90 * Math.PI / 180,
    'ur': -135 * Math.PI / 180,
    'u' : -160 * Math.PI / 180, 
    'ul': -195 * Math.PI / 180,
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
        this.twistAxisForeArm = ( new THREE.Vector3() ).copy( bones[ boneMap[ handName + "Wrist"] ].position ).normalize(); // position is already local to ForeArm bone
        this.twistAxisWrist =  ( new THREE.Vector3() ).copy( bones[ boneMap[ handName + "HandMiddle"] ].position ).normalize(); // position is already local to Wrist bone

                
        // store TWIST quaternions for forearm and hand (visally better than just forearm or wrist)
        this.defAngle = 0;
        this.trgAngle = 0;
        this.srcAngle = 0;
        this.curAngle = 0;
        this.curG = [ new THREE.Quaternion(), new THREE.Quaternion() ];

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
     * palmor: string from palmorRightTable
     */
    newGestureBML( bml, symmetry = 0x00 ){
        if( !bml.palmor ){ return; }

        let rotationName = bml.palmor;
        let secondRotName = bml.secondPalmor;
        if ( rotationName && symmetry ){ rotationName = directionStringSymmetry( rotationName, symmetry ); }
        if ( secondRotName && symmetry ){ secondRotName = directionStringSymmetry( secondRotName, symmetry ); }
        
        let angle = ( this.mirror ) ? palmorLeftTable[ rotationName ] : palmorRightTable[ rotationName ];
        if( isNaN( angle ) ){ return; }
        let secondAngle = ( this.mirror ) ? palmorLeftTable[ secondRotName ] : palmorRightTable[ secondRotName ];
        if( !isNaN( secondAngle ) ){ 
            // find shortest path in the circle and adjust secondAngle
            if( Math.abs(angle - secondAngle) > Math.PI ){
                if( ( angle - secondAngle ) < 0 ){ secondAngle -= 2 * Math.PI; }
                else{ secondAngle += 2 * Math.PI; }
            }
            // avoid impossible angles
            if( this.mirror ){ secondAngle = Math.max( palmorLeftTable['ul'], Math.min( palmorRightTable['l'], secondAngle ) ); }
            else{ secondAngle = Math.max( palmorLeftTable['ur'], Math.min( palmorRightTable['u'], secondAngle ) ); }

            angle = 0.5 * angle + 0.5 * secondAngle; 
        }
        
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
        this.time = 0; 
        
        this.transition = true;
    }

}


export { Palmor };