import * as THREE from 'three';
import { mirrorQuatSelf, nlerpQuats } from './sigmlUtils.js';

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
let nearPoses = {
    // neutral:        [-0.002,-0.715,0.001,0.699,  -0.646,-0.274,0.253,-0.666,  0.190,-0.211,0.041,-0.958 ],
    // neutral:        [ 0.008648105951561031, -0.7009597526473257, 0.016657660621083786, 0.7129538997854393,   0.5482493137447065, 0.28784441121950494, -0.07027172667833258, 0.7820678469381019,    0.21014202228499768, 0.18784554579376037, 0.17638575423660036, 0.9431025629095783],
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
    // chest:          [-0.041,-0.663,-0.041,0.746,   -0.549,-0.483,0.372,-0.572,   -0.256,0.833,0.212,0.442 ],
    chest:          [0.098, -0.768, 0.118, 0.622,0.448, 0.262, 0.013, 0.855,0.325, 0.843, -0.016, 0.428 ],
    // stomach:        [-0.003,-0.693,0.003,0.721,   -0.268,-0.370,0.619,-0.639,   -0.326,0.772,0.177,0.515 ],
    stomach:        [ 0.054, -0.709, 0.073, 0.699,0.529, 0.093, -0.049, 0.842,0.225, 0.803, -0.019, 0.551],
    belowstomach:   [-0.111,-0.524,-0.112,0.837,   -0.419,-0.516,0.527,-0.529,   -0.253,0.591,0.269,0.717 ],
    shoulderL:     [ -0.052,-0.559,-0.040,0.827,  -0.237,-0.633,0.250,-0.694,  -0.260,0.848,0.198,0.417 ],
    shoulderR:     [ -0.026,-0.749,-0.036,0.661,  -0.590,-0.402,0.253,-0.652,  0.689,-0.668,0.072,-0.272 ],    

    loc3mid: [0.032, -0.652, 0.055, 0.755,0.494, 0.135, 0.015, 0.859,-0.731, 0.596, -0.076, 0.323],

}

let farPoses = {
    // neutral:        [-0.002,-0.715,0.001,0.699,  -0.646,-0.274,0.253,-0.666,  0.190,-0.211,0.041,-0.958 ],
    // neutral:        [ 0.008648105951561031, -0.7009597526473257, 0.016657660621083786, 0.7129538997854393,   0.5482493137447065, 0.28784441121950494, -0.07027172667833258, 0.7820678469381019,    0.21014202228499768, 0.18784554579376037, 0.17638575423660036, 0.9431025629095783],    
    neutral:        [ 0.025, -0.700, 0.037, 0.712,0.546, 0.182, -0.046, 0.817,0.281, 0.341, -0.008, 0.897 ],

    headtop:        [-0.167,-0.768,-0.228,0.574,   -0.319,0.144,0.349,0.869,   -0.141,0.320,0.344,0.871 ],

    forehead:       [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    eyeL:          [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    eyeR:          [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    nose:           [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    upperlip:       [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    mouth:          [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    chin:           [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    cheekR:         [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    cheekL:         [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    earL:           [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],
    earR:           [-0.086,-0.510,-0.078,0.852,   0.425,-0.440,0.327,-0.720,   -0.032,0.040,0.475,0.879 ],

    neck:           [-0.058,-0.500,-0.039,0.863,    0.36,-0.536,0.316,-0.695,   -0.032,0.040,0.475,0.879 ],
    chest:          [-0.018,-0.495,0.014,0.869,     0.103,-0.599,0.319,-0.727,   -0.037,0.058,0.474,0.878 ],
    // stomach:        [-0.018,-0.495,0.014,0.869,     -0.06,-0.630,0.306,-0.711,   -0.032,0.040,0.475,0.879 ],
    // stomach:        [ 0.050, -0.793, 0.053, 0.606,0.546, 0.396, 0.249, 0.694,0.197, 0.266, -0.012, 0.943 ],
    // stomach:        [ 0.043, -0.802, 0.042, 0.594,0.589, 0.391, 0.241, 0.664,0.313, 0.266, -0.004, 0.912],
    stomach:        [  0.091, -0.697, 0.122, 0.700,0.214, 0.651, -0.023, 0.728,0.143, 0.165, -0.022, 0.975 ],
    belowstomach:   [-0.018,-0.495,0.014,0.869,     -0.281,-0.602,0.287,-0.690,   -0.032,0.040,0.475,0.879 ],
    shoulderL:     [ -0.087,-0.544,-0.084,0.830,   0.040,0.819,0.181,0.543,  -0.000,0.030,0.000,1.000 ],
    shoulderR:     [ -0.087,-0.544,-0.084,0.830,   0.083,0.412,0.200,0.885,  -0.000,0.030,0.000,1.000 ],
    loc3mid: [-0.013, -0.692, -0.010, 0.722,0.012, 0.471, -0.007, 0.882,-0.034, 0.093, -0.032, 0.995],

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
farPoses = shapesToQuaternions( farPoses );


class LocationArm {
    constructor( skeleton ) {
        this.skeleton = skeleton;

        // three bones: shoulder (back), actual shoulder, elbow
        this.right = {  
            idx: 0,
            defG: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], // default gesture
            srcG: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], // source gesture
            trgG: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], // target gesture
            curG: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], // target gesture
            t: 0, // current time of transition
            start: 0, 
            attackPeak: 0,
            relax: 0, 
            end: 0, 
            transition: false,
        }
        this.left = {   
            idx: 0,
            defG: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], // default gesture
            srcG: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], // source gesture
            trgG: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], // target gesture
            curG: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], // target gesture
            t: 0, // current time of transition
            start: 0, 
            attackPeak: 0,
            relax: 0, 
            end: 0, 
            transition: false,
        }

        let bones = this.skeleton.bones;
        for( let i = 0; i < bones.length; ++i ){
            if ( bones[i].name.includes("RightShoulder") ){ this.right.idx = i; }
            else if ( bones[i].name.includes("LeftShoulder") ){ this.left.idx = i; }
        }

        // set default poses
        this.reset();
    }

    reset(){
        this.right.transition = false;
        this.left.transition = false;
        this.newGestureBML( { start: 0, end: 0.1, locationArm: "neutral", hand: "both", shift: true } );
        this.update(100);

    }

    update( dt ){
        this.updateArm( dt, this.right );
        this.updateArm( dt, this.left );
    }
    

    updateArm( dt, arm ){
        // nothing to do
        if ( !arm.transition ){ return; } 
        
        arm.t += dt;
        
        // wait in same pose
        if ( arm.t < arm.start ){ return; }
        if ( arm.t > arm.attackPeak && arm.t < arm.relax ){ return; }
        
        // move to default pose and end
        if ( arm.t > arm.end ){ 
            for( let i = 0; i < 3 ; ++i ){
                arm.curG[i].copy( arm.defG[i] );
            }
            arm.transition = false; // flag as "nothing to do"
            return; 
        }

        if ( arm.t <= arm.attackPeak ){
            let t = ( arm.t - arm.start ) / ( arm.attackPeak - arm.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            // shouldar (back), actual shoulder, elbow
            for( let i = 0; i < 3 ; ++i ){
                arm.curG[i].slerpQuaternions( arm.srcG[i], arm.trgG[i], t ); // expensive but finds correct path
                //nlerpQuats( arm.curG[i], arm.srcG[i], arm.trgG[i], t ); // cheaper but does not find correct path
            }     
            return;
        }

        if ( arm.t >= arm.relax ){
            let t = ( arm.t - arm.relax ) / ( arm.end - arm.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            // shouldar (back), actual shoulder, elbow
            for( let i = 0; i < 3 ; ++i ){
                arm.curG[i].slerpQuaternions( arm.trgG[i], arm.defG[i], t ); // expensive but finds correct path
                //nlerpQuats( arm.curG[i], arm.trgG[i], arm.defG[i], t ); // cheaper  but does not find correct path
            }     
        }
    }


    /**
     * bml info
     * start, attackPeak, relax, end
     * locationArm: string from nearPoses
     * distance: (optional) [0,1] how far from the body to locate the hand. 0 = close, 1 = arm extended
     * hand: (optional) "right", "left", "both". Default right
     * sym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
     * shift: (optional) bool - make this the default position
     */
    newGestureBML( bml ) {
        // arm tomove
        let handedness = E_HANDEDNESS.RIGHT; // default hand
        if ( bml.hand == "left" ){ handedness = E_HANDEDNESS.LEFT; }
        else if ( bml.hand == "both" ){ handedness = E_HANDEDNESS.BOTH; }

        // actual gesture 
        if ( handedness & E_HANDEDNESS.RIGHT ){ this._newGesture( bml, this.right, false, false ); }
        if ( handedness & E_HANDEDNESS.LEFT ){ this._newGesture( bml, this.left, true, !!bml.sym ); }
    }

    _newGesture( bml, arm = null, mirror = false, symmetry = false ) {
        if ( arm != this.left ){ arm = this.right; } // default right arm

        // distance: touch vs far
        let distance = bml.distance;
        if ( isNaN(distance) ){ distance = 0; }

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

        // Set target and source poses
        for ( let i = 0; i < near.length; ++i ){
            // source: Copy current arm state
            arm.srcG[i].copy( arm.curG[i] );

            // target (reference)
            let q = arm.trgG[i];
            q.slerpQuaternions( near[i], far[i], distance ); // expensive but executed once per gesture 
            
            // mirror target quaternion. (left arm cannot use right arms Quaternions as they are)
            if ( mirror ){ 
                mirrorQuatSelf( q );
            }

            // change arm's default pose if necesary
            if ( bml.shift ){
                arm.defG[i].copy( q );
            }
        }

        // check and set timings
        arm.start = bml.start || 0;
        arm.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        arm.attackPeak = bml.attackPeak || ( (arm.end - arm.start) * 0.25 + arm.start );
        arm.relax = bml.relax || ( (arm.end - arm.attackPeak) * 0.5 + arm.attackPeak );
        arm.transition = true;
        arm.t = 0;
    }


    
}

let nearArmPosesTable = nearPoses
export { LocationArm, nearArmPosesTable };