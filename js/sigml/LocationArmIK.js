import { CCDIKSolver, FABRIKSolver } from "./IKSolver.js";
import * as THREE from 'three';

let DEG2RAD = Math.PI / 180;

let E_HANDEDNESS = { RIGHT: 1, LEFT: 2, BOTH: 3 };

// Description of sigml points supported. Commented are the original tags (from ngt sigml file specification). The uncommented are our proposal (which tries to simplify and combine the "sides" tag)
let testPoints = { 
    // headtop
    headtop : null,

    // head,
    // forehead,
    forehead : null,

    // eyebrows,
    // eyes,
    // uppereyelid,
    // lowereyelid,
    eyesL : null,
    eyesR : null,

    // nose
    nose : null,
    
    // nostrils,
    // upperlip,
    upperlip : null,

    // lips,
    // lowerlip,
    // tongue,
    // teeth,
    // upperteeth,
    // lowerteeth,
    mouth: null,

    // chin,
    // underchin,
    chin : null,
   
    // ear,
    // earlobe,
    earL : null,
    earR : null,
    
    // cheek
    cheekL : null,
    cheekR : null,
    
    // neck
    neck : null,
    
    // shoulders,
    // shouldertop,
    shouldersL : null,
    shouldersR : null,

    // chest
    chest : null,
    
    // stomach
    stomach : null,
    
    // belowstomach
    belowstomach : null,
    
}

let ikNearPoints = {
    headtop:        [ 5, "mixamorig_Head", [-0.603,18.172,6.527 ] ],
    forehead:       [ 5, "mixamorig_Head", [-0.603,9.672,13.027 ] ],
    eyesL:          [ 5, "mixamorig_Head", [2.897,-6.328,14.027 ] ],
    eyesR:          [ 5, "mixamorig_Head", [-3.103,-6.328,14.027 ] ],
    nose:           [ 5, "mixamorig_Head", [-0.103,-8.328,16.527 ] ],
    upperlip:       [ 5, "mixamorig_Head", [-0.103,-9.828,15.527 ] ],
    mouth:          [ 5, "mixamorig_Head", [-0.103,-11.328,15.527 ] ],
    chin:           [ 5, "mixamorig_Head", [-0.103,-13.328,15.527 ] ],
    cheekL:         [ 5, "mixamorig_Head", [6.397,-9.328,13.527 ] ],
    cheekR:         [ 5, "mixamorig_Head", [-6.603,-9.328,13.527 ] ],
    earL:           [ 5, "mixamorig_Head", [11.397,-1.828,1.027 ] ],
    earR:           [ 5, "mixamorig_Head", [-11.603,-1.828,1.027 ] ],
    neck:           [ 4, "mixamorig_Neck", [-0.122,-3.260,12.487 ] ],
    chest:          [ 3, "mixamorig_Spine2", [0.594,5.342,16.195 ] ],
    stomach:        [ 2, "mixamorig_Spine1", [0.570,1.924,15.650 ] ],
    belowstomach:   [ 0, "mixamorig_Hips", [0.515,-4.977,21.683 ] ],
    shouldersL:     [ 9, "mixamorig_LeftShoulder", [-8.709,1.984,2.406 ] ],
    shouldersR:     [ 33, "mixamorig_RightShoulder", [6.693,0.155,6.431 ] ],
}

let ikFarPoints = {
    headtop:        [ 5, "mixamorig_Head", [0.397,47.172,1.027 ] ],
    forehead:       [ 5, "mixamorig_Head", [0.397,9.672,61.527 ] ],
    eyesL:          [ 5, "mixamorig_Head", [2.397,4.672,62.027 ] ],
    eyesR:          [ 5, "mixamorig_Head", [-0.603,4.672,62.027 ] ],
    nose:           [ 5, "mixamorig_Head", [-0.603,-2.328,62.027 ] ],
    upperlip:       [ 5, "mixamorig_Head", [-0.603,-4.328,62.027 ] ],
    mouth:          [ 5, "mixamorig_Head", [-0.603,-5.828,62.027 ] ],
    chin:           [ 5, "mixamorig_Head", [-0.603,-9.328,62.027 ] ],
    cheekR:         [ 5, "mixamorig_Head", [-6.603,-2.828,69.527 ] ],
    cheekL:         [ 5, "mixamorig_Head", [10.397,-2.828,69.527 ] ],
    earL:           [ 5, "mixamorig_Head", [17.397,-1.328,69.527 ] ],
    earR:           [ 5, "mixamorig_Head", [-4.603,-1.328,69.527 ] ],
    neck:           [ 4, "mixamorig_Neck", [5.378,-0.760,69.987 ] ],
    chest:          [ 3, "mixamorig_Spine2", [5.086,3.842,68.196 ] ],
    stomach:        [ 2, "mixamorig_Spine1", [5.064,-10.076,53.151 ] ],
    belowstomach:   [ 0, "mixamorig_Hips", [4.996,-9.994,40.183 ] ],
    shouldersL:     [ 9, "mixamorig_LeftShoulder", [-62.191,-2.957,21.126 ] ],
    shouldersR:     [ 33, "mixamorig_RightShoulder", [-2.307,-5.265,65.332 ] ],
}

class LocationArmIK {
    constructor( character ) {
        this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                this.skeleton = o.skeleton;
            }
        } );
        this.ikSolver = new CCDIKSolver( this.skeleton );
        this.ikTarget = { position: new THREE.Vector3(0,0,2) }; // worldposition
        this._ikCreateChains( "LeftHand", "LeftShoulder" );
        this._ikCreateChains( "RightHand", "RightShoulder" );
        this.ikSolver.constraintsEnabler = false;
        this.ikSolver.setChainEnablerAll(false);

        this.right = {  
            t: 0, // current time of transition
            d: 0, // duration of gesture transition
            g: [null, null], // [0] source gesture, [1] target gesture
            chain: this.ikSolver.getChain("mixamorig_RightHand") // chain reference. Used to quickly enable/disable for prediction and to copy/set quaternions
        }
        this.left = {   
            t: 0, // current time of transition
            d: 0, // duration of gesture transition
            g: [null, null], // [0] source gesture, [1] target gesture
            chain: this.ikSolver.getChain("mixamorig_LeftHand") // chain reference. Used to quickly enable/disable for prediction and to copy/set quaternions
        }

    }

    reset(){}

    update( dt ){
        this.updateArm( dt, this.right );
        this.updateArm( dt, this.left );
    }
    

    updateArm( dt, arm ){
        if ( !arm.g[1] ){ return; }
        
        arm.t += dt;
        let t = arm.t / arm.d;
        if ( t > 1){ t = 1; }
        t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

        let chain = arm.chain.chain;
        let bones = this.skeleton.bones;   
        for( let i = 1; i < chain.length; ++i ){
            bones[chain[i]].quaternion.slerpQuaternions( arm.g[0][i-1], arm.g[1][i-1], t );
        }     
        
        if ( arm.t >= arm.d ){ arm.g[0] = arm.g[1]; arm.g[1] = null; }
    }


    newGestureBML( bml ) {

        // distance: touch vs far
        let distance = bml.distance;
        if ( isNaN(distance) ){ distance = 0; }

        let near = ikNearPoints[ bml.locationArm ];
        let far = ikFarPoints[ bml.locationArm ];
        if ( !near || !far ){
            console.warn( "Gesture: Location Arm no location found with name \"" + bml.locationArm + "\"" );
            return;
        }

        this.ikTarget.position.x = near[2][0] * (1.0 - distance) + far[2][0] * distance; 
        this.ikTarget.position.y = near[2][1] * (1.0 - distance) + far[2][1] * distance; 
        this.ikTarget.position.z = near[2][2] * (1.0 - distance) + far[2][2] * distance; 
        let wpos = this.skeleton.bones[ near[0] ].localToWorld( this.ikTarget.position );

        // compute duration of transitoin
        let duration = bml.end - bml.start;
        if ( !duration || duration < 0 ){
            console.warn( "Gesture: Location Arm negative duration value. The end time must be bigger than the start time" );
            return;
        }

        // arm tomove
        let handedness = E_HANDEDNESS.RIGHT; // default hand
        if ( bml.hand == "left" ){ handedness = E_HANDEDNESS.LEFT; }
        else if ( bml.hand == "both" ){ handedness = E_HANDEDNESS.BOTH; }

        // actual gesture 
        if ( handedness & E_HANDEDNESS.RIGHT ){ this.newGesture( wpos, duration, this.right ); }
        if ( handedness & E_HANDEDNESS.LEFT ){ this.newGesture( wpos, duration, this.left ); }
    }

    newGesture( wpos, duration = 1, arm = null ) {
        if ( arm != this.left ){ arm = this.right; } // default right arm

        let chain = arm.chain.chain;
        let bones = this.skeleton.bones;
        let tgPose = [];
        let srcPose = [];

        // copy current pose as source pose. First entry in change is end effector, no relevant for rotation state
        for( let i = 1; i < chain.length; ++i ){
            srcPose.push( bones[chain[i]].quaternion.clone() );
        }

        // compute target pose
        arm.chain.enabler = true;
        if ( wpos.x ){ this.ikTarget.position.copy(wpos); }
        else{ this.ikTarget.position.set(wpos[0],wpos[1],wpos[2]); }
        this.ikSolver.setIterations(10);
        this.ikSolver.update();
        arm.chain.enabler = false;


        // clone resulting target pose and copy back the original pose
        for( let i = 1; i < chain.length; ++i ){
            tgPose.push( bones[chain[i]].quaternion.clone() );
            bones[chain[i]].quaternion.copy( srcPose[i-1] );
        }

        arm.g[0] = srcPose;
        arm.g[1] = tgPose;
        arm.t = 0;
        arm.d = duration;
// TODO: take into account (somehow) the velocity of the previous movement, so the change will not be so sudden. Maybe use splines with quaternions??? 

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
        let constraints = [];
        let bone = effector;
        while ( true ) {
            let i = bones.indexOf( bone );
            if ( i < 0 ) { console.warn( "IK chain: Skeleton root was reached before chain root " ); break; }

            chain.push( i );


            let sign = bone.name.includes( "Left" ) ? 1 : ( -1 );

            if ( bone.name.includes( "Shoulder" ) ) { // clavicula
            /*Left */ if ( sign > 0 ) { constraints.push( { type: 2, axis: [ 0, 0, 1 ], polar: [ 0, 35 * DEG2RAD ], azimuth: [ 60 * DEG2RAD, 180 * DEG2RAD ], twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } ); }
            /*Right*/ else { constraints.push( { type: 2, axis: [ 0, 0, 1 ], polar: [ 0, 35 * DEG2RAD ], azimuth: [ 0 * DEG2RAD, 120 * DEG2RAD ], twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } ); }
            }
            else if ( bone.name.includes( "ForeArm" ) ) { // forearm/elbow
                constraints.push( { type: 1, axis: [ 1, sign * 1, 0 ], min: ( 30 * DEG2RAD ), max: ( 180 * DEG2RAD ), twist: [ 290 * DEG2RAD, 90 * DEG2RAD ] } );
            }
            else if ( bone.name.includes( "Arm" ) ) { // actual shoulder
                constraints.push({ type: 2, axis:[ sign * (-0.9),-0.8,1], polar:[0, 80 * DEG2RAD ], azimuth:[ 0 * DEG2RAD, 359.999 * DEG2RAD ], twist:[ -90 * DEG2RAD, 45 * DEG2RAD ] });
            }
            else if ( bone.name.includes( "Pinky" ) || bone.name.includes( "Ring" ) || bone.name.includes( "Middle" ) || bone.name.includes( "Index" ) ) {
                if ( bone.name.includes( "2" ) ) { constraints.push( { type: 1, axis: [ -1, 0, 0 ], min: ( 240 * DEG2RAD ), max: ( 360 * DEG2RAD ), twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } ); }
                else { constraints.push( { type: 1, axis: [ -1, 0, 0 ], min: ( 270 * DEG2RAD ), max: ( 360 * DEG2RAD ), twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } ); }
            }
            else if ( bone.name.includes( "Thumb" ) ) {
                if ( bone.name.includes( "1" ) ) { constraints.push( { type: 1, axis: [ -0.2, sign * ( -1 ), 0 ], min: ( 310 * DEG2RAD ), max: ( 10 * DEG2RAD ), twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } ); }
                else { constraints.push( { type: 1, axis: [ -0.2, sign * ( -1 ), 0 ], min: ( 280 * DEG2RAD ), max: ( 360 * DEG2RAD ), twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } ); }
            }
            else if ( bone.name.includes( "Hand" ) ) { // fingers are tested before
            /*Left */ if ( sign > 0 ) { constraints.push( { type: 2, axis: [ 0, -1, 0 ], polar: [ 25 * DEG2RAD, 155 * DEG2RAD ], azimuth: [ 60 * DEG2RAD, 140 * DEG2RAD ], twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } ); }
            /*Right*/ else { constraints.push( { type: 2, axis: [ 0, -1, 0 ], polar: [ 25 * DEG2RAD, 155 * DEG2RAD ], azimuth: [ 45 * DEG2RAD, 125 * DEG2RAD ], twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } ); }
            }

            else if ( bone.name.includes( "Head" ) ) { // headEnd will not have constraint. It is ignored during the createChain
                // set the same constraint space regardless of different bind bones
                if ( effectorName.includes( "Eye" ) ) { constraints.push( { type: 2, axis: [ 0, 0.5, 1 ], polar: [ 0, 60 * DEG2RAD ], azimuth: [ 185 * DEG2RAD, 345 * DEG2RAD ], twist: [ -45 * DEG2RAD, 45 * DEG2RAD ] } ); }
                else { constraints.push( { type: 2, axis: [ 0, 0.5, 1 ], polar: [ 0, 60 * DEG2RAD ], azimuth: [ 225 * DEG2RAD, 315 * DEG2RAD ], twist: [ -67 * DEG2RAD, 67 * DEG2RAD ] } ); }
            }
            else if ( bone.name.includes( "Neck" ) ) {
                constraints.push( { type: 2, axis: [ 0, 0.6, 1 ], polar: [ 0, 68 * DEG2RAD ], azimuth: [ 210 * DEG2RAD, 330 * DEG2RAD ], twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } );
            }
            else if ( bone.name.includes( "Spine" ) ) {
                constraints.push( { type: 2, axis: [ 0, -0.2, 1 ], polar: [ 0, 45 * DEG2RAD ], azimuth: [ 35 * DEG2RAD, 135 * DEG2RAD ], twist: [ -30 * DEG2RAD, 30 * DEG2RAD ] } );
            }

            else if ( bone.name.includes( "UpLeg" ) ) { //leg-hip
            /*Left */ if ( sign > 0 ) { constraints.push( { type: 2, axis: [ 0, 1, 0 ], polar: [ 40 * DEG2RAD, 123 * DEG2RAD ], azimuth: [ 160 * DEG2RAD, 300 * DEG2RAD ], twist: [ -45 * DEG2RAD, 45 * DEG2RAD ] } ); }
            /*Right*/ else { constraints.push( { type: 2, axis: [ -1, 0.7, 0 ], polar: [ 40 * DEG2RAD, 123 * DEG2RAD ], azimuth: [ -30 * DEG2RAD, 112 * DEG2RAD ], twist: [ -45 * DEG2RAD, 45 * DEG2RAD ] } ); }
            }
            else if ( bone.name.includes( "Leg" ) ) { // knee
                constraints.push( { type: 1, axis: [ 1, 0, 0 ], min: ( 40 * DEG2RAD ), max: ( 180 * DEG2RAD ), twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } );
            }
            else if ( bone.name.includes( "Foot" ) ) { // ankle
                constraints.push( { type: 2, axis: [ 0, -1, 0 ], polar: [ 35 * DEG2RAD, 116 * DEG2RAD ], azimuth: [ 62 * DEG2RAD, 115 * DEG2RAD ], twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } );
            }
            else if ( bone.name.includes( "ToeBase" ) ) { // toe articulation
                constraints.push( { type: 1, axis: [ 1, 0, 0 ], min: ( 145 * DEG2RAD ), max: ( 190 * DEG2RAD ), twist: [ 0 * DEG2RAD, 0.001 * DEG2RAD ] } );
            }
            else {
                constraints.push( null );
            }

            if ( bone == root ) { break; }
            bone = bone.parent;
        }

        effector = bones[ chain[ 0 ] ];
        constraints[ 0 ] = null;
        while ( effector != root ) {
            if ( !this.ikSolver.getChain( effector.name ) ) {
                this.ikSolver.createChain( chain, constraints, this.ikTarget, effector.name );
            }
            chain.splice( 0, 1 );
            constraints.splice( 0, 1 );
            effector = bones[ chain[ 0 ] ];
        }
    }

    
}

export { LocationArmIK };