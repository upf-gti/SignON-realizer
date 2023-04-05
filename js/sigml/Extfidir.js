import { Matrix4, Quaternion, Vector3 } from "three";
import * as THREE from "three";
import { directionStringSymmetry, mirrorQuat, nlerpQuats, twistSwingQuats } from "./sigmlUtils.js";

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
    1 : 1,
    ABSOLUTE : 1,
    absolute : 1,
    A: 1,

    2 : 2,
    RELATIVE : 2,
    relative : 2,
    R: 2,

    3 : 3,
    LOCAL : 3,
    local : 3,
    L: 3,
}

// receives bml instructions and animates the wrists. Swing rotation only 
class Extfidir {
    constructor( boneMap, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.mirror = !!isLeftHand;

        let handName = ( isLeftHand ) ? "L" : "R";
        let bones = this.skeleton.bones;
        this.idx = boneMap[ handName + "Wrist" ]; // wrist index
        this.twistAxis = ( new Vector3() ).copy( bones[ boneMap[ handName + "HandMiddle" ] ].position ).normalize();

        this.defmode = EXTFIDIR_MODES.LOCAL; // is default positioning absolute, relative or local 
        this.defPoint = new Vector3();
        this.trgPoint = new Vector3(); 
        // no defG  = new Quaternion. Will reuse srcG and trgG during relax-end
        this.trgG = new Quaternion();
        this.srcG = new Quaternion();
        this.curG = new Quaternion();
        
        this.time = 0; // current time of transition
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0; 
        this.end = 0;
        this.transition = false;

        this.mode = EXTFIDIR_MODES.RELATIVE;

        this.tempVec3 = new Vector3(); // swing function
        this.tempQuat1 = new Quaternion(); // swing function
        this.tempQuat2 = new Quaternion(); // swing function 
        this.tempMat4 = new Matrix4(); // swing function 
        
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
        this.transition = false;
        this.defPoint.copy( rotationTable[ 'o' ] );
        this.defmode = EXTFIDIR_MODES.LOCAL;
        this.curG.copy( rotationTable[ 'o' ] );
    }

    // compute the swing rotation to get the twistAxis to point at a certain location
    _computeSwingFromCurrentPose( targetPoint, wristIdx, resultSwingQuat, mode ){
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

    update( dt ) {
        if ( !this.transition ){ return; } // no animation required
        
        this.time += dt;
        
        // wait in same pose
        if ( this.time < this.start ){ return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ 
            this._computeSwingFromCurrentPose( this.trgPoint, this.idx, this.trgG, this.mode ); // trgG update needed for relax-end
            this.curG.copy( this.trgG );
            return; 
        }
        
        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            this._computeSwingFromCurrentPose( this.trgPoint, this.idx, this.trgG, this.mode );
            this.curG.slerpQuaternions( this.srcG, this.trgG, t );
            return;
        }

        if ( this.time < this.end ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            this._computeSwingFromCurrentPose( this.defPoint, this.idx, this.srcG, this.defmode ); 
            this.curG.slerpQuaternions( this.trgG, this.srcG, t ); // reusing srcG as defG
            return;
        }
        
        // local extfidir does not require constant update
        if ( this.time >= this.end ){ 
            this._computeSwingFromCurrentPose( this.defPoint, this.idx, this.curG, this.defmode );
            if( this.defmode == EXTFIDIR_MODES.LOCAL ){ 
                this.transition = false; 
            } 
        }

    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * extfidir: string from rotationTable
     * secondExtfidir: (optional) string from rotationTable. Will compute midpoint between extifidir and secondExtfidir
     * mode: (optional) number or string - whether the pointing is to "absolute" (1), "relative" (2) or "local" (3) positions to the wrist  
     */
    newGestureBML( bml, symmetry = false ){
        if( !bml.extfidir ){ return; }
      
        let extfidir = bml.extfidir;
        let secondExtfidir = bml.secondExtfidir;

        if ( extfidir && symmetry ){ extfidir = directionStringSymmetry( extfidir, symmetry ); }
        if ( secondExtfidir && symmetry ){ secondExtfidir = directionStringSymmetry( secondExtfidir, symmetry ); }

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
        this.srcG.copy( this.curG );

        // compute midpoint between primary and secondary extfidir
        this.trgPoint.addVectors( point, secondPoint );
        this.trgPoint.multiplyScalar( 0.5 );
        
        // absolute positioning (tables) is at 1 meter. Relative & Local should be centered at the wrist
        this.mode = ( EXTFIDIR_MODES[ bml.mode ] ) ? EXTFIDIR_MODES[ bml.mode ] : EXTFIDIR_MODES.RELATIVE; 
        if( this.mode != EXTFIDIR_MODES.ABSOLUTE ){ 
            this.trgPoint.y -= rotationTable['o'].y; 
        }
        
        // set defualt point if necessary
        if( bml.shift ){
            this.defPoint.copy( this.trgPoint );
            this.defmode = this.mode;
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

export { Extfidir, rotationTable };