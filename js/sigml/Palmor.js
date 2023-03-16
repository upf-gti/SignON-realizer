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
    constructor( skeleton ){
        this.skeleton = skeleton;
                
        // store TWIST quaternions for forearm and hand (visally better than just forearm)
        this.right = {
            idx: 0,
            defG: [ new Quaternion(), new Quaternion() ] ,
            srcG: [ new Quaternion(), new Quaternion() ] ,
            trgG: [ new Quaternion(), new Quaternion() ] ,
            curG: [ new Quaternion(), new Quaternion() ] ,
            t: 0, // current time of transition
            start: 0, 
            attackPeak: 0,
            relax: 0, 
            end: 0, 
            transition: false,
        };
        
        this.left = {
            idx: 0, 
            defG: [ new Quaternion(), new Quaternion() ] ,
            srcG: [ new Quaternion(), new Quaternion() ] ,
            trgG: [ new Quaternion(), new Quaternion() ] ,
            curG: [ new Quaternion(), new Quaternion() ] ,
            t: 0, // current time of transition
            start: 0, 
            attackPeak: 0,
            relax: 0, 
            end: 0, 
            transition: false,
        };        

        this.twistAxisForeArm = new Vector3();
        this.twistAxisWrist = new Vector3();

        this.tempQuat1 = new Quaternion();
        this.tempQuat2 = new Quaternion();
        

        // get twist axes
        let bones = this.skeleton.bones;
        for( let i = 0; i < bones.length; ++i ){
            if ( bones[i].name.includes("RightForeArm") ){ 
                this.right.idx = i; 
                this.twistAxisForeArm.copy( bones[ i + 1 ].position ).normalize();
            }
            else if ( bones[i].name.includes("LeftForeArm") ){ this.left.idx = i; }
            else if ( bones[i].name.includes("RightHandMiddle1") ){ 
                this.twistAxisWrist.copy( bones[ i ].position ).normalize();
            }
        }

        // set default pose
        this.reset();
    }

    reset() {
        // Force pose update to flat
        this.right.transition = false;
        this.left.transition = false;
        this.right.defG[0].set( 0,0,0,1 );
        this.right.defG[1].set( 0,0,0,1 );
        this.right.curG[0].set(0,0,0,1);
        this.right.curG[1].set(0,0,0,1);
        this.left.defG[0].set( 0,0,0,1 );
        this.left.defG[1].set( 0,0,0,1 );
        this.left.curG[0].set(0,0,0,1);
        this.left.curG[1].set(0,0,0,1);
    }

    update( dt ){
        this.updateHand( dt, this.right );
        this.updateHand( dt, this.left );
    }

    updateHand( dt, hand ) {
        if ( !hand.transition ){ return; } // no animation required
        
        hand.t += dt;
        
        // wait in same pose
        if ( hand.t < hand.start ){ return; }
        if ( hand.t > hand.attackPeak && hand.t < hand.relax ){ return; }
        
        if ( hand.t <= hand.attackPeak ){
            let t = ( hand.t - hand.start ) / ( hand.attackPeak - hand.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            nlerpQuats( hand.curG[0], hand.srcG[0], hand.trgG[0], t );
            nlerpQuats( hand.curG[1], hand.srcG[1], hand.trgG[1], t );
            
            return;
        }

        if ( hand.t >= hand.relax ){
            let t = ( hand.t - hand.relax ) / ( hand.end - hand.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            nlerpQuats( hand.curG[0], hand.trgG[0], hand.defG[0], t );
            nlerpQuats( hand.curG[1], hand.trgG[1], hand.defG[1], t );
        }
        
        if ( hand.t > hand.end ){ 
            hand.transition = false;
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
    newGestureBML( bml ){
        let handedness = E_HANDEDNESS.RIGHT; // default hand
        if ( bml.hand == "left" ){ handedness = E_HANDEDNESS.LEFT; }
        else if ( bml.hand == "both" ){ handedness = E_HANDEDNESS.BOTH; }

        if ( handedness & E_HANDEDNESS.RIGHT ) { this._newGestureHand( bml, this.right, false, false ); }
        if ( handedness & E_HANDEDNESS.LEFT ) { this._newGestureHand( bml, this.left, true, !!bml.sym ); }
    }

    _newGestureHand( bml, handInfo, mirror = false, symmetry = false ){
        if( !bml.palmor ){ return; }

        let rotationName = bml.palmor;
        if( mirror ^ symmetry ){
            if( rotationName[rotationName.length-1] == "l" ){ rotationName = rotationName.slice(0, rotationName.length-1) + "r" ;}
            else if( rotationName[rotationName.length-1] == "r" ){ rotationName = rotationName.slice(0, rotationName.length-1) + "l" ;}
        }
        let angle = rotationTable[ rotationName ];
        if( isNaN( angle ) ){ return; }
        
        // set source pose twist quaternions
        handInfo.srcG[0].copy( handInfo.curG[0] );
        handInfo.srcG[1].copy( handInfo.curG[1] );
        
        // set target pose (and mirror)
        handInfo.trgG[0].setFromAxisAngle( this.twistAxisForeArm, angle * 0.45 );
        handInfo.trgG[1].setFromAxisAngle( this.twistAxisWrist, angle * 0.55 );

        // mirror quaternions for the left. Original quaternions are for right hand
        if ( mirror ){
            mirrorQuat( handInfo.trgG[0], handInfo.trgG[0] );
            mirrorQuat( handInfo.trgG[1], handInfo.trgG[1] );
        }

        // set defualt pose if necessary
        if ( bml.shift ){
            handInfo.defG[0].copy( handInfo.trgG[0] );
            handInfo.defG[1].copy( handInfo.trgG[1] );
        }

        // check and set timings
        handInfo.start = bml.start || 0;
        handInfo.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        handInfo.attackPeak = bml.attackPeak || ( (handInfo.end - handInfo.start) * 0.25 + handInfo.start );
        handInfo.relax = bml.relax || ( (handInfo.end - handInfo.attackPeak) * 0.5 + handInfo.attackPeak );
        handInfo.transition = true;
        handInfo.t = 0; 
         
    }

}

export { Palmor };