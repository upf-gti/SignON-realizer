import * as THREE from "three";

import { LocationBodyArm } from "./LocationBodyArm.js";
import { Palmor } from "./Palmor.js"
import { Extfidir } from "./Extfidir.js";
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { CircularMotion, DirectedMotion, FingerPlay, WristMotion } from "./Motion.js";
import { HandConstellation } from "./HandConstellation.js";
import { ShoulderRaise, ShoulderHunch, BodyMovement } from "./ShouldersBodyNMF.js";

import { findIndexOfBone, getTwistQuaternion } from "./SigmlUtils.js";
import { GeometricArmIK } from "./GeometricArmIK.js";

// characterConfig is modified by bodyController
class BodyController{
    
    constructor( character, characterConfig ){
        this.character = character;

        // get skeleton
        let skeleton = this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                skeleton = this.skeleton = o.skeleton;
            }
        } );

        this.computeConfig( characterConfig );

        // -------------- All modules --------------
        this.right = this._createArm( false );
        this.left = this._createArm( true );
        this.handConstellation = new HandConstellation( this.config.boneMap, this.skeleton, this.config.handLocationsR, this.config.handLocationsL );
        this.bodyMovement = new BodyMovement( this.config, this.skeleton );

        this.dominant = this.right;
        this.nonDominant = this.left;

        this._tempQ_0 = new THREE.Quaternion();
        this._tempV3_0 = new THREE.Vector3();

    }

    computeConfig( jsonConfig ){
        // reference, not a copy. All changes also affect the incoming characterConfig
        this.config = jsonConfig.bodyController; 


        /** BoneMap */
        // name to index map. If model changes, only this map (and ik) names need to be changed
        for ( let p in this.config.boneMap ){
            this.config.boneMap[ p ] = findIndexOfBone( this.skeleton, this.config.boneMap[ p ] );            
        }

        /** Main Avatar Axes */
        if ( this.config.axes ){ 
            for( let i = 0; i < this.config.axes.length; ++i ){ // probably axes are a simple js object {x:0,y:0,z:0}. Convert it to threejs
                this.config.axes[i] = new THREE.Vector3(  this.config.axes[i].x, this.config.axes[i].y, this.config.axes[i].z ); 
            }
        } else{ 
            // compute axes in MESH coordinates using the the Bind pose ( TPose mandatory )
            // MESH coordinates: the same in which the actual vertices are located, without any rigging or any matrix applied
            this.config.axes = [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ]; // x,y,z
            let boneMap = this.config.boneMap;
            this.skeleton.bones[ boneMap.Hips ].updateWorldMatrix( true, true ); // parents and children also
    
            let a = (new THREE.Vector3()).setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.LShoulder ].clone().invert() );
            let b = (new THREE.Vector3()).setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.RShoulder ].clone().invert() );
            this.config.axes[0].subVectors( a, b ).normalize(); // x
    
            a = a.setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.BelowStomach ].clone().invert() );
            b = b.setFromMatrixPosition( this.skeleton.boneInverses[ boneMap.Hips ].clone().invert() );
            this.config.axes[1].subVectors( a, b ).normalize(); // y
            
            this.config.axes[2].crossVectors( this.config.axes[0], this.config.axes[1] ).normalize(); // cross( x, y )
            this.config.axes[1].crossVectors( this.config.axes[2], this.config.axes[0] ).normalize(); // cross( z, x )
        }

        /** Body and Hand Locations */
        // create location point objects and attach them to bones
        function locationToObjects( table, skeleton, symmetry = false ){
            let result = {};
            for( let name in table ){
                let l = table[ name ];
    
                let idx = findIndexOfBone( skeleton, symmetry ? l[0].replace( "Right", "Left" ) : l[0] );
                if ( idx < 0 ){ continue; }
    
                let o = new THREE.Object3D();
                // let o = new THREE.Mesh( new THREE.SphereGeometry(0.3,16,16), new THREE.MeshStandardMaterial( { color: Math.random()*0xffffff }) );
                o.position.copy( l[1] );
                if ( symmetry ){ o.position.x *= -1; }
                o.name = name;
                skeleton.bones[ idx ].add( o );
                result[ name ] = o;
            }         
            return result;   
        }
        this.config.bodyLocations = locationToObjects( this.config.bodyLocations, this.skeleton, false );
        this.config.handLocationsL = locationToObjects( this.config.handLocationsL ? this.config.handLocationsL : this.config.handLocationsR, this.skeleton, this.config.handLocationsL ? false : true ); // assume symmetric mesh/skeleton
        this.config.handLocationsR = locationToObjects( this.config.handLocationsR, this.skeleton, false ); // since this.config is being overwrite, generate left before right

        // finger axes do no need any change

    }
    _createArm( isLeftHand = false ){
        let handName = isLeftHand ? "L" : "R";
        return {
            loc: new LocationBodyArm( this.config, this.skeleton, isLeftHand ),
            locMotions: [],
            extfidir: new Extfidir( this.config, this.skeleton, isLeftHand ),
            palmor: new Palmor( this.config, this.skeleton, isLeftHand ),
            wristMotion: new WristMotion( this.skeleton.bones[ this.config.boneMap[ handName + "Wrist"] ] ),
            handshape: new HandShapeRealizer( this.config, this.skeleton, isLeftHand ),
            fingerplay: new FingerPlay(),
            shoulderRaise: new ShoulderRaise( this.config, this.skeleton, isLeftHand ),
            shoulderHunch: new ShoulderHunch( this.config, this.skeleton, isLeftHand ),

            needsUpdate: false,
            ikSolver: new GeometricArmIK( this.skeleton, this.config, isLeftHand ),
            locUpdatePoint: new THREE.Vector3(0,0,0),
            _tempWristQuat: new THREE.Quaternion(0,0,0,1), // stores computed extfidir + palmor before any arm movement applied. Necessary for locBody + handConstellation
        };
    }

    _resetArm( arm ){
        arm.loc.reset();
        arm.locMotions = [];
        arm.extfidir.reset();
        arm.palmor.reset();
        arm.wristMotion.reset();
        arm.handshape.reset();
        arm.fingerplay.reset();
        arm.shoulderRaise.reset();
        arm.shoulderHunch.reset();
        arm.locUpdatePoint.set(0,0,0);
        arm.needsUpdate = false;

    }
    
    reset(){

        this.handConstellation.reset();
        this._resetArm( this.right );
        this._resetArm( this.left );

        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationBodyArm: "neutral", hand: "right", distance: 0.065, side: "r", sideDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationBodyArm: "neutral", hand: "left",  distance: 0.04, side: "l", sideDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, handshape: "flat", thumbshape: "touch", hand: "both", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "l", hand: "right", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "r", hand: "left", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "dl", hand: "right", mode: "local", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "dr", hand: "left", mode: "local", shift:true } );

    }

    setDominantHand( isRightHandDominant ){
        if( isRightHandDominant ){ this.dominant = this.right; this.nonDominant = this.left; }
        else{ this.dominant = this.left; this.nonDominant = this.right; }
    }

    _updateLocationMotions( dt, arm ){
        let computeFlag = false;

        let motions = arm.locMotions;
        let resultOffset = arm.locUpdatePoint;
        resultOffset.set(0,0,0);

        // check if any motion is active and update it
        for ( let i = 0; i < motions.length; ++i ){
            if ( motions[i].transition ){
                computeFlag = true;
                resultOffset.add( motions[i].update( dt ) );
            }else{
                motions.splice(i, 1); // removed motion that has already ended
                i--;
            }
        }
        return computeFlag; 
    }

    _updateArm( dt, arm ){
        let bones = this.skeleton.bones;

        // reset shoulder, arm, elbow. This way location body, motion and location hand can be safely computed
        bones[ arm.loc.idx ].quaternion.set(0,0,0,1);
        bones[ arm.loc.idx + 1 ].quaternion.set(0,0,0,1);
        bones[ arm.loc.idx + 2 ].quaternion.set(0,0,0,1);

        // overwrite finger rotations
        arm.fingerplay.update(dt); // motion, prepare offsets
        arm.handshape.update( dt, arm.fingerplay.curBends );

        // wrist extfidir
        bones[ arm.extfidir.idx ].quaternion.set(0,0,0,1);
        arm.extfidir.update( dt );
        bones[ arm.extfidir.idx ].quaternion.copy( arm.extfidir.curG );
        

        // wrist (and forearm) twist
        arm.palmor.update( dt );
        let q = this._tempQ_0;
        let palmorAngle = arm.palmor.curAngle * arm.extfidir.curPalmorRefactor
        q.setFromAxisAngle( arm.palmor.twistAxisWrist, palmorAngle ); // wrist
        bones[ arm.palmor.idx + 1 ].quaternion.multiply( q );
        
        // wristmotion. ADD rotation to wrist
        arm.wristMotion.update(dt); // wrist - add rotation

        // backup the current wrist quaternion, before any arm rotation is applied
        arm._tempWristQuat.copy( bones[ arm.extfidir.idx ].quaternion );

        // update arm posture world positions but do not commit results to the bones, yet.
        arm.loc.update( dt );
        let motionsRequireUpdated = this._updateLocationMotions( dt, arm );
        
        arm.shoulderRaise.update( dt );
        arm.shoulderHunch.update( dt );

        arm.needsUpdate = motionsRequireUpdated | arm.fingerplay.transition | arm.handshape.transition | arm.wristMotion.transition | arm.palmor.transition | arm.extfidir.transition | arm.loc.transition | arm.shoulderRaise.transition | arm.shoulderHunch.transition;
    }

    update( dt ){
        if ( !this.bodyMovement.transition && !this.right.needsUpdate && !this.left.needsUpdate && !this.handConstellation.transition ){ return; }
        
        this.bodyMovement.update( dt );

        this._updateArm( dt, this.right );
        this._updateArm( dt, this.left );
        
        if ( this.handConstellation.transition ){ 
            // 2 iks, one for body positioning and a second for hand constellation + motion
            // if only points in hand were used in handConstellation, the first ik could be removed. But forearm-elbow-upperarm locations require 2 iks

            // compute locBody and fix wrist quaternion (forearm twist correction should not be required. Disable it and do less computations)
            // using loc.cur.p, without the loc.cur.offset. Compute handConstellation with raw locBody
            this.right.ikSolver.reachTarget( this.right.loc.cur.p, this.right.loc.cur.e, this.right.shoulderRaise.curAngle, this.right.shoulderHunch.curAngle, false ); //ik without aesthetics. Aesthetics might modify 
            this.left.ikSolver.reachTarget( this.left.loc.cur.p, this.left.loc.cur.e, this.left.shoulderRaise.curAngle, this.left.shoulderHunch.curAngle, false );
            this._fixWristForearmQuaternions( this.right, true );
            this._fixWristForearmQuaternions( this.left, true );

            // handconstellation update, add motions and ik
            this.handConstellation.update( dt );
            this.right.locUpdatePoint.add( this.handConstellation.curOffsetR ); // HandConstellation + motions
            this.left.locUpdatePoint.add( this.handConstellation.curOffsetL ); // HandConstellation + motions
        }

        // if only location body and motions. Do only 1 ik per arm
        this.right.locUpdatePoint.add( this.right.loc.cur.p );
        this.right.locUpdatePoint.add( this.right.loc.cur.offset );
        this.right.ikSolver.reachTarget( this.right.locUpdatePoint, this.right.loc.cur.e, this.right.shoulderRaise.curAngle, this.right.shoulderHunch.curAngle, true ); // ik + aesthetics

        this.left.locUpdatePoint.add( this.left.loc.cur.p );
        this.left.locUpdatePoint.add( this.left.loc.cur.offset );
        this.left.ikSolver.reachTarget( this.left.locUpdatePoint, this.left.loc.cur.e, this.left.shoulderRaise.curAngle, this.left.shoulderHunch.curAngle, true ); // ik + aesthetics
    
        this._fixWristForearmQuaternions( this.right, false );   
        this._fixWristForearmQuaternions( this.left, false );  
        
    }

    _fixWristForearmQuaternions( arm, fixWristOnly = false ){
        let q = this._tempQ_0;
        let bones = this.skeleton.bones;

        // copy back the original wrist quaternion, when no arm rotations were applied
        bones[ arm.extfidir.idx ].quaternion.copy( arm._tempWristQuat );  

        // wrist did not know about arm quaternions. Compensate them
        q.copy( bones[ arm.loc.idx ].quaternion );
        q.multiply( bones[ arm.loc.idx + 1 ].quaternion );
        q.multiply( bones[ arm.loc.idx + 2 ].quaternion );
        q.invert();
        bones[ arm.extfidir.idx ].quaternion.premultiply( q );  
        
        if ( fixWristOnly ){ return } // whether to correct forearm twisting also
        
        // Doing the previous wrist fix introduces some extra twist correction. Forearm twist should adjust to palmor + twist correction. The following operations combine both
        // get wrist twist quaternion
        getTwistQuaternion( bones[ arm.extfidir.idx ].quaternion, arm.palmor.twistAxisWrist, q );

        // from wrist twist quaternion, compute twist angle and apply it to the forearm. Correct this extra quaternion for the wrist also
        let angle = Math.acos( q.w ) * 2;
        // angle = Math.max( 0, Math.min( Math.PI * 0.6, angle ) );
        angle = ( Math.sin( angle - Math.PI * 0.5 ) * 0.35 + 0.35 ) * angle; // limit angle to avoid overtwisting of elbow
        angle *= ( arm.palmor.twistAxisForeArm.x * q.x + arm.palmor.twistAxisForeArm.y * q.y + arm.palmor.twistAxisForeArm.z * q.z ) < 0 ? -1 : 1; // is the axis of rotation inverted ?
        q.setFromAxisAngle( arm.palmor.twistAxisForeArm, angle);
        bones[ arm.palmor.idx ].quaternion.multiply( q ); // forearm
        bones[ arm.extfidir.idx ].quaternion.premultiply( q.invert() ); // wrist did not know about this twist, undo it

    }

    _newGestureArm( bml, arm, symmetry = 0x00 ){
        if ( bml.locationBodyArm ){ // when location change, cut directed and circular motions
            arm.loc.newGestureBML( bml, symmetry, arm.locUpdatePoint );
            arm.locMotions = [];
            this.handConstellation.cancelArm( arm == this.right ? 'R' : 'L' );
        }
        if ( bml.motion ){
            let m = null;
            if ( bml.motion == "fingerplay"){ m = arm.fingerplay; }
            else if ( bml.motion == "wrist"){ m = arm.wristMotion; }
            else if ( bml.motion == "directed"){ m = new DirectedMotion(); arm.locMotions.push(m); }
            else if ( bml.motion == "circular"){ m = new CircularMotion(); arm.locMotions.push(m); }
            
            if( m ){ 
                m.newGestureBML( bml, symmetry );
            }
        }
        if ( bml.palmor ){
            arm.palmor.newGestureBML( bml, symmetry );
        }
        if ( bml.extfidir ){
            arm.extfidir.newGestureBML( bml, symmetry );
        }
        if ( bml.handshape ){
            arm.handshape.newGestureBML( bml, symmetry );
        } 
        if ( bml.shoulderRaise ){
            arm.shoulderRaise.newGestureBML( bml, symmetry );
        }
        if ( bml.shoulderHunch ){
            arm.shoulderHunch.newGestureBML( bml, symmetry );
        }

        arm.needsUpdate = true;
    }

    /**
    * lrSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * udSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * ioSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * hand: (optional) "right", "left", "both". Default right
    * shift: (optional) bool - make this the default position. Motions not affected
    */
    newGesture( bml ){

        bml.start = bml.start || 0;
        bml.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        bml.attackPeak = bml.attackPeak || ( ( bml.end - bml.start ) * 0.25 + bml.start );
        bml.relax = bml.relax || ( (bml.end - bml.attackPeak) * 0.5 + bml.attackPeak );

        // symmetry: bit0 = lr, bit1 = ud, bit2 = io
        let symmetryFlags = ( !!bml.lrSym );
        symmetryFlags |= ( ( !!bml.udSym ) << 1 );
        symmetryFlags |= ( ( !!bml.ioSym ) << 2 );

        if ( bml.dominant ){
            this.setDominantHand( bml.dominant == "right" );
        }

        if ( bml.handConstellation ){
            this.handConstellation.newGestureBML( bml, this.dominant == this.right ? 'R' : 'L' );
        }

        if ( bml.bodyMovement ){
            this.bodyMovement.newGestureBML( bml );
        }

        switch ( bml.hand ){
            case "right" :             
                this._newGestureArm( bml, this.right, ( this.dominant == this.right ) ? 0x00 : symmetryFlags ); 
                break;
            case "left" : 
                this._newGestureArm( bml, this.left, ( this.dominant == this.left ) ? 0x00 : symmetryFlags ); 
                break;
            case "both" : 
                this._newGestureArm( bml, this.dominant, 0x00 ); 
                this._newGestureArm( bml, this.nonDominant, symmetryFlags ); 
                break;
            case "nonDom" : 
                this._newGestureArm( bml, this.nonDominant, symmetryFlags ); 
                break;
            case "dom": 
            default:
                this._newGestureArm( bml, this.dominant, 0x00 ); 
                break;
        }

    }


}


export { BodyController };


