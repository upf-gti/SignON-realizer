import * as THREE from "three";
import { stringToDirection } from "./SigmlUtils.js";

// receives bml instructions and animates the hands
class Palmor {
    constructor( config, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.isLeftHand = !!isLeftHand;
        
        let boneMap = config.boneMap;
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
    }

    update( dt ) {
        if ( !this.transition ){ return; } // no animation required
        
        this.time += dt;
        // wait in same pose
        if ( this.time < this.start ){ return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ 
            this.curAngle = this.trgAngle;
            return; 
        }
        
        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1 ){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            this.curAngle = this.srcAngle * ( 1 - t ) + this.trgAngle * t;
            return;
        }

        if ( this.time >= this.relax ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1 ){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            this.curAngle = this.trgAngle * ( 1 - t ) + this.defAngle * t;
        }
        
        if ( this.time > this.end ){ 
            this.transition = false;
        }

    }


    /**
     * bml info
     * start, attackPeak, relax, end
     * palmor: string from palmorRightTable
     * secondPalmor: (optional)
     */
    newGestureBML( bml, symmetry = 0x00 ){
        if( !bml.palmor ){ return; }

        // TODO (?): solve atan2(0,-0) == up    
        let result = new THREE.Vector3();
        if ( !stringToDirection( bml.palmor, result, symmetry, true ) ){ return; }
        let angle = Math.atan2( result.x, -result.y ); // -y so down is angle=0º
        
        if ( stringToDirection( bml.secondPalmor, result, symmetry, true ) ){ 
            let secondAngle = Math.atan2( result.x, -result.y ); // -y so down is angle=0º
            // find shortest path between angle and secondAngle. 
            // TODO (?): simply interpolate result vectors instead of angles to avoid this if
            if( Math.abs( angle - secondAngle ) > Math.PI ){
                if( ( angle - secondAngle ) < 0 ){ secondAngle -= 2 * Math.PI; }
                else{ secondAngle += 2 * Math.PI; }
            }
            angle = ( angle + secondAngle ) * 0.5
        }
        if ( !this.isLeftHand && angle < -140 * Math.PI/180 ){ angle += Math.PI *2; }
        else if ( this.isLeftHand && angle > 140 * Math.PI/180 ){ angle -= Math.PI *2; }
        
        // set source pose twist quaternions
        this.srcAngle = this.curAngle; 

        // set target pose
        this.trgAngle = angle;

        // set defualt pose if necessary
        if ( bml.shift ){
            this.defAngle = this.trgAngle;
        }

        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0; 
        
        this.transition = true;
    }

}


export { Palmor };