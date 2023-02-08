import { CCDIKSolver } from "./IKSolver.js";
import * as THREE from 'three';
import { Quaternion } from "three";

let DEG2RAD = Math.PI / 180;

class LocationArm {
    constructor( character ) {
        this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                this.skeleton = o.skeleton;
            }
        } );
        this.ikSolver = new CCDIKSolver( this.skeleton );
        this.ikTarget = { position: new THREE.Vector3(0,0,2) };

        this._ikCreateChains( "LeftHand", "LeftShoulder" );
        this._ikCreateChains( "RightHand", "RightShoulder" );

        this.ikSolver.setChainEnablerAll(false);


        this.rightBoneIdxs = 0;
        this.leftBoneIdxs = 0;
        
        this.boneIdxs = this.rightBoneIdxs;

        let bones = this.skeleton.bones;
        for( let i = 0; i < bones.length; ++i ){
            if ( bones[i].name.includes("RightShoulder") ){ this.rightBoneIdxs = i; }
            else if ( bones[i].name.includes("LeftShoulder") ){ this.leftBoneIdxs = i; }
        }
        this.boneIdxs = this.rightBoneIdxs;

        this.hgests = []; // 0 current (init) gesture 
        this.times  = []; // timestamps
        
        this.currentTime = 0;

        this.changeChain("mixamorig_RightHand");
        this.newGesture([-10,0,0], 0.001);

        if( !window.la ){ window.la = []; }
        window.la.push(this);

    }


    newGesture(position, t = 1){
        let a = [];
        let temp = [];
        temp[0] = this.skeleton.bones[this.boneIdxs].quaternion.clone();
        temp[1] = this.skeleton.bones[this.boneIdxs+1].quaternion.clone();
        temp[2] = this.skeleton.bones[this.boneIdxs+2].quaternion.clone();

        this.ikTarget.position.set(position[0],position[1],position[2]);
        this.ikSolver.setIterations(10);
        this.ikSolver.update();

        a[0] = this.skeleton.bones[this.boneIdxs].quaternion.clone();
        a[1] = this.skeleton.bones[this.boneIdxs+1].quaternion.clone();
        a[2] = this.skeleton.bones[this.boneIdxs+2].quaternion.clone();

        this.skeleton.bones[this.boneIdxs].quaternion.copy( temp[0] );
        this.skeleton.bones[this.boneIdxs+1].quaternion.copy( temp[1] );
        this.skeleton.bones[this.boneIdxs+2].quaternion.copy( temp[2] );

        if ( this.hgests.length < 2 ){ this.currentTime = 0;}
        this.hgests.push(a);
        this.times.push(t);
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
                constraints.push( { type: 2, axis: [ sign * ( -0.9 ), -0.8, 1 ], polar: [ 0, 80 * DEG2RAD ], azimuth: [ 0 * DEG2RAD, 359.999 * DEG2RAD ], twist: [ -45 * DEG2RAD, 45 * DEG2RAD ] } );
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

    changeChain( name ){
        this.ikSolver.setChainEnablerAll( false );
        this.ikSolver.setChainEnabler( name, true );
    }

    reset(){}
    
    update( dt ){
        this.currentTime += dt;
        if ( this.hgests.length < 2 ){ return; }


        let end = false;
        let t = (this.currentTime) /  this.times[1];
        if ( t > 1){ t = 1; end = true; }
        t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

        let bones = this.skeleton.bones;        
        bones[ this.boneIdxs ].quaternion.slerpQuaternions( this.hgests[0][0], this.hgests[1][0], t );
        bones[ this.boneIdxs + 1 ].quaternion.slerpQuaternions( this.hgests[0][1], this.hgests[1][1], t );
        bones[ this.boneIdxs + 2 ].quaternion.slerpQuaternions( this.hgests[0][2], this.hgests[1][2], t );

        
        if ( end ){ this.currentTime -= this.times[1]; this.hgests.splice(0, 1); this.times.splice(0,1); }

        //this.ikSolver.update();
    }
}

export { LocationArm };