
import { LocationArmIK } from "./LocationArmIK.js";
import { Palmor } from "./Palmor.js"
import { Extfidir } from "./Extfidir.js";
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { CircularMotion, DirectedMotion, FingerPlay, WristMotion } from "./Motion.js";

import { CCDIKSolver, FABRIKSolver } from "./IKSolver.js";
import { Mesh, MeshPhongMaterial, SphereGeometry, Vector3 } from "three";
import { findIndexOfBone } from "./sigmlUtils.js";



// EVERY MODULE WILL WORK WITH THE RIGHT HAND AS DOMINANT 
class GestureManager{
    constructor( character ){
        this.character = character;

        // get skeleton
        let skeleton = this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                skeleton = this.skeleton = o.skeleton;
            }
        } );

        // ik for arm, shared among all modules
        let ikSolver = this.ikSolver = new CCDIKSolver( this.skeleton );
        this.ikTarget = { position: new Vector3(0,0,0) }; // worldposition
        this._ikCreateChain( "LeftHand", "LeftArm", "LeftArm" ); // locationIK
        this._ikCreateChain( "RightHand", "RightArm", "RightArm" );
        this._ikCreateChain( "LeftHand", "LeftShoulder", "LeftShoulder" );
        this._ikCreateChain( "RightHand", "RightShoulder", "RightShoulder" );
        this.ikSolver.constraintsEnabler = false;
        this.ikSolver.setChainEnablerAll(false);
        this.ikSolver.setIterations(10);
        
        // name to index map. If model changes, only this map (and ik) names need to be changed
        let boneMap = this.boneMap ={
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


        // -------------- All modules --------------
        this.locationUpdateOffset = new Vector3(0,0,0);

        this.right = {
            armChain : this.ikSolver.getChain( "RightArm" ),
            loc : new LocationArmIK( boneMap, skeleton, ikSolver, false ),
            locMotions : [ new DirectedMotion(), new CircularMotion() ],
            extfidir : new Extfidir( boneMap, skeleton, false ),
            palmor : new Palmor( boneMap, skeleton, false ),
            wristMotion : new WristMotion( skeleton.bones[ boneMap["RWrist"] ] ),
            handshape : new HandShapeRealizer( boneMap, skeleton, false ),
            fingerplay : new FingerPlay()
        }
        this.left = {
            armChain : this.ikSolver.getChain( "LeftArm" ),
            loc : new LocationArmIK( boneMap, skeleton, ikSolver, true ),
            locMotions : [ new DirectedMotion(), new CircularMotion() ],
            extfidir : new Extfidir( boneMap, skeleton, true ),
            palmor : new Palmor( boneMap, skeleton, true ),
            wristMotion : new WristMotion( skeleton.bones[ boneMap["LWrist"] ] ),
            handshape : new HandShapeRealizer( boneMap, skeleton, true ),
            fingerplay : new FingerPlay()
        }

        this.dominant = this.right;
    }

    _resetArm( arm ){
        arm.loc.reset();
        arm.locMotions[0].reset();
        arm.locMotions[1].reset();
        arm.extfidir.reset();
        arm.palmor.reset();
        arm.wristMotion.reset();
        arm.handshape.reset();
        arm.fingerplay.reset();
    }

    reset(){
        this.locationUpdateOffset.set(0,0,0);

        this._resetArm( this.right );
        this._resetArm( this.left );

        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationArm: "neutral", hand: "right", distance: 0.06, side: "dl", sideDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationArm: "neutral", hand: "left",  distance: 0.04, side: "r", sideDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, handshape: "flat", thumbshape: "touch", hand: "both", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "d", hand: "right", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "dl", hand: "left", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "do", secondExtfidir: "o", hand: "right", mode: "local", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "do", secondExtfidir: "o", hand: "left", mode: "local", shift:true } );

    }

    setDominantHand( isRightHandDominant ){
        if( isRightHandDominant ){ this.dominant = this.right; }
        else{ this.dominant = this.left; }
    }

    _updateLocationMotions( dt, ikChain, motions ){
        this.locationUpdateOffset.set(0,0,0);
        let computeFlag = false;

        // check if any motion is active and update it
        for ( let i = 0; i < motions.length; ++i ){
            if ( motions[i].transition ){
                computeFlag = true;
                this.locationUpdateOffset.add( motions[i].update( dt ) );
            }
        }

        // compute ik only if necessary
        if( computeFlag ){
            this.skeleton.bones[ ikChain.chain[0] ].getWorldPosition( this.ikTarget.position );
            this.ikTarget.position.add( this.locationUpdateOffset );

            // debug points desired location
            // let k = new Mesh( new SphereGeometry(0.005, 16, 16), new MeshPhongMaterial({ color: this.color , depthTest:false, depthWrite: false }) );
            // k.position.copy(this.ikTarget.position);
            // window.global.app.scene.add( k );
    
            ikChain.enabler = true;
            this.ikSolver.update();
            ikChain.enabler = false;
    
            // debug points position after ik
            // this.skeleton.bones[ ikChain.chain[0] ].getWorldPosition( this.ikTarget.position );
            // let kk = new Mesh( new SphereGeometry(0.005, 16, 16), new MeshPhongMaterial({ color: this.color , depthTest:false, depthWrite: false }) );
            // kk.position.copy(this.ikTarget.position);
            // window.global.app.scene.add( kk );
        }    
    }

    _updateArm( dt, arm ){
        let bones = this.skeleton.bones;

        // overwrite arm posture.
        arm.loc.update( dt );
         for( let i = 0; i < arm.loc.curG.length ; ++i ){ 
            bones[ arm.loc.idx + i ].quaternion.copy( arm.loc.curG[i] );
        }
        this._updateLocationMotions( dt, arm.armChain, arm.locMotions ); // IK

     
        // ADD twist to elbow (twist before swing scheme). Overwrite wrist rotation (put only twist)
        arm.palmor.update( dt );
        bones[ arm.palmor.idx ].quaternion.multiply( arm.palmor.curG[0] ); // elbow - add rotation
        bones[ arm.palmor.idx + 1 ].quaternion.copy( arm.palmor.curG[1] ); // wrist - overwrite

        // extfidir - ADD only swing (twist before swing scheme)
        arm.extfidir.update(dt);
        bones[ arm.extfidir.idx ].quaternion.premultiply( arm.extfidir.curG ); // wrist - add rotation

        // wristmotion. ADD rotation to wrist
        arm.wristMotion.update(dt); // wrist - add rotation


        // overwrite finger rotations
        arm.handshape.update( dt );
        arm.fingerplay.update(dt); // add finger rotations
        bones[ arm.handshape.idxs.pinky  ].quaternion.premultiply( arm.fingerplay.pinky );
        bones[ arm.handshape.idxs.ring   ].quaternion.premultiply( arm.fingerplay.ring );
        bones[ arm.handshape.idxs.middle ].quaternion.premultiply( arm.fingerplay.middle );
        bones[ arm.handshape.idxs.index  ].quaternion.premultiply( arm.fingerplay.index );
        
    }

    update( dt ){
        this._updateArm( dt, this.right );
        this._updateArm( dt, this.left );
    }

    _newGestureArm( bml, arm, symmetry = 0x00 ){
        if ( bml.locationArm ){
            arm.loc.newGestureBML( bml, symmetry );
        }
        else if ( bml.motion ){
            let m = null;
            if ( bml.motion == "fingerplay"){ m = arm.fingerplay; }
            else if ( bml.motion == "wrist"){ m = arm.wristMotion; }
            else if ( bml.motion == "directed"){ m = arm.locMotions[0]; }
            else if ( bml.motion == "circular"){ m = arm.locMotions[1]; }
            
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

        if ( ( bml.hand == "left" || bml.hand == "both" ) ){ 
            this._newGestureArm( bml, this.left, ( this.dominant != this.left ) ? symmetryFlags : 0x00 ); 
        }
        if ( ( bml.hand != "left" ) ){ 
            this._newGestureArm( bml, this.right, ( this.dominant != this.right ) ? symmetryFlags : 0x00 ); 
        }        
    }

    _ikCreateChain( effectorName, rootName, chainName ) {
        let bones = this.skeleton.bones;
        let effector = this.skeleton.getBoneByName( effectorName );
        let root = this.skeleton.getBoneByName( rootName );

        if ( !effector ) { // find similarly named bone
            for ( let i = 0; i < bones.length; ++i ) {
                if ( bones[ i ].name.includes( effectorName ) ) {
                    effector = bones[ i ];
                    break;
                }
            }
        }
        if ( !root ) { // bind similarly named bone
            for ( let i = 0; i < bones.length; ++i ) {
                if ( bones[ i ].name.includes( rootName ) ) {
                    root = bones[ i ];
                    break;
                }
            }
        }
        if ( !effector || !root ) { return false; }

        let chain = []
        let bone = effector;
        while ( true ) {
            let i = bones.indexOf( bone );
            if ( i < 0 ) { console.warn( "IK chain: Skeleton root was reached before chain root " ); break; }

            chain.push( i );

            if ( bone == root ) { break; }
            bone = bone.parent;
        }

        if ( !this.ikSolver.getChain( chainName ) ) {
            this.ikSolver.createChain( chain, null, this.ikTarget, chainName );
            return true;
        }

        return false;
    }
}


export { GestureManager };


