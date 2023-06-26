import * as THREE from "three";

import { LocationArmIK } from "./LocationArmIK.js";
import { Palmor } from "./Palmor.js"
import { Extfidir } from "./Extfidir.js";
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { CircularMotion, DirectedMotion, FingerPlay, WristMotion } from "./Motion.js";

import { CCDIKSolver } from "./IKSolver.js";
import { findIndexOfBone } from "./SigmlUtils.js";
import { GeometricArmIK } from "./GeometricArmIK.js";

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


        // -------------- All modules --------------
        let ikright = new GeometricArmIK( skeleton, boneMap["RShoulder"], boneMap["ShouldersUnion"], false );
        let ikleft = new GeometricArmIK( skeleton, boneMap["LShoulder"], boneMap["ShouldersUnion"], true );
        this.right = {
            locationLastFrameQuats : [ new THREE.Quaternion(0,0,0,1), new THREE.Quaternion(0,0,0,1), new THREE.Quaternion(0,0,0,1) ], // Shoulder, arm, elbow
            // loc : new LocationArmIK( boneMap, skeleton, ikSolver, false ),
            loc : new LocationArmIK( boneMap, this.bodyLocations, skeleton, ikright, false ),
            locMotions : [],
            extfidir : new Extfidir( boneMap, skeleton, false ),
            palmor : new Palmor( boneMap, skeleton, false ),
            wristMotion : new WristMotion( skeleton.bones[ boneMap["RWrist"] ] ),
            handshape : new HandShapeRealizer( boneMap, skeleton, false ),
            fingerplay : new FingerPlay(),

            geometricIK: ikright, 
            locUpdatePoint: new THREE.Vector3(0,0,0),
            needsUpdate: false,
        }
        this.left = {
            locationLastFrameQuats : [ new THREE.Quaternion(0,0,0,1), new THREE.Quaternion(0,0,0,1), new THREE.Quaternion(0,0,0,1) ], // Shoulder, arm, elbow
            // loc : new LocationArmIK( boneMap, skeleton, ikSolver, true ),
            loc : new LocationArmIK( boneMap, this.bodyLocations, skeleton, ikleft, true ),
            locMotions : [],
            extfidir : new Extfidir( boneMap, skeleton, true ),
            palmor : new Palmor( boneMap, skeleton, true ),
            wristMotion : new WristMotion( skeleton.bones[ boneMap["LWrist"] ] ),
            handshape : new HandShapeRealizer( boneMap, skeleton, true ),
            fingerplay : new FingerPlay(),

            geometricIK : ikleft,
            locUpdatePoint : new THREE.Vector3(0,0,0),
            needsUpdate: false,

        }

        this.dominant = this.right;
        this.nonDominant = this.left;

        this._tempQ_0 = new THREE.Quaternion();
        this._tempV3_0 = new THREE.Vector3();



        // DEBUG
        this.point = new THREE.Mesh( new THREE.SphereGeometry(0.005, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthTest:true, depthWrite: false }) );
        this.point.position.set(0,1.5,0.5);
        window.global.app.scene.add(this.point);
        this.elbowRaise = 0;
        window.addEventListener( "keydown", e =>{
            switch( e.which ){
                case 37: this.point.position.x -= 0.005; break; // left
                case 39: this.point.position.x += 0.005; break; // right
                case 38: this.point.position.y += 0.005; break; // up
                case 40: this.point.position.y -= 0.005; break; // down
                case 90: this.point.position.z += 0.005; break; //z
                case 88: this.point.position.z -= 0.005; break; //x
                case 65: this.elbowRaise += 1 * Math.PI / 180; break; //a
                case 83: this.elbowRaise -= 1 * Math.PI / 180; break; //s
                default: break;
            }
        } );
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
        this.point.position.set(0,1.5,0.5);
        this.elbowRaise = 0;

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
        if( !arm.needsUpdate ){ return; }
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

        // overwrite arm posture.
        arm.loc.update( dt );
        let motionsRequireUpdated = this._updateLocationMotions( dt, arm );

        arm.locUpdatePoint.add( arm.loc.cur.p );
        arm.geometricIK.reachTarget( arm.locUpdatePoint, arm.loc.cur.e, true );


        // wrist did not know about arm quaternions. Compensate them
        q.copy( bones[ arm.loc.idx ].quaternion );
        q.multiply( bones[ arm.loc.idx + 1 ].quaternion );
        q.multiply( bones[ arm.loc.idx + 2 ].quaternion );
        q.invert();
        bones[ arm.extfidir.idx ].quaternion.premultiply( q );    

        // Doing the previous wrist fix introduces some extra twist correction. Forearm twist should adjust to palmor + twist correction. The following operations combine both
        q.copy(bones[ arm.extfidir.idx ].quaternion);
        let twistAxis = this._tempV3_0.copy(arm.palmor.twistAxisWrist);
        let dot = q.x * twistAxis.x + q.y * twistAxis.y + q.z * twistAxis.z;
        q.set( dot * twistAxis.x, dot * twistAxis.y, dot * twistAxis.z, q.w );
        q.normalize();
        
        let angle = Math.acos( q.w ) * 2;
        angle *= ( arm.palmor.twistAxisForeArm.x * q.x + arm.palmor.twistAxisForeArm.y * q.y + arm.palmor.twistAxisForeArm.z * q.z ) < 0 ? -1 : 1;
        q.setFromAxisAngle( arm.palmor.twistAxisForeArm, angle);
        bones[ arm.palmor.idx ].quaternion.multiply( q );
        bones[ arm.extfidir.idx ].quaternion.premultiply( q.invert() ); // wrist did not know about this twist, undo it
     
        arm.needsUpdate = motionsRequireUpdated | arm.fingerplay.transition | arm.handshape.transition | arm.wristMotion.transition | arm.palmor.transition | arm.extfidir.transition | arm.loc.transition;
    }

    update( dt ){
        this._updateArm( dt, this.right );
        this._updateArm( dt, this.left );

        // let bones = this.skeleton.bones;
        // // tmeporarily fix the wrist rotation with the arm posture
        // let qL = new THREE.Quaternion();
        // let qR = new THREE.Quaternion();
        // // hand does not know about arm rotation.
        // qL.set(0,0,0,1);
        // qR.set(0,0,0,1);
        // for( let i = 0; i < 3; ++i ){ 
        //     qR.multiply( bones[ this.right.loc.idx + i ].quaternion );
        //     qL.multiply( bones[ this.left.loc.idx + i ].quaternion );
        // }
        // bones[ this.right.extfidir.idx ].quaternion.premultiply( qR.invert() );
        // bones[ this.left.extfidir.idx ].quaternion.premultiply( qL.invert() );

        // // compute world positions
        // let indexTipRight = this.skeleton.bones[ this.boneMap.RHandIndex + 3 ];
        // let targetLeft = this.skeleton.bones[ this.boneMap.LHandIndex + 3 ];
        // let wristL = this.skeleton.bones[ this.boneMap.LWrist ];
        // let wristR = this.skeleton.bones[ this.boneMap.RWrist ];
        // indexTipRight.updateWorldMatrix( true );
        // targetLeft.updateWorldMatrix( true );
        // wristL.updateWorldMatrix( true );
        // wristR.updateWorldMatrix( true );

        // let worldWristR = (new THREE.Vector3()).setFromMatrixPosition( wristR.matrixWorld );
        // let worldWristL = (new THREE.Vector3()).setFromMatrixPosition( wristL.matrixWorld );

        // let worldPosR = (new THREE.Vector3()).setFromMatrixPosition( indexTipRight.matrixWorld );
        // let worldPosL = (new THREE.Vector3()).setFromMatrixPosition( targetLeft.matrixWorld );

        // if( !window.time ) { window.time = 0; }
        // window.time += dt;
        // let t =  Math.sin( window.time * Math.PI )*0.5 + 0.5;
        // let finalPositionL = worldPosL.clone().multiplyScalar( 1 - t );
        // let finalPositionR = worldPosR.clone().multiplyScalar( t );

        // let rightOffset = worldPosR.clone().sub( worldWristR ); // vector from index to wrist
        // let finalPosition = finalPositionL.clone().add( finalPositionR );
        // finalPosition.sub(rightOffset);

        // this.right.geometricIK.reachTarget( finalPosition );
        // // remove old arm rotation from the wrist and include the new arm rotation
        // bones[ this.right.extfidir.idx ].quaternion.premultiply( qR.invert() );
        // bones[ this.left.extfidir.idx ].quaternion.premultiply( qL.invert() );
        // qL.set(0,0,0,1);
        // qR.set(0,0,0,1);
        // for( let i = 0; i < 3; ++i ){ 
        //     qR.multiply( bones[ this.right.loc.idx + i ].quaternion );
        //     qL.multiply( bones[ this.left.loc.idx + i ].quaternion );
        // }
        // bones[ this.right.extfidir.idx ].quaternion.premultiply( qR.invert() );
        // bones[ this.left.extfidir.idx ].quaternion.premultiply( qL.invert() );

    }

    _newGestureArm( bml, arm, symmetry = 0x00 ){
        if ( bml.locationArm ){ // when location change, cut directed and circular motions
            arm.loc.newGestureBML( bml, symmetry, arm.locUpdatePoint );
            arm.locMotions = [];
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


