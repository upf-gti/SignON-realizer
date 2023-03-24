
import { LocationArmIK } from "./LocationArmIK.js";
import { Palmor } from "./Palmor.js"
import { Extfidir } from "./Extfidir.js";
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { CircularMotion, DirectedMotion, FingerPlay, WristMotion } from "./Motion.js";

import { CCDIKSolver, FABRIKSolver } from "./IKSolver.js";
import { Mesh, MeshPhongMaterial, SphereGeometry, Vector3 } from "three";



// EVERY MODULE WILL WORK WITH THE RIGHT HAND AS DOMINANT 
class GestureManager{
    constructor( character ){
        this.character = character;

        // get skeleton
        this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                this.skeleton = o.skeleton;
            }
        } );

        // ik for arm, shared among all modules
        this.ikSolver = new CCDIKSolver( this.skeleton );
        this.ikTarget = { position: new Vector3(0,0,0) }; // worldposition
        this._ikCreateChain( "LeftHand", "LeftArm", "LeftArm" ); // locationIK
        this._ikCreateChain( "RightHand", "RightArm", "RightArm" );
        this._ikCreateChain( "LeftHand", "LeftShoulder", "LeftShoulder" );
        this._ikCreateChain( "RightHand", "RightShoulder", "RightShoulder" );
        this.ikSolver.constraintsEnabler = false;
        this.ikSolver.setChainEnablerAll(false);
        this.ikSolver.setIterations(10);
        
        // -------------- All modules --------------
        this.locationUpdateOffset = new Vector3(0,0,0);

        this.right = {
            armChain : this.ikSolver.getChain( "RightArm" ),
            loc : new LocationArmIK( this.skeleton, this.ikSolver, false ),
            locMotions : [ new DirectedMotion(), new CircularMotion() ],
            extfidir : new Extfidir( this.skeleton, false ),
            palmor : new Palmor( this.skeleton, false ),
            wristMotion : new WristMotion( this.skeleton.getBoneByName( "mixamorig_RightHand" ) ),
            handshape : new HandShapeRealizer( this.skeleton, false ),
            fingerplay : new FingerPlay()
        }
        this.left = {
            armChain : this.ikSolver.getChain( "LeftArm" ),
            loc : new LocationArmIK( this.skeleton, this.ikSolver, true ),
            locMotions : [ new DirectedMotion(), new CircularMotion() ],
            extfidir : new Extfidir( this.skeleton, true ),
            palmor : new Palmor( this.skeleton, true ),
            wristMotion : new WristMotion( this.skeleton.getBoneByName( "mixamorig_LeftHand" ) ),
            handshape : new HandShapeRealizer( this.skeleton, true ),
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

        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationArm: "neutral", hand: "right", side: 'o', sideDistance: 0.036, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationArm: "neutral", hand: "left", side: 'or', sideDistance: 0.05, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, handshape: "flat", thumbshape: "touch", hand: "both", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "d", hand: "right", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "dl", hand: "left", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "do", secondExtfidir: "o",  hand: "right", mode: "local", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "do", hand: "left", mode: "local", shift:true } );

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
        this._updateLocationMotions( dt, arm.armChain, arm.locMotions );

     
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
        arm.fingerplay.update(dt);
        bones[ arm.handshape.idxs.pinky  ].quaternion.premultiply( arm.fingerplay.pinky );
        bones[ arm.handshape.idxs.ring   ].quaternion.premultiply( arm.fingerplay.ring );
        bones[ arm.handshape.idxs.middle ].quaternion.premultiply( arm.fingerplay.middle );
        bones[ arm.handshape.idxs.index  ].quaternion.premultiply( arm.fingerplay.index );
        
    }

    update( dt ){
        this._updateArm( dt, this.right );
        this._updateArm( dt, this.left );
    }

    _newGestureArm( bml, arm,  symmetry = false ){
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

    newGesture( bml ){
        if ( ( bml.hand == "left" || bml.hand == "both" ) ){ this._newGestureArm( bml, this.left, !!bml.sym && ( this.dominant != this.left ) ); }
        if ( ( bml.hand != "left" ) ){ this._newGestureArm( bml, this.right, !!bml.sym && ( this.dominant != this.right ) ); }        
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


