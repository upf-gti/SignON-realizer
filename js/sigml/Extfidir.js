import { Matrix4, Quaternion, Vector3 } from "three";
import * as THREE from "three";
import { mirrorQuat, nlerpQuats, twistSwingQuats } from "./sigmlUtils.js";

let E_HANDEDNESS = { RIGHT: 1, LEFT: 2, BOTH: 3 };

let DEG2RAD = Math.PI / 180;


// convert rotation names into radiants. 'u' and 'ur' are extremes. By setting them to 160 and -135, the interpolation of quaternion choses the correct interpolation path. Otherwise it rotates on the wrong direction
let rotationTable = {
    'u'     : new Vector3(  0,   3,   0 ),   
    'ul'    : new Vector3(  1,   3,   0 ),   
    'l'     : new Vector3(  1,   2,   0 ),   
    'dl'    : new Vector3(  1,   1,   0 ),   
    'd'     : new Vector3(  0,   1,   0 ),   
    'dr'    : new Vector3( -1,   1,   0 ),  
    'r'     : new Vector3( -1,   2,   0 ),  
    'ur'    : new Vector3( -1,   3,   0 ),  

    "uo"    : new Vector3(  0,   3,   1 ),
    "uol"   : new Vector3(  1,   3,   1 ),
    "ol"    : new Vector3(  1,   2,   1 ),
    "dol"   : new Vector3(  1,   1,   1 ),
    "do"    : new Vector3(  0,   1,   1 ),
    "dor"   : new Vector3( -1,   1,   1 ),
    "or"    : new Vector3( -1,   2,   1 ),
    "uor"   : new Vector3( -1,   3,   1 ),
    "o"     : new Vector3(  0,   2,   1 ),
    
    "ui"    : new Vector3(  0,   3,   -1 ),
    "uil"   : new Vector3(  1,   3,   -1 ),
    "il"    : new Vector3(  1,   2,   -1 ),
    "dil"   : new Vector3(  1,   1,   -1 ),
    "di"    : new Vector3(  0,   1,   -1 ),
    "dir"   : new Vector3( -1,   1,   -1 ),
    "ir"    : new Vector3( -1,   2,   -1 ),
    "uir"   : new Vector3( -1,   3,   -1 ),
    "i"     : new Vector3(  0,   2,   -1 ),
}

// receives bml instructions and animates the wrists. Swing rotation only 
class Extfidir {
    constructor(character){
        this.skeleton = null;
                
        // store TWIST quaternions for forearm and hand (visally better than just forearm)
        this.right = {
            idx: 0,
            defPoint: null, // a vector3 from the rotation table. Used in update for lookup
            trgPoint: null, // a vector3 from the rotation table. Used in update for lookup
            // no defG : new Quaternion. Will reuse srcG and trgG during relax-end
            trgG: new Quaternion(),
            srcG: new Quaternion(),
            curG: new Quaternion(),
            t: 0, // current time of transition
            start: 0, 
            attackPeak: 0,
            relax: 0, 
            end: 0, 
            transition: false,
        };
        
        this.left = {
            idx: 0, 
            defPoint: null, // a vector3 from the rotation table. Used in update for lookup
            trgPoint: null,
            // no defG : new Quaternion. Will reuse srcG and trgG during relax-end
            trgG: new Quaternion(),
            srcG: new Quaternion(),
            curG: new Quaternion(),
            t: 0, // current time of transition
            start: 0, 
            attackPeak: 0,
            relax: 0, 
            end: 0, 
            transition: false,
        };        


        this.tempVec3 = new Vector3(); // swing function
        this.tempQuat1 = new Quaternion(); // swing function
        this.tempQuat2 = new Quaternion(); // swing function 
        this.tempMat4 = new Matrix4(); // swing function 
        
        // get skeleton reference
        if ( character.skeleton ){ this.skeleton = character.skeleotn; }
        else{ 
            this.skeleton = null;
            character.traverse( o => {
                if( o.isSkinnedMesh ){
                    this.skeleton = o.skeleton;
                }
            });
        }

        this.twistAxis = new Vector3();

        let bones = this.skeleton.bones;
        for( let i = 0; i < bones.length; ++i ){
            if ( bones[i].name.includes("RightForeArm") ){ this.right.idx = i + 1; } // RightHand is also used by fingers. To avoid many ifs, just pick the next bone after the forearm 
            else if ( bones[i].name.includes("LeftForeArm") ){ this.left.idx = i + 1; }
            else if( bones[i].name.includes("RightHandMiddle1") ){ this.twistAxis.copy( bones[ i ].position ).normalize(); }
        }

        // DEBUG render rotation table as spheres
        // for ( let e in rotationTable ){
        //     let color = ( ( Math.max( 0, Math.min( 1, 0.5*(rotationTable[ e ].z + 1) ) ) * 0xff ) & 0xff ) | 0xffff00;
        //     let k = new THREE.Mesh( new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshPhongMaterial({ color: color , depthWrite: true }) );
        //     k.position.copy( rotationTable[ e ] );
        //     window.global.app.scene.add( k ); 
        // }

        // set default pose
        this.reset();
    }

    reset() {
        // Force pose update to flat
        this.right.transition = false;
        this.left.transition = false;
        this.right.defG = null;
        this.right.curG.set( 0,0,0,1 );
        this.left.defG = null;
        this.left.curG.set( 0,0,0,1 );
    }

    _computeSwingFromCurrentPose( targetPoint, wristIdx, resultSwingQuat ){
        let wristBone = this.skeleton.bones[ wristIdx ];
        wristBone.updateWorldMatrix( true, true );
        this.tempMat4.copy( wristBone.matrixWorld );
        this.tempMat4.invert();
        
        let localPoint = this.tempVec3;
        localPoint.copy( targetPoint );
        localPoint.applyMatrix4( this.tempMat4 );
        localPoint.normalize();

        let angle = this.twistAxis.angleTo( localPoint );

        let rotAx = this.tempVec3;
        rotAx.crossVectors( this.twistAxis, localPoint ); // localPoint & rotAx are this.tempVec3
        rotAx.normalize();
        
        this.tempQuat1.setFromAxisAngle( rotAx, angle ); // delta rotation for this frame
        this.tempQuat1.premultiply( wristBone.quaternion ); // target rotation
        
        twistSwingQuats( this.tempQuat1, this.twistAxis, this.tempQuat2, resultSwingQuat ); // take only swing
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
        if ( hand.t > hand.attackPeak && hand.t < hand.relax ){ 
            // only if absolute position.
            this._computeSwingFromCurrentPose( hand.trgPoint, hand.idx, hand.trgG ); // trgG update needed for relax-end
            hand.curG.copy( hand.trgG ); 
            return; 
        }
        
        if ( hand.t <= hand.attackPeak ){
            let t = ( hand.t - hand.start ) / ( hand.attackPeak - hand.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            this._computeSwingFromCurrentPose( hand.trgPoint, hand.idx, hand.trgG ); // only if absolute position
            hand.curG.slerpQuaternions( hand.srcG, hand.trgG, t );
            
            return;
        }

        if ( hand.t >= hand.relax ){
            let t = ( hand.t - hand.relax ) / ( hand.end - hand.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            
            if ( hand.defPoint ){
                this._computeSwingFromCurrentPose( hand.defPoint, hand.idx, hand.srcG ); // only if absolute position
            } else{
                hand.srcG.set( 0,0,0,1 );
            }
            nlerpQuats( hand.curG, hand.trgG, hand.srcG, t ); // reusing srcG as defG

        }
        
        if ( hand.t > hand.end ){ 
            if ( hand.defPoint ){ // indefinitely update curG to keep pointing at the correct target
                this._computeSwingFromCurrentPose( hand.defPoint, hand.idx, hand.curG ); // only if absolute position
            }else{
                hand.transition = false;
            }
        }

    }

    newGestureBML( bml ){
        let handedness = E_HANDEDNESS.RIGHT; // default hand
        if ( bml.hand == "left" ){ handedness = E_HANDEDNESS.LEFT; }
        else if ( bml.hand == "both" ){ handedness = E_HANDEDNESS.BOTH; }

        if ( handedness & E_HANDEDNESS.RIGHT ) { this.newGestureHand( bml, this.right ); }
        if ( handedness & E_HANDEDNESS.LEFT ) { this.newGestureHand( bml, this.left ); }
    }

    // usual bml attributes + extfidirNeutral to stop shift
    newGestureHand( bml, handInfo ){
        if( !bml.extfidir ){ return; }
      
        // undo default pointing. Since it is a constant lookat, there must be a specific attribute to stop
        if ( bml.extfidirNeutral ){ handInfo.defPoint = null; }

        let point = rotationTable[ bml.extfidir ];
        if( !point ){ 
            console.warn( "Gesture: Extfidir incorrect direction \"" + bml.extfidir + "\"" );
            return; 
        }
        
        // set source pose swing quaternions
        handInfo.srcG.copy( handInfo.curG );

        handInfo.trgPoint = point;
        
        // set defualt point if necessary
        if ( bml.shift ){
            handInfo.defPoint = point;
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

export { Extfidir, rotationTable };