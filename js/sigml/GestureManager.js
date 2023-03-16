
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { LocationArm } from "./LocationArm.js";

import { Palmor } from "./Palmor.js"
import { Extfidir } from "./Extfidir.js";
import { CircularMotion, DirectedMotion, FingerPlay } from "./Motion.js";
import { Mesh, MeshPhongMaterial, SphereGeometry, Vector3 } from "three";
import { FABRIKSolver } from "./IKSolver.js";



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
        this.ikSolver = new FABRIKSolver( this.skeleton );
        this.ikTarget = { position: new Vector3(0,0,0) }; // worldposition
        this._ikCreateChains( "LeftHand", "LeftArm" );
        this._ikCreateChains( "RightHand", "RightArm" );
        this.ikSolver.constraintsEnabler = false;
        this.ikSolver.setChainEnablerAll(false);
        this.ikSolver.setIterations(1);
        this.leftHandChain = this.ikSolver.getChain("mixamorig_LeftHand");
        this.rightHandChain = this.ikSolver.getChain("mixamorig_RightHand");

        
        // -------------- All modules --------------
        // Location Arm
        this.locationArm = new LocationArm( this.skeleton );
        this.leftLocationMotions = [ new  DirectedMotion(), new CircularMotion() ];
        this.rightLocationMotions = [ new DirectedMotion(), new CircularMotion() ];
        this.locationUpdateOffset = new Vector3(0,0,0);
       
        // Wrist 
        this.extfidir = new Extfidir( this.skeleton );
        this.palmor = new Palmor( this.skeleton );
        // missing wrist motion

        // Fingers
        this.handShapeRealizer = new HandShapeRealizer( this.skeleton );
        this.leftFingerplay = new FingerPlay();
        this.rightFingerplay = new FingerPlay();

    }

    reset(){
        this.locationArm.reset();
        this.leftLocationMotions[0].reset();
        this.leftLocationMotions[1].reset();
        this.rightLocationMotions[0].reset();
        this.rightLocationMotions[1].reset();
        this.locationUpdateOffset.set(0,0,0);

        this.extfidir.reset();
        this.palmor.reset();
        
        this.handShapeRealizer.reset();
        this.leftFingerplay.reset();
        this.rightFingerplay.reset();


        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationArm: "neutral", hand: "right", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationArm: "neutral", hand: "left", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, handshape: "flat", thumbshape: "touch", hand: "both", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "dr", hand: "right", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "dl", hand: "left", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "dl", hand: "right", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "dr", secondExtfidir:"dor", hand: "left", shift:true } );

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
            let k = new Mesh( new SphereGeometry(0.005, 16, 16), new MeshPhongMaterial({ color: this.color , depthTest:false, depthWrite: false }) );
            k.position.copy(this.ikTarget.position);
            window.global.app.scene.add( k );
    
            ikChain.enabler = true;
            this.ikSolver.update();
            ikChain.enabler = false;
    
            // debug points position after ik
            // this.skeleton.bones[ ikChain.chain[0] ].getWorldPosition( this.ikTarget.position );
            // k = new Mesh( new SphereGeometry(0.005, 16, 16), new MeshPhongMaterial({ color: this.color , depthTest:false, depthWrite: false }) );
            // k.position.copy(this.ikTarget.position);
            // window.global.app.scene.add( k );
        }    
    }

    update( dt ){

        // overwrite arm posture.
        this.locationArm.update( dt );
        let r = this.locationArm.right;
        let l = this.locationArm.left;
        let bones = this.skeleton.bones;
        for( let i = 0; i < r.curG.length ; ++i ){
            bones[ r.idx + i ].quaternion.copy( r.curG[i] );
            bones[ l.idx + i ].quaternion.copy( l.curG[i] );
        }
        this._updateLocationMotions( dt, this.rightHandChain, this.rightLocationMotions );
        this._updateLocationMotions( dt, this.leftHandChain, this.leftLocationMotions );

        
        // ADD twist to elbow (twist before swing scheme). Overwrite wrist (put only twist)
        this.palmor.update( dt );
        r = this.palmor.right;
        l = this.palmor.left;
        bones[ r.idx ].quaternion.multiply( r.curG[0] ); // elbow
        bones[ l.idx ].quaternion.multiply( l.curG[0] );
        bones[ r.idx + 1 ].quaternion.copy( r.curG[1] ); // wrist
        bones[ l.idx + 1 ].quaternion.copy( l.curG[1] );

        // extfidir - ADD only swing (twist before swing scheme)
        this.extfidir.update(dt);
        r = this.extfidir.right;
        l = this.extfidir.left;
        bones[ r.idx ].quaternion.premultiply( r.curG );
        bones[ l.idx ].quaternion.premultiply( l.curG );


        // overwrite finger rotations
        this.handShapeRealizer.update( dt );
        this.rightFingerplay.update(dt);
        bones[37].quaternion.premultiply( this.rightFingerplay.pinky );
        bones[41].quaternion.premultiply( this.rightFingerplay.ring );
        bones[45].quaternion.premultiply( this.rightFingerplay.middle );
        bones[49].quaternion.premultiply( this.rightFingerplay.index );
        this.leftFingerplay.update(dt);
        bones[29].quaternion.premultiply( this.leftFingerplay.pinky );
        bones[25].quaternion.premultiply( this.leftFingerplay.ring );
        bones[21].quaternion.premultiply( this.leftFingerplay.middle );
        bones[17].quaternion.premultiply( this.leftFingerplay.index );

    }

    newGesture( bml ){
        if ( bml.locationArm ){
            this.locationArm.newGestureBML( bml );
        }
        if ( bml.motion ){
            // debug
            this.color = Math.floor( Math.random() * 0xffffff );

            let left = null; let right = null;
            if ( bml.motion == "fingerplay"){ left = this.leftFingerplay; right = this.rightFingerplay; }
            else if ( bml.motion == "directed"){ left = this.leftLocationMotions[0]; right = this.rightLocationMotions[0]; }
            else if ( bml.motion == "circular"){ left = this.leftLocationMotions[1]; right = this.rightLocationMotions[1]; }
            // missing wrist motion

            if ( left && ( bml.hand == "left" || bml.hand == "both" ) ){ left.newGestureBML( bml ); }
            if ( right && ( bml.hand != "left" ) ){ right.newGestureBML( bml ); }
        }
        if ( bml.palmor ){
            this.palmor.newGestureBML( bml );
        }
        if ( bml.extfidir ){
            this.extfidir.newGestureBML( bml );
        }
        if ( bml.handshape ){
            this.handShapeRealizer.newGestureBML( bml );
        }
        
    }

    _ikCreateChains( effectorName, rootName ) {
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
        if ( !effector || !root ) { return; }

        let chain = []
        let bone = effector;
        while ( true ) {
            let i = bones.indexOf( bone );
            if ( i < 0 ) { console.warn( "IK chain: Skeleton root was reached before chain root " ); break; }

            chain.push( i );

            if ( bone == root ) { break; }
            bone = bone.parent;
        }

        effector = bones[ chain[ 0 ] ];
        while ( effector != root ) {
            if ( !this.ikSolver.getChain( effector.name ) ) {
                this.ikSolver.createChain( chain, null, this.ikTarget, effector.name );
            }
            chain.splice( 0, 1 );
            effector = bones[ chain[ 0 ] ];
        }
    }
}


export { GestureManager };


