import { Matrix4, Quaternion, Vector3 } from "three";
import * as THREE from "three";
import { mirrorQuat, nlerpQuats, twistSwingQuats } from "./sigmlUtils.js";

let E_HANDEDNESS = { RIGHT: 1, LEFT: 2, BOTH: 3 };

let DEG2RAD = Math.PI / 180;


// convert rotation names into radiants. 'u' and 'ur' are extremes. By setting them to 160 and -135, the interpolation of quaternion choses the correct interpolation path. Otherwise it rotates on the wrong direction
let rotationTable = {
    'u'     : new Vector3(  0,   2,   0 ),   
    'ul'    : new Vector3(  1,   2,   0 ),   
    'l'     : new Vector3(  1,   1,   0 ),   
    'dl'    : new Vector3(  1,   0,   0 ),   
    'd'     : new Vector3(  0,   0,   0 ),   
    'dr'    : new Vector3( -1,   0,   0 ),  
    'r'     : new Vector3( -1,   1,   0 ),  
    'ur'    : new Vector3( -1,   2,   0 ),  

    "uo"    : new Vector3(  0,   2,   1 ),
    "uol"   : new Vector3(  1,   2,   1 ),
    "ol"    : new Vector3(  1,   1,   1 ),
    "dol"   : new Vector3(  1,   0,   1 ),
    "do"    : new Vector3(  0,   0,   1 ),
    "dor"   : new Vector3( -1,   0,   1 ),
    "or"    : new Vector3( -1,   1,   1 ),
    "uor"   : new Vector3( -1,   2,   1 ),
    "o"     : new Vector3(  0,   1,   1 ),
    
    "ui"    : new Vector3(  0,   2,   -1 ),
    "uil"   : new Vector3(  1,   2,   -1 ),
    "il"    : new Vector3(  1,   1,   -1 ),
    "dil"   : new Vector3(  1,   0,   -1 ),
    "di"    : new Vector3(  0,   0,   -1 ),
    "dir"   : new Vector3( -1,   0,   -1 ),
    "ir"    : new Vector3( -1,   1,   -1 ),
    "uir"   : new Vector3( -1,   2,   -1 ),
    "i"     : new Vector3(  0,   1,   -1 ),
}

let EXTFIDIR_MODES = {
    ABSOLUTE : 1,
    RELATIVE : 2,
    LOCAL : 3
}
// receives bml instructions and animates the wrists. Swing rotation only 
class Extfidir {
    constructor( skeleton ){
        this.skeleton = skeleton;

        // store TWIST quaternions for forearm and hand (visally better than just forearm)
        this.right = {
            idx: 0,
            defActive: false, // whether to default to a point or not
            defmode: EXTFIDIR_MODES.RELATIVE, // is default positioning absolute, relative or local 
            defPoint: new Vector3(),
            trgPoint: new Vector3(), 
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

            mode: EXTFIDIR_MODES.RELATIVE,
        };
        
        this.left = {
            idx: 0, 
            defActive: false, // whether to default to a point or not
            defmode: EXTFIDIR_MODES.RELATIVE, // is default positioning absolute, relative or local 
            defPoint: new Vector3(),
            trgPoint: new Vector3(),
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

            mode: EXTFIDIR_MODES.RELATIVE,
        };        


        this.tempVec3 = new Vector3(); // swing function
        this.tempQuat1 = new Quaternion(); // swing function
        this.tempQuat2 = new Quaternion(); // swing function 
        this.tempMat4 = new Matrix4(); // swing function 
        
        this.twistAxis = new Vector3();

        let bones = this.skeleton.bones;
        for( let i = 0; i < bones.length; ++i ){
            if ( bones[i].name.includes("RightForeArm") ){ this.right.idx = i + 1; } // RightHand is also used by fingers. To avoid many ifs, just pick the next bone after the forearm 
            else if ( bones[i].name.includes("LeftForeArm") ){ this.left.idx = i + 1; }
            else if( bones[i].name.includes("RightHandMiddle1") ){ this.twistAxis.copy( bones[ i ].position ).normalize(); }
        }

        // DEBUG render rotation table as spheres
        // if ( !window.checks ){
        //     this.debugPoints = [];
        //     for ( let e in rotationTable ){
        //         let color = ( ( Math.max( 0, Math.min( 1, 0.5*(rotationTable[ e ].z + 1) ) ) * 0xff ) & 0xff ) | 0xffff00;
        //         let k = new THREE.Mesh( new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshPhongMaterial({ color: color , depthWrite: true }) );
        //         k.position.copy( rotationTable[ e ] );
        //         k.name = e;
        //         window.global.app.scene.add( k );
        //         this.debugPoints.push( k ); 
        //     }
        //     window.checks = true;
        // }
        // set default pose
        this.reset();

    }

    // _debug_pointsUpdate( x,y,z, worldMat = null ){
    //     for ( let i = 0; i < this.debugPoints.length; ++i ){
    //         this.debugPoints[i].position.copy( rotationTable[ this.debugPoints[i].name ] );
    //         this.debugPoints[i].position.x += x;
    //         this.debugPoints[i].position.y += y;
    //         this.debugPoints[i].position.z += z;
    //         if ( worldMat ){
    //              this.debugPoints[i].position.applyMatrix4( worldMat );
    //         } 
    //     }
    // }

    reset() {
        // Force pose update to flat
        this.right.transition = false;
        this.left.transition = false;
        this.right.defActive = false;
        this.left.defActive = false;
        this.right.curG.set( 0,0,0,1 );
        this.left.curG.set( 0,0,0,1 );
    }

    // compute the swing rotation to get the twistAxis to point at a certain location
    _computeSwingFromCurrentPose( targetPoint, wristIdx, resultSwingQuat, mode = EXTFIDIR_MODES.RELATIVE ){
        let wristBone = this.skeleton.bones[ wristIdx ];
        wristBone.updateWorldMatrix( true, true );
        this.tempMat4.copy( wristBone.matrixWorld );
        this.tempMat4.invert();
        
        // compute targetPoint into local wrist coordinates
        let localPoint = this.tempVec3;
        if ( mode == EXTFIDIR_MODES.RELATIVE ){ // center rotation points on wrist (no rotation involved)
            localPoint.setFromMatrixPosition( wristBone.matrixWorld );
            // this._debug_pointsUpdate( localPoint.x, localPoint.y - rotationTable['o'].y, localPoint.z );
            localPoint.add( targetPoint );
            localPoint.applyMatrix4( this.tempMat4 );
        } 
        else if ( mode == EXTFIDIR_MODES.ABSOLUTE ) { // center rotation points to 0,0,0
            // this._debug_pointsUpdate( 0,0,0 );
            localPoint.copy( targetPoint );
            localPoint.applyMatrix4( this.tempMat4 );
        }
        else{ // EXTFIDIR_MODES.LOCAL
            // this._debug_pointsUpdate( 0,0,0, wristBone.matrixWorld );
            localPoint.copy( targetPoint );    
        }
        localPoint.normalize();

        // compute rotation
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
            this._computeSwingFromCurrentPose( hand.trgPoint, hand.idx, hand.trgG, hand.mode ); // trgG update needed for relax-end
            hand.curG.copy( hand.trgG );
            return; 
        }
        
        if ( hand.t <= hand.attackPeak ){
            let t = ( hand.t - hand.start ) / ( hand.attackPeak - hand.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            this._computeSwingFromCurrentPose( hand.trgPoint, hand.idx, hand.trgG, hand.mode );
            hand.curG.slerpQuaternions( hand.srcG, hand.trgG, t );
            
            return;
        }

        if ( hand.t >= hand.relax ){
            let t = ( hand.t - hand.relax ) / ( hand.end - hand.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            if ( hand.defActive ){
                this._computeSwingFromCurrentPose( hand.defPoint, hand.idx, hand.srcG, hand.defmode ); 
            } else{
                hand.srcG.set( 0,0,0,1 );
            }
            hand.curG.slerpQuaternions( hand.trgG, hand.srcG, t ); // reusing srcG as defG
        }
        
        if ( hand.t > hand.end ){ 
            if ( hand.defActive ){ // indefinitely update curG to keep pointing at the correct target
                this._computeSwingFromCurrentPose( hand.defPoint, hand.idx, hand.curG, hand.defmode );
            }else{
                hand.transition = false;
            }
        }

    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * extfidir: string from rotationTable
     * secondExtfidir: (optional) string from rotationTable. Will compute midpoint between extifidir and secondExtfidir
     * extfidirNeutral: (optional) bool - stop current default pointing
     * mode: (optional) number - whether the pointing is to absolute (1), relative (2) or local (3) positions to the wrist  
     * sym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
     * hand: (optional) "right", "left", "both". Default right
     * shift: (optional) bool - make this the default position
     */
    newGestureBML( bml ){
        let handedness = E_HANDEDNESS.RIGHT; // default hand
        if ( bml.hand == "left" ){ handedness = E_HANDEDNESS.LEFT; }
        else if ( bml.hand == "both" ){ handedness = E_HANDEDNESS.BOTH; }

        if ( handedness & E_HANDEDNESS.RIGHT ) { this._newGestureHand( bml, this.right, false ); }
        if ( handedness & E_HANDEDNESS.LEFT ) { this._newGestureHand( bml, this.left, !!bml.sym ); }
    }

    // usual bml attributes + extfidirNeutral to stop shift
    _newGestureHand( bml, handInfo, symmetry = false ){
        if( !bml.extfidir ){ return; }
      
        // undo default pointing. Since it is a constant lookat, there must be a specific attribute to stop
        if ( bml.extfidirNeutral ){ handInfo.defActive = false; }

        let extfidir = bml.extfidir;
        let secondExtfidir = bml.secondExtfidir;

        if ( extfidir && symmetry ){
            if ( extfidir[ extfidir.length - 1 ] == "r" ){ extfidir = extfidir.slice( 0, extfidir.length - 1 ) + "l"; }
            else if ( extfidir[ extfidir.length - 1 ] == "l" ){ extfidir = extfidir.slice( 0, extfidir.length - 1 ) + "r"; }
        }
        if ( secondExtfidir && symmetry ){
            if ( secondExtfidir[ secondExtfidir.length - 1 ] == "r" ){ secondExtfidir = secondExtfidir.slice( 0, secondExtfidir.length - 1 ) + "l"; }
            else if ( secondExtfidir[ secondExtfidir.length - 1 ] == "l" ){ secondExtfidir = secondExtfidir.slice( 0, secondExtfidir.length - 1 ) + "r"; }
        }

        let point = rotationTable[ extfidir ];
        if( !point ){ 
            console.warn( "Gesture: Extfidir incorrect direction \"" + extfidir + "\"" );
            return; 
        }

        let secondPoint = rotationTable[ secondExtfidir ];
        if( !secondPoint ){ 
            secondPoint = point; 
        }

        // set source pose swing quaternions
        handInfo.srcG.copy( handInfo.curG );

        // compute midpoint between primary and secondary extfidir
        handInfo.trgPoint.addVectors( point, secondPoint );
        handInfo.trgPoint.multiplyScalar( 0.5 );
        
        // absolute positioning (tables) is at 1 meter. Relative & Local should be centered at the wrist
        if( bml.mode != EXTFIDIR_MODES.ABSOLUTE ){ 
            handInfo.trgPoint.y -= rotationTable['o'].y; 
        }
        handInfo.mode = bml.mode;

        // set defualt point if necessary
        if( bml.shift ){
            handInfo.defPoint.copy( handInfo.trgPoint );
            handInfo.defmode = handInfo.mode;
            handInfo.defActive = true;
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