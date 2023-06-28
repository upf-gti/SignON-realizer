import * as THREE from "three";

import { LocationArmIK } from "./LocationArmIK.js";
import { Palmor } from "./Palmor.js"
import { Extfidir } from "./Extfidir.js";
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { CircularMotion, DirectedMotion, FingerPlay, WristMotion } from "./Motion.js";

import { CCDIKSolver } from "./IKSolver.js";
import { findIndexOfBone } from "./SigmlUtils.js";
import { GeometricArmIK } from "./GeometricArmIK.js";
import { HandConstellation } from "./HandConstellation.js";

let bodyLocations = {

    // mixamorig_head
    head:       [ "mixamorig_Head", new THREE.Vector3(  0.3959169,  3.6079083, 16.0622060 ) ],
    headtop:    [ "mixamorig_Head", new THREE.Vector3( -0.0036508, 17.0158691,  5.2952675 ) ],
    forehead:   [ "mixamorig_Head", new THREE.Vector3( -0.0038966,  8.9544818, 11.4152387 ) ],
    nose:       [ "mixamorig_Head", new THREE.Vector3( -0.0039482,  3.0418197, 12.6563797 ) ],
    belownose:  [ "mixamorig_Head", new THREE.Vector3( -0.0038966,  1.4548538, 11.3404999 ) ],
    chin:       [ "mixamorig_Head", new THREE.Vector3( -0.1038570, -3.1349527, 10.2947058 ) ],
    underchin:  [ "mixamorig_Head", new THREE.Vector3( -0.1038094, -5.4228805, 9.0718455 ) ],
    mouth:      [ "mixamorig_Head", new THREE.Vector3( -0.1039085, -0.4480414, 11.6215473 ) ],
    earlobeR:   [ "mixamorig_Head", new THREE.Vector3( -7.1035518,  1.1415734, 2.6366639 ) ],
    earlobeL:   [ "mixamorig_Head", new THREE.Vector3(  7.1035518,  1.1415734, 2.6366639 ) ],
    earR:       [ "mixamorig_Head", new THREE.Vector3( -7.3965079,  4.1563666, 1.1672087 ) ],
    earL:       [ "mixamorig_Head", new THREE.Vector3(  7.3965079,  4.1563666, 1.1672087 ) ],
    cheekR:     [ "mixamorig_Head", new THREE.Vector3( -5.8962303,  1.0867598, 8.1369065 ) ],
    cheekL:     [ "mixamorig_Head", new THREE.Vector3(  5.8962303,  1.0867598, 8.1369065 ) ],
    eyeR:       [ "mixamorig_Head", new THREE.Vector3( -2.6038887,  6.0566197, 11.1862465 ) ],
    eyeL:       [ "mixamorig_Head", new THREE.Vector3(  2.6038887,  6.0566197, 11.1862465 ) ],

    // mixamorig_neck
    neck:       [ "mixamorig_Neck", new THREE.Vector3( 0.3777671, 1.6747052, 6.0055403 ) ],

    // mixamorig_spine2
    chest:      [ "mixamorig_Spine2", new THREE.Vector3( -0.5054647, 5.4415624, 14.5946054 ) ],
    shoulderR:  [ "mixamorig_Spine2", new THREE.Vector3( -12.8036077, 13.8415594, 3.5925257 ) ],
    shoulderL:  [ "mixamorig_Spine2", new THREE.Vector3(  12.8036077, 13.8415467, 3.5969393 ) ],
    
    // mixamorig_spine ( not spine1 )
    stomach:    [ "mixamorig_Spine", new THREE.Vector3( -0.0144779, 7.9643509, 12.4294767 ) ],

    // hips
    belowstomach: [ "mixamorig_Hips", new THREE.Vector3( -0.0351382, 7.2248580, 12.5822406 ) ],
    neutral:      [ "mixamorig_Hips", new THREE.Vector3(  0.0158257, 0.0000000, 13.6831055 ) ],

}

let handLocationsR = {
    tip: [ "mixamorig_RightHandIndex4", new THREE.Vector3( 0, 0, 0 ) ],
}
let handLocationsL = {
    tip: [ "mixamorig_LeftHandIndex4", new THREE.Vector3( 0, 0, 0 ) ],

}

// EVERY MODULE WILL WORK WITH THE RIGHT HAND AS DOMINANT 
class BodyController{
    constructor( character ){
        this.character = character;

        // get skeleton
        let skeleton = this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                skeleton = this.skeleton = o.skeleton;
            }
        } );
       
        // name to index map. If model changes, only this map (and ik) names need to be changed
        let boneMap = this.boneMap ={
            ShouldersUnion: findIndexOfBone( this.skeleton, "mixamorig_Spine2" ),
            RShoulder:      findIndexOfBone( this.skeleton, "mixamorig_RightShoulder" ),  
            RArm:           findIndexOfBone( this.skeleton, "mixamorig_RightArm" ),  
            RElbow:         findIndexOfBone( this.skeleton, "mixamorig_RightForeArm" ),
            RWrist:         findIndexOfBone( this.skeleton, "mixamorig_RightHand" ),
            RHandThumb:     findIndexOfBone( this.skeleton, "mixamorig_RightHandThumb1" ),
            RHandIndex:     findIndexOfBone( this.skeleton, "mixamorig_RightHandIndex1" ),
            RHandMiddle:    findIndexOfBone( this.skeleton, "mixamorig_RightHandMiddle1" ),
            RHandRing:      findIndexOfBone( this.skeleton, "mixamorig_RightHandRing1" ),
            RHandPinky:     findIndexOfBone( this.skeleton, "mixamorig_RightHandPinky1" ),
            LShoulder:      findIndexOfBone( this.skeleton, "mixamorig_LeftShoulder" ),
            LArm:           findIndexOfBone( this.skeleton, "mixamorig_LeftArm" ),
            LElbow:         findIndexOfBone( this.skeleton, "mixamorig_LeftForeArm" ),
            LWrist:         findIndexOfBone( this.skeleton, "mixamorig_LeftHand" ),
            LHandThumb:     findIndexOfBone( this.skeleton, "mixamorig_LeftHandThumb1" ),
            LHandIndex:     findIndexOfBone( this.skeleton, "mixamorig_LeftHandIndex1" ),
            LHandMiddle:    findIndexOfBone( this.skeleton, "mixamorig_LeftHandMiddle1" ),
            LHandRing:      findIndexOfBone( this.skeleton, "mixamorig_LeftHandRing1" ),
            LHandPinky:     findIndexOfBone( this.skeleton, "mixamorig_LeftHandPinky1" ),
        }

        // create location point objects and attach them to bones
        this.bodyLocations = {}
        let keys = Object.keys( bodyLocations );
        for( let i = 0; i < keys.length; ++i ){
            let l = bodyLocations[ keys[i] ];
            let idx = findIndexOfBone( this.skeleton, l[0] );
            if ( idx < 0 ){ continue; }

            let o = new THREE.Object3D();
            o.position.copy( l[1] );
            o.name = keys[i];
            this.skeleton.bones[ idx ].add( o );
            this.bodyLocations[ keys[i] ] = o;
        }
        // create location point objects and attach them to bones
        this.handLocationsR = {}
        keys = Object.keys( handLocationsR );
        for( let i = 0; i < keys.length; ++i ){
            let l = handLocationsR[ keys[i] ];
            let idx = findIndexOfBone( this.skeleton, l[0] );
            if ( idx < 0 ){ continue; }

            let o = new THREE.Object3D();
            o.position.copy( l[1] );
            o.name = keys[i];
            this.skeleton.bones[ idx ].add( o );
            this.handLocationsR[ keys[i] ] = o;
        }        
        // create location point objects and attach them to bones
        this.handLocationsL = {}
        keys = Object.keys( handLocationsL );
        for( let i = 0; i < keys.length; ++i ){
            let l = handLocationsL[ keys[i] ];
            let idx = findIndexOfBone( this.skeleton, l[0] );
            if ( idx < 0 ){ continue; }

            let o = new THREE.Object3D();
            o.position.copy( l[1] );
            o.name = keys[i];
            this.skeleton.bones[ idx ].add( o );
            this.handLocationsL[ keys[i] ] = o;
        }


        // -------------- All modules --------------
        this.right = this._createArm( false );
        this.left = this._createArm( true );
        this.handConstellation = new HandConstellation( this.boneMap, this.skeleton, this.handLocationsR, this.handLocationsL, this.right.ikSolver, this.left.ikSolver );


        this.dominant = this.right;
        this.nonDominant = this.left;

        this._tempQ_0 = new THREE.Quaternion();
        this._tempV3_0 = new THREE.Vector3();



        // DEBUG
        // this.point = new THREE.Mesh( new THREE.SphereGeometry(0.005, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthTest:true, depthWrite: false }) );
        // this.point.position.set(0,1.5,0.5);
        // window.global.app.scene.add(this.point);
        // this.elbowRaise = 0;
        // window.addEventListener( "keydown", e =>{
        //     switch( e.which ){
        //         case 37: this.point.position.x -= 0.005; break; // left
        //         case 39: this.point.position.x += 0.005; break; // right
        //         case 38: this.point.position.y += 0.005; break; // up
        //         case 40: this.point.position.y -= 0.005; break; // down
        //         case 90: this.point.position.z += 0.005; break; //z
        //         case 88: this.point.position.z -= 0.005; break; //x
        //         case 65: this.elbowRaise += 1 * Math.PI / 180; break; //a
        //         case 83: this.elbowRaise -= 1 * Math.PI / 180; break; //s
        //         default: break;
        //     }
        // } );
    }
    _createArm( isLeftHand = false ){
        let handName = isLeftHand ? "L" : "R";
        let ik =  new GeometricArmIK( this.skeleton, this.boneMap[ handName  + "Shoulder" ], this.boneMap[ "ShouldersUnion" ], isLeftHand );
        return {
            loc : new LocationArmIK( this.boneMap, this.bodyLocations, this.skeleton, ik, isLeftHand ),
            locMotions : [],
            extfidir : new Extfidir( this.boneMap, this.skeleton, isLeftHand ),
            palmor : new Palmor( this.boneMap, this.skeleton, isLeftHand ),
            wristMotion : new WristMotion( this.skeleton.bones[ this.boneMap[ handName + "Wrist"] ] ),
            handshape : new HandShapeRealizer( this.boneMap, this.skeleton, isLeftHand ),
            fingerplay : new FingerPlay(),

            ikSolver : ik,
            locUpdatePoint : new THREE.Vector3(0,0,0),
            needsUpdate: false,
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
        arm.locUpdatePoint.set(0,0,0);
        arm.needsUpdate = false;
    }
    
    reset(){
        // this.point.position.set(0,1.5,0.5);
        // this.elbowRaise = 0;

        this.handConstellation.reset();
        this._resetArm( this.right );
        this._resetArm( this.left );

        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationArm: "neutral", hand: "right", distance: 0.065, side: "r", sideDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationArm: "neutral", hand: "left",  distance: 0.04, side: "l", sideDistance: 0.025, shift:true } );
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
        

        arm.needsUpdate = motionsRequireUpdated | arm.fingerplay.transition | arm.handshape.transition | arm.wristMotion.transition | arm.palmor.transition | arm.extfidir.transition | arm.loc.transition;
    }

    update( dt ){
        // if( this.right.needsUpdate ){ this._updateArm( dt, this.right ); }
        // if( this.left.needsUpdate ){ this._updateArm( dt, this.left ); }
        
        this._updateArm( dt, this.right );
        this._updateArm( dt, this.left );
        
        if ( this.handConstellation.transition ){ // 2 iks, one for body positioning and a second for hand constellation + motion

            // compute locBody and fix wrist quaternion (forearm twist correction should not be required. Disable it and do less computations)
            this.right.ikSolver.reachTarget( this.right.loc.cur.p, this.right.loc.cur.e, true );
            this.left.ikSolver.reachTarget( this.left.loc.cur.p, this.left.loc.cur.e, true );
            this._fixWristForearmQuaternions( this.right, true );
            this._fixWristForearmQuaternions( this.left, true );

            // handconstellation update, add motions and ik
            this.handConstellation.update( dt, this.right.loc.cur.p, this.left.loc.cur.p, this.right.loc.cur.e, this.left.loc.cur.e );
            this.right.locUpdatePoint.add( this.handConstellation.resultPosR ); // HandConstellation + motions
            this.left.locUpdatePoint.add( this.handConstellation.resultPosL ); // HandConstellation + motions
            this.right.ikSolver.reachTarget( this.right.locUpdatePoint, this.right.loc.cur.e, true );
            this.left.ikSolver.reachTarget( this.left.locUpdatePoint, this.left.loc.cur.e, true );

            this._fixWristForearmQuaternions( this.right, false );
            this._fixWristForearmQuaternions( this.left, false );

            this.right.needsUpdate |= this.handConstellation.transition;
            this.left.needsUpdate |= this.handConstellation.transition;
        } 
        else { // only location body and motions. Do only 1 ik per arm
            this.right.locUpdatePoint.add( this.right.loc.cur.p );
            this.right.ikSolver.reachTarget( this.right.locUpdatePoint, this.right.loc.cur.e, true );

            this.left.locUpdatePoint.add( this.left.loc.cur.p );
            this.left.ikSolver.reachTarget( this.left.locUpdatePoint, this.left.loc.cur.e, true );
        
            this._fixWristForearmQuaternions( this.right, false );   
            this._fixWristForearmQuaternions( this.left, false );  
        }
        
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
        q.copy( bones[ arm.extfidir.idx ].quaternion );
        let twistAxis = this._tempV3_0.copy( arm.palmor.twistAxisWrist );
        let dot = q.x * twistAxis.x + q.y * twistAxis.y + q.z * twistAxis.z;
        q.set( dot * twistAxis.x, dot * twistAxis.y, dot * twistAxis.z, q.w );
        q.normalize();

        // from wrist twist quaternion, compute twist angle and apply it to the forearm. Correct this extra quaternion for the wrist also
        let angle = Math.acos( q.w ) * 2;
        // angle = Math.max( 0, Math.min( Math.PI * 0.6, angle ) );
        angle = ( Math.sin( angle - Math.PI * 0.5 ) * 0.35 + 0.35 ) * angle; // limit angle to avoid overtwisting of elbow
        angle *= ( arm.palmor.twistAxisForeArm.x * q.x + arm.palmor.twistAxisForeArm.y * q.y + arm.palmor.twistAxisForeArm.z * q.z ) < 0 ? -1 : 1; // is the axis of rotation inverted ?
        q.setFromAxisAngle( arm.palmor.twistAxisForeArm, angle);
        bones[ arm.palmor.idx ].quaternion.multiply( q );
        bones[ arm.extfidir.idx ].quaternion.premultiply( q.invert() ); // wrist did not know about this twist, undo it

    }

    _newGestureArm( bml, arm, symmetry = 0x00 ){
        if ( bml.locationArm ){ // when location change, cut directed and circular motions
            arm.loc.newGestureBML( bml, symmetry, arm.locUpdatePoint );
            arm.locMotions = [];
            this.handConstellation.reset();
        }
        else if ( bml.motion ){
            let m = null;
            if ( bml.motion == "fingerplay"){ m = arm.fingerplay; }
            else if ( bml.motion == "wrist"){ m = arm.wristMotion; }
            else if ( bml.motion == "directed"){ m = new DirectedMotion(); arm.locMotions.push(m); }
            else if ( bml.motion == "circular"){ m = new CircularMotion(); arm.locMotions.push(m); }
            
            if( m ){ 
                m.newGestureBML( bml, symmetry );
            }
        }
        else if ( bml.palmor ){
            arm.palmor.newGestureBML( bml, symmetry );
        }
        else if ( bml.extfidir ){
            arm.extfidir.newGestureBML( bml, symmetry );
        }
        else if ( bml.handshape ){
            arm.handshape.newGestureBML( bml, symmetry );
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
        // symmetry: bit0 = lr, bit1 = ud, bit2 = io
        let symmetryFlags = ( !!bml.lrSym );
        symmetryFlags |= ( ( !!bml.udSym ) << 1 );
        symmetryFlags |= ( ( !!bml.ioSym ) << 2 );

        if ( bml.dominant ){
            this.setDominantHand( bml.dominant == "right" );
        }

        if ( bml.handConstellation ){
            this.handConstellation.newGestureBML( bml, this.dominant == this.right ? 'R' : 'L' );
            this.right.needsUpdate = true;
            this.left.needsUpdate = true;
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


