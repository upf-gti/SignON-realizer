import * as THREE from 'three';
import { Quaternion, Vector3 } from 'three';
import { mirrorQuatSelf } from './sigmlUtils.js';

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
    eyeL : null,
    eyeR : null,

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
    shoulderL : null,
    shoulderR : null,

    // chest
    chest : null,
    
    // stomach
    stomach : null,
    
    // belowstomach
    belowstomach : null,
    
}

// from right arm perspective
// [ ShoulderBack, Shoulder, Elbow ]
let nearPoses = {
    neutral:        [ 0.025, -0.700, 0.037, 0.712,0.546, 0.182, -0.046, 0.817,0.281, 0.341, -0.008, 0.897 ],

    headtop:        [-0.176,-0.723,-0.231,0.627,   -0.23,0.068,0.364,0.900,   -0.29,0.682,0.229,0.631 ],
    forehead:       [0,-0.733,0.000,0.681,   -0.115,0.608,0.122,0.776,   -0.306,0.722,0.208,0.584 ],
    eyeL:          [-0.105,-0.716,-0.135,0.677,   0.353,0.812,0.056,0.461,   -0.249,0.801,0.238,0.490 ],
    eyeR:          [-0.086,-0.741,-0.113,0.656,   0.392,0.737,0.065,0.546,   -0.262,0.851,0.194,0.412 ],
    nose:           [-0.152,-0.645,-0.184,0.726,   0.502,0.707,0.065,0.494,   -0.266,0.865,0.179,0.385 ],
    upperlip:       [-0.02,-0.745,-0.028,0.666,   -0.111,-0.649,0.027,-0.752,   -0.33,0.782,0.170,0.500 ],
    mouth:          [-0.002,-0.715,0.001,0.700,   -0.128,-0.650,0.081,-0.745,   -0.33,0.782,0.170,0.500 ],
    chin:           [-0.038,-0.756,-0.053,0.651,   -0.219,-0.715,0.149,-0.647,   -0.339,0.804,0.155,0.464 ],
    cheekL:         [-0.031,-0.728,-0.039,0.684,   -0.155,-0.902,0.040,-0.400,   -0.237,0.755,0.271,0.548 ],
    cheekR:         [-0.016,-0.517,0.013,0.856,   0.304,0.632,0.181,0.689,   -0.307,0.867,0.143,0.365 ],
    earL:           [-0.018,-0.495,0.014,0.869,   -0.145,-0.834,0.053,-0.530,   -0.245,0.786,0.249,0.511 ],
    earR:           [-0.016,-0.517,0.013,0.856,   0.304,0.632,0.181,0.689,   -0.28,0.910,0.119,0.280 ],
    neck:           [-0.016,-0.727,-0.020,0.687,   -0.347,-0.683,0.169,-0.621,   -0.268,0.875,0.168,0.366 ],
    chest:          [0.098, -0.768, 0.118, 0.622,0.448, 0.262, 0.013, 0.855,0.325, 0.843, -0.016, 0.428 ],
    stomach:        [ 0.054, -0.709, 0.073, 0.699,0.529, 0.093, -0.049, 0.842,0.225, 0.803, -0.019, 0.551],
    belowstomach:   [-0.111,-0.524,-0.112,0.837,   -0.419,-0.516,0.527,-0.529,   -0.253,0.591,0.269,0.717 ],
    shoulderL:     [ -0.052,-0.559,-0.040,0.827,  -0.237,-0.633,0.250,-0.694,  -0.260,0.848,0.198,0.417 ],
    shoulderR:     [ -0.026,-0.749,-0.036,0.661,  -0.590,-0.402,0.253,-0.652,  0.689,-0.668,0.072,-0.272 ],    

    loc3mid: [0.032, -0.652, 0.055, 0.755,0.494, 0.135, 0.015, 0.859,-0.731, 0.596, -0.076, 0.323],

}

let farPoses = {
    neutral:      new Vector3( 0,1.8,1),    
    headtop:      new Vector3( 0,1.8,1),    
    forehead:     new Vector3( 0,1.8,1), 
    eyeL:         new Vector3( 0,1.8,1),  
    eyeR:         new Vector3( 0,1.8,1),  
    nose:         new Vector3( 0,1.8,1),  
    upperlip:     new Vector3( 0,1.8,1),  
    mouth:        new Vector3( 0,1.8,1),   
    chin:         new Vector3( 0,1.8,1), 
    cheekR:       new Vector3( 0,1.8,1),  
    cheekL:       new Vector3( 0,1.8,1),   
    earL:         new Vector3( 0,1.8,1),  
    earR:         new Vector3( 0,1.8,1),   
    neck:         new Vector3( 0,1.8,1),  
    chest:        new Vector3( 0,1.8,1),  
    stomach:      new Vector3( 0,1.8,1),
    belowstomach: new Vector3( 0,1.8,1), 
    shoulderL:    new Vector3( 0,1.8,1), 
    shoulderR:    new Vector3( 0,1.8,1), 
    loc3mid:      new Vector3( 0,1.8,1), 
}

let sides = {
    'u'     : (new Vector3(  0,   1,   0 )).normalize(),   
    'ul'    : (new Vector3(  1,   1,   0 )).normalize(),   
    'l'     : (new Vector3(  1,   0,   0 )).normalize(),   
    'dl'    : (new Vector3(  1,  -1,   0 )).normalize(),   
    'd'     : (new Vector3(  0,  -1,   0 )).normalize(),   
    'dr'    : (new Vector3( -1,  -1,   0 )).normalize(),  
    'r'     : (new Vector3( -1,   0,   0 )).normalize(),  
    'ur'    : (new Vector3( -1,   1,   0 )).normalize(),  

    "uo"    : (new Vector3(  0,   1,   1 )).normalize(),
    "uol"   : (new Vector3(  1,   1,   1 )).normalize(),
    "ol"    : (new Vector3(  1,   0,   1 )).normalize(),
    "dol"   : (new Vector3(  1,  -1,   1 )).normalize(),
    "do"    : (new Vector3(  0,  -1,   1 )).normalize(),
    "dor"   : (new Vector3( -1,  -1,   1 )).normalize(),
    "or"    : (new Vector3( -1,   0,   1 )).normalize(),
    "uor"   : (new Vector3( -1,   1,   1 )).normalize(),
    "o"     : (new Vector3(  0,   0,   1 )).normalize(),
    
    "ui"    : (new Vector3(  0,   1,  -1 )).normalize(),
    "uil"   : (new Vector3(  1,   1,  -1 )).normalize(),
    "il"    : (new Vector3(  1,   0,  -1 )).normalize(),
    "dil"   : (new Vector3(  1,  -1,  -1 )).normalize(),
    "di"    : (new Vector3(  0,  -1,  -1 )).normalize(),
    "dir"   : (new Vector3( -1,  -1,  -1 )).normalize(),
    "ir"    : (new Vector3( -1,   0,  -1 )).normalize(),
    "uir"   : (new Vector3( -1,   1,  -1 )).normalize(),
    "i"     : (new Vector3(  0,   0,  -1 )).normalize(),
}

function shapesToQuaternions( shapes ){
    let o = {}
    let keys = Object.keys( shapes );

    function floatArrayToQuatArray ( array ){
        let arrayQuat = [];
        let arrayQuatLength = Math.floor( (array.length + 0.5) / 4 ); // +0.5 to avoid floating errors, just in case...

        for( let i = 0; i < arrayQuatLength; ++i ){
            let q = new THREE.Quaternion();
            q.fromArray( array, i * 4 );
            q.normalize();
            arrayQuat.push( q );
        }
        return arrayQuat;
    }


    for ( let i = 0; i < keys.length; ++i ){
        if ( shapes[ keys[i] ].length > 0 ){
            o[keys[i]] = floatArrayToQuatArray( shapes[ keys[i] ] ); 
        }
    }

    return o;
}

// transform tables into THREE.Quaternions
nearPoses = shapesToQuaternions( nearPoses );


class LocationArmIK {
    constructor( skeleton, shoulderIndex, ikSolver, chain ) {
        this.skeleton = skeleton;
        this.ikSolver = ikSolver;
        this.chainInfo = chain;

        this.idx = shoulderIndex;

        // three bones: shoulder (back), actual shoulder, elbow
        this.defG = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]; // default gesture
        this.srcG = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]; // source gesture
        this.trgG = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]; // target gesture
        this.curG = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]; // target gesture

        this.time = 0; // current time of transition

        this.start = 0; 
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        
        this.transition = false;

        // set default poses
        this.reset();
    }

    reset(){
        this.transition = false;
        this.curG[0].copy( nearPoses.neutral[0] );
        this.curG[1].copy( nearPoses.neutral[1] );
        this.curG[2].copy( nearPoses.neutral[2] );

        this.defG[0].copy( nearPoses.neutral[0] );
        this.defG[1].copy( nearPoses.neutral[1] );
        this.defG[2].copy( nearPoses.neutral[2] );
    }

    update( dt ){
        // nothing to do
        if ( !this.transition ){ return; } 
        
        this.time += dt;
        
        // wait in same pose
        if ( this.time < this.start ){ return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ 
            for( let i = 0; i < 3 ; ++i ){
                this.curG[i].copy( this.trgG[i] );
            }
            return; 
        }
        
        // move to default pose and end
        if ( this.time > this.end ){ 
            for( let i = 0; i < 3 ; ++i ){
                this.curG[i].copy( this.defG[i] );
            }
            this.transition = false; // flag as "nothing to do"
            return; 
        }

        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            // shouldar (back), actual shoulder, elbow
            for( let i = 0; i < 3 ; ++i ){
                this.curG[i].slerpQuaternions( this.srcG[i], this.trgG[i], t ); // expensive but finds correct path
                //nlerpQuats( this.curG[i], this.srcG[i], this.trgG[i], t ); // cheaper but does not find correct path
            }     
            return;
        }

        if ( this.time >= this.relax ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            // shouldar (back), actual shoulder, elbow
            for( let i = 0; i < 3 ; ++i ){
                this.curG[i].slerpQuaternions( this.trgG[i], this.defG[i], t ); // expensive but finds correct path
                //nlerpQuats( this.curG[i], this.trgG[i], this.defG[i], t ); // cheaper  but does not find correct path
            }     
        }
    }


    /**
     * bml info
     * start, attackPeak, relax, end
     * locationArm: string from nearPoses
     * distance: (optional) [0,1] how far from the body to locate the hand. 0 = close, 1 = arm extended
     * side: (optional) string from sides table. Location will offset into that direction
     * sideDistance: (optional) [0,1] how far to move the indicate side. 0 = no offset, 1 = full offset 
     * hand: (optional) "right", "left", "both". Default right
     * sym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
     * shift: (optional) bool - make this the default position
     */
    newGesture( bml, mirror = false, symmetry = false ) {
        // distance: touch vs far
        let distance = isNaN( bml.distance ) ? 0 : bml.distance;

        let location = bml.locationArm;

        // for mirror - with left arm, to point right shoulder the "shoulderL" is needed, and then quaternions must be mirrored
        // for symmetry - the left and right must be swapped wanted
        // not only quaternions are mirrored. The left/right actions need to be swapped. All actions are from right arm's perspective
        if ( (mirror ^ symmetry) && location ){ 
            if ( location[location.length-1] == "L" ){
                location = location.slice(0, location.length-1) + "R";
            } 
            else if( location[location.length-1] == "R" ){
                location = location.slice(0, location.length-1) + "L";
            } 
        }
        
        let near = nearPoses[ location ];
        let far = farPoses[ location ];
        if ( !near || !far ){
            console.warn( "Gesture: Location Arm no location found with name \"" + location + "\"" );
            return;
        }

        // Set target and source poses AND prepare skeleton for ik
        for ( let i = 0; i < near.length; ++i ){
            // source: Copy current arm state
            this.srcG[i].copy( this.curG[i] );

            // target (reference)
            this.trgG[i].copy( near[i] );
            
            // mirror target quaternion. (left arm cannot use right arms Quaternions as they are)
            if ( mirror ){ 
                mirrorQuatSelf( this.trgG[i] );
            }

            // IK - copy nearTarget into bone quaternions
            this.skeleton.bones[ this.idx + i ].quaternion.copy( this.trgG[i] ); 
        }

        // set ikTarget as lerp( nearPoint, farPoint, distance ) + side
        let pos = new Vector3(0,0,0);
        this.skeleton.bones[ this.chainInfo.chain[0] ].getWorldPosition( pos )
        this.chainInfo.target.position.x = pos.x * (1-distance) + far.x * distance;
        this.chainInfo.target.position.y = pos.y * (1-distance) + far.y * distance;
        this.chainInfo.target.position.z = pos.z * (1-distance) + far.z * distance;

        let side = sides[ bml.side ];
        if ( side ){
            let sideDist = isNaN( bml.sideDistance ) ? 0 : bml.sideDistance;
            this.chainInfo.target.position.x += side.x * sideDist;
            this.chainInfo.target.position.y += side.y * sideDist;
            this.chainInfo.target.position.z += side.z * sideDist;
        }

        // Actual IK
        this.chainInfo.enabler = true;
        this.ikSolver.setIterations( 4 );
        this.ikSolver.update();
        this.chainInfo.enabler = false;

        // Save IK results
        for ( let i = 0; i < near.length; ++i ){
            // copy results into target
            this.trgG[i].copy( this.skeleton.bones[ this.idx + i ].quaternion );
            
            // copy src (current quaternions) into bone quaternions
            this.skeleton.bones[ this.idx + i ].quaternion.copy( this.srcG[i] );
                        
            // copy src into curG (just in case)
            this.curG[i].copy( this.srcG[i] ); 

            // change arm's default pose if necesary
            if ( bml.shift ){
                this.defG[i].copy( this.trgG[i] );
            }
        }

        // check and set timings
        this.time = 0;
        this.start = bml.start || 0;
        this.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        this.attackPeak = bml.attackPeak || ( (this.end - this.start) * 0.25 + this.start );
        this.relax = bml.relax || ( (this.end - this.attackPeak) * 0.5 + this.attackPeak );
        this.transition = true;
    }   
}


class LocationArmManager {
    constructor( skeleton, ikSolver ){
        this.skeleton = skeleton;
        let bones = this.skeleton.bones;
        for( let i = 0; i < bones.length; ++i ){
            if ( bones[i].name.includes("RightShoulder") ){ this.rIdx = i; }
            else if ( bones[i].name.includes("LeftShoulder") ){ this.lIdx = i; }
        }

        this.right = new LocationArmIK( skeleton, this.rIdx, ikSolver, ikSolver.getChain("RightShoulder"));
        this.left = new LocationArmIK( skeleton, this.lIdx, ikSolver, ikSolver.getChain("LeftShoulder"));
    }

    reset(){
        this.right.reset();
        this.left.reset();
    }

    update( dt ){
        this.right.update(dt);
        this.left.update(dt);
    }

    newGestureBML( bml ) {
        // arm to move
        let handedness = E_HANDEDNESS.RIGHT; // default hand
        if ( bml.hand == "left" ){ handedness = E_HANDEDNESS.LEFT; }
        else if ( bml.hand == "both" ){ handedness = E_HANDEDNESS.BOTH; }

        // actual gesture 
        if ( handedness & E_HANDEDNESS.RIGHT ){ this.right.newGesture( bml, false, false ); }
        if ( handedness & E_HANDEDNESS.LEFT ){ this.left.newGesture( bml, true, !!bml.sym ); }
    }
}


let nearArmPosesTable = nearPoses;
export { LocationArmIK, LocationArmManager, nearArmPosesTable };