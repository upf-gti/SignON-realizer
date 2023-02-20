import { Quaternion } from "three";
import { mirrorQuatSelf, nlerpQuats } from "./sigmlUtils.js";

/**
 * function printer ( skeleton ){
let o = {};
let bones = skeleton.bones;
o.thumb = bones[53].quaternion.toArray().concat( bones[53 + 1].quaternion.toArray().concat(bones[53 + 2].quaternion.toArray()));

o.index = bones[49].quaternion.toArray().concat( bones[49 + 1].quaternion.toArray().concat(bones[49 + 2].quaternion.toArray()));

o.middle = bones[45].quaternion.toArray().concat( bones[45 + 1].quaternion.toArray().concat(bones[45 + 2].quaternion.toArray()));

o.ring = bones[41].quaternion.toArray().concat( bones[41 + 1].quaternion.toArray().concat(bones[41 + 2].quaternion.toArray()));

o.pinky = bones[37].quaternion.toArray().concat( bones[37 + 1].quaternion.toArray().concat(bones[37 + 2].quaternion.toArray()));

console.log( JSON.stringify(o) );
}
 */

let E_HANDEDNESS = { RIGHT: 1, LEFT: 2, BOTH: 3 };

// Three bones per finger. Flat array automatically transformed into array of THREE.Quaternions
let handShapes = {
    fist: {"thumb":[0.00185,0.19497,-0.06188,0.97885,0,-0.00151,0.00001,1,0.03251,-0.14527,-0.05803,0.98715], "index":[0.69143,0.00299,-0.01208,0.72234,0.86431,-0.00004,-0.05442,0.5,0.70484,-0.00001,0.05661,0.70711], "middle":[0.70704,0.00793,-0.00943,0.70706,0.80828,-0.00006,0.04346,0.58719,0.70558,0.00003,-0.04643,0.70711], "ring":[0.66454,0.01117,0.01906,0.74693,0.74576,-0.00008,-0.03949,0.66504,0.56128,-0.00015,0.00542,0.82761], "pinky":[0.70326,-0.00713,0.02051,0.7106,0.86557,-0.00006,-0.0282,0.5,0.23531,0.0001,-0.00429,0.97191] },
    finger2: {"thumb":[0.003,0.12937,-0.10029,0.98651,0.04697,-0.1903,-0.06219,0.97863,0.04996,-0.22349,-0.08919,0.96933],"index":[0.01704,0.00414,-0.0003,0.99985,0,-0.00007,0,1,0,-0.00002,0,1],"middle":[0.70704,0.00793,-0.00943,0.70706,0.80828,-0.00006,0.04346,0.58719,0.70558,0.00003,-0.04643,0.70711],"ring":[0.66454,0.01117,0.01906,0.74693,0.74576,-0.00008,-0.03949,0.66504,0.56128,-0.00015,0.00542,0.82761],"pinky":[0.70326,-0.00713,0.02051,0.7106,0.86557,-0.00006,-0.0282,0.5,0.23531,0.0001,-0.00429,0.97191]},
    finger23: {"thumb":[0.00228,0.17073,-0.07621,0.98236,0,-0.00151,0,1,0,0.00036,0,1],"index":[0.01704,0.00414,-0.0003,0.99985,0,-0.00007,0,1,0,-0.00002,0,1],"middle":[0,0.01122,0,0.99994,0,-0.0001,0,1,0,0.00005,0.00001,1],"ring":[0.66454,0.01117,0.01906,0.74693,0.74576,-0.00008,-0.03949,0.66504,0.56128,-0.00015,0.00542,0.82761],"pinky":[0.70326,-0.00713,0.02051,0.7106,0.86557,-0.00006,-0.0282,0.5,0.23531,0.0001,-0.00429,0.97191]},
    finger23spread: {"thumb":[0.00228,0.17073,-0.07621,0.98236,0,-0.00151,0,1,0,0.00036,0,1],"index":[0.02151,0.09247,-0.00079,0.99548,0.00051,0.00091,0.00001,1,0.0028,0.04001,0.00246,0.99919],"middle":[0,0.01122,0,0.99994,0,-0.0001,0,1,0,0.00005,0.00001,1],"ring":[0.66454,0.01117,0.01906,0.74693,0.74576,-0.00008,-0.03949,0.66504,0.56128,-0.00015,0.00542,0.82761],"pinky":[0.70326,-0.00713,0.02051,0.7106,0.86557,-0.00006,-0.0282,0.5,0.23531,0.0001,-0.00429,0.97191]},
    finger2345: {"thumb":[0.00228,0.17073,-0.07621,0.98236,0,-0.00151,0,1,0,0.00036,0,1],"index":[0.02151,0.09247,-0.00079,0.99548,0.00051,0.00091,0.00001,1,0.0028,0.04001,0.00246,0.99919],"middle":[0,0.01122,0,0.99994,0,-0.0001,0,1,0,0.00005,0.00001,1],"ring":[-0.01952,-0.10147,0.01135,0.99458,0,-0.00011,0.00001,1,0,-0.00018,0,1],"pinky":[0.02546,-0.24792,0.00767,0.96842,0,-0.00011,0,1,0.00799,0.0001,-0.00015,0.99997]},
    flat: {"thumb":[0.00228,0.17073,-0.07621,0.98236,0,-0.00151,0,1,0,0.00036,0,1],"index":[0.01689,0.00414,-0.0003,0.99985,0,-0.00007,0,1,0,-0.00002,0,1],"middle":[0,0.01122,0,0.99994,0,-0.0001,0,1,0,0.00005,0,1],"ring":[0,0.01495,0,0.99989,0,-0.00011,0.00001,1,0,-0.00018,0.00001,1],"pinky":[0.05224,-0.01002,0.00152,0.99858,0,-0.00011,0,1,0,0.0001,0.00001,1]}
};

// Three bones per finger. Flat array automatically transformed into array of THREE.Quaternions
// Thumb shapes do not affect on these poses
let handShapes_2 = {
    pinch12: {"thumb":[0.00122,0.23053,-0.04064,0.97222,0.02072,-0.08478,-0.02743,0.99581,0.06553,-0.29323,-0.11697,0.94659],"index":[0.1833,0.00407,-0.0032,0.98304,0.71393,-0.00005,-0.04495,0.69877,0.23492,-0.00002,0.01887,0.97183],"middle":[0.70704,0.00793,-0.00943,0.70706,0.80828,-0.00006,0.04346,0.58719,0.70558,0.00003,-0.04643,0.70711],"ring":[0.66454,0.01117,0.01906,0.74693,0.74576,-0.00008,-0.03949,0.66504,0.56128,-0.00015,0.00542,0.82761],"pinky":[0.70326,-0.00713,0.02051,0.7106,0.86557,-0.00006,-0.0282,0.5,0.23531,0.0001,-0.00429,0.97191]},
    pinch12open: {"thumb":[0.0854,0.15087,-0.1567,0.97231,0.18997,-0.06635,-0.08639,0.97573,-0.00757,0.01697,-0.0288,0.99941],"index":[0.18156,0.00407,-0.00317,0.98337,0.42771,-0.00006,-0.02693,0.90352,0.43244,-0.00002,0.03474,0.90099],"middle":[0.70704,0.00793,-0.00943,0.70706,0.80828,-0.00006,0.04346,0.58719,0.70558,0.00003,-0.04643,0.70711],"ring":[0.66454,0.01117,0.01906,0.74693,0.74576,-0.00008,-0.03949,0.66504,0.56128,-0.00015,0.00542,0.82761],"pinky":[0.70326,-0.00713,0.02051,0.7106,0.86557,-0.00006,-0.0282,0.5,0.23531,0.0001,-0.00429,0.97191]},
    pinchall: {"thumb":[0.21932,0.34326,-0.13396,0.9034,0.17493,-0.56944,-0.23419,0.76831,0.01089,0.04191,-0.21015,0.97671],"index":[0.57181,0.03433,-0.09992,0.81355,0.47256,0.00643,-0.03801,0.88045,0.49845,-0.00002,0.04004,0.866],"middle":[0.55157,0.00936,-0.00735,0.83405,0.32168,-0.00328,0.02387,0.94654,0.68441,0.00003,-0.04503,0.72771],"ring":[0.66645,-0.09334,0.11259,0.73106,0.01533,0.0018,-0.01001,0.99983,0.70707,-0.00013,0.00682,0.70711],"pinky":[0.68427,-0.1465,0.21753,0.68044,0.28951,0.00902,-0.01961,0.95693,0.32264,0,-0.00007,0.94652]},
    ceeall: {"thumb":[0.0854,0.15087,-0.1567,0.97231,0.18997,-0.06635,-0.08639,0.97573,-0.00757,0.01697,-0.0288,0.99941],"index":[0.39385,0.00381,-0.00688,0.91914,0.21597,-0.00007,-0.0136,0.9763,0.29096,-0.00002,0.02337,0.95645],"middle":[0.45474,0.00999,-0.00606,0.89055,0.08545,-0.0001,0.0046,0.99633,0.36673,0.00004,-0.02413,0.93002],"ring":[0.41033,0.01363,0.01178,0.91176,0.11034,-0.00011,-0.00584,0.99388,0.41724,-0.00016,0.00403,0.90879],"pinky":[0.34174,-0.00944,0.00997,0.93969,0.30098,-0.00011,-0.00981,0.95358,0.37417,0.00009,-0.00681,0.92733]},
    cee12: {"thumb":[0.00122,0.23053,-0.04064,0.97222,0.02072,-0.08478,-0.02743,0.99581,0.06553,-0.29323,-0.11697,0.94659],"index":[0.1833,0.00407,-0.0032,0.98304,0.71393,-0.00005,-0.04495,0.69877,0.23492,-0.00002,0.01887,0.97183],"middle":[0.25437,0.01085,-0.00339,0.96704,0.23698,-0.0001,0.01275,0.97143,0.25102,0.00004,-0.01651,0.96784],"ring":[0.08835,0.01489,0.00254,0.99597,0.12188,-0.00011,-0.00646,0.99252,0.30521,-0.00017,0.00295,0.95228],"pinky":[0.00366,-0.01004,0.00012,0.99994,0.0225,-0.00011,-0.00073,0.99975,0.48047,0.00009,-0.00875,0.87697]},
    cee12open: {"thumb":[0.0854,0.15087,-0.1567,0.97231,0.18997,-0.06635,-0.08639,0.97573,-0.00757,0.01697,-0.0288,0.99941],"index":[0.18156,0.00407,-0.00317,0.98337,0.42771,-0.00006,-0.02693,0.90352,0.43244,-0.00002,0.03474,0.90099],"middle":[0.25437,0.01085,-0.00339,0.96704,0.23698,-0.0001,0.01275,0.97143,0.25102,0.00004,-0.01651,0.96784],"ring":[0.08835,0.01489,0.00254,0.99597,0.12188,-0.00011,-0.00646,0.99252,0.30521,-0.00017,0.00295,0.95228],"pinky":[0.00366,-0.01004,0.00012,0.99994,0.0225,-0.00011,-0.00073,0.99975,0.48047,0.00009,-0.00875,0.87697]}
};

let thumbShapes = {
    default: [0.00228,0.17073,-0.07621,0.98236,0,-0.00151,0,1,0,0.00036,0,1],
    out: [-0.0326,0.4638,0.11905,0.8773,0.08534,0.06233,0.03191,0.99389,-0.01002,-0.0688,-0.02804,0.99719],
    opposed: [0.0854,0.15087,-0.1567,0.97231,0.18997,-0.06635,-0.08639,0.97573,-0.00757,0.01697,-0.0288,0.99941],
    across: [0.00234,0.16746,-0.07812,0.98278,0.0859,-0.34673,-0.11375,0.92707,0.08401,-0.37603,-0.14996,0.91052],
    touch: [-0.17789,0.20503,-0.16839,0.94761,0,-0.00151,0,1,0.01567,-0.06983,-0.02797,0.99704] // expanded from sigml (created by ourselves)
};

function shapesToQuaternions( shapes ){
    let o = {}
    let keys = Object.keys( shapes );

    function floatArrayToQuatArray ( array ){
        let arrayQuat = [];
        let arrayQuatLength = Math.floor( (array.length + 0.5) / 4 ); // +0.5 to avoid floating errors, just in case...

        for( let i = 0; i < arrayQuatLength; ++i ){
            let q = new Quaternion();
            q.fromArray( array, i * 4 );
            q.normalize();
            arrayQuat.push( q );
        }
        return arrayQuat;
    }


    for ( let i = 0; i < keys.length; ++i ){
        if ( shapes[ keys[i] ].length ){ o[ keys[i] ] = floatArrayToQuatArray( shapes[ keys[i] ] ); }
        else{ o[keys[i]] = shapesToQuaternions( shapes[ keys[i] ] ); }        
    }

    return o;
}

// transform tables into THREE.Quaternions
handShapes = shapesToQuaternions( handShapes );
handShapes_2 = shapesToQuaternions( handShapes_2 );
thumbShapes = shapesToQuaternions( thumbShapes );

// receives bml instructions and animates the hands
class HandShapeRealizer {
    constructor(character){
        this.skeleton = null;
                
        // if new gest, set source as current pose. This needs a full copy of arrays to not modify references
        this.right = {
            idxs: null,
            defG: this._createGestureObject(),
            srcG: this._createGestureObject(),
            trgG: this._createGestureObject(),
            t: 0, // current time of transition
            start: 0, 
            attackPeak: 0,
            relax: 0, 
            end: 0, 
            transition: false,
        };
        
        this.left = {
            idxs: null, 
            defG: this._createGestureObject(),
            srcG: this._createGestureObject(),
            trgG: this._createGestureObject(),
            t: 0, // current time of transition
            start: 0, 
            attackPeak: 0,
            relax: 0, 
            end: 0, 
            transition: false,
        };        
        
        this.init(character);
    }

    // Cannot directly clone object as all three.quaternion functions will not be present. Thus manually create them
    _createGestureObject( ){
        let o = {};
        o.thumb = [ new Quaternion(), new Quaternion(), new Quaternion() ];
        o.index = [ new Quaternion(), new Quaternion(), new Quaternion() ];
        o.middle = [ new Quaternion(), new Quaternion(), new Quaternion() ];
        o.ring =  [ new Quaternion(), new Quaternion(), new Quaternion() ];
        o.pinky = [ new Quaternion(), new Quaternion(), new Quaternion() ];
        return o;
    }
    _fillGestureFromCurrentPose( indexes, destG ){
        let o = destG;
        let b = this.skeleton.bones;
        o.thumb[0].copy( b[ indexes.thumb ].quaternion );   o.thumb[1].copy( b[ indexes.thumb + 1 ].quaternion );   o.thumb[2].copy( b[ indexes.thumb + 2 ].quaternion );
        o.index[0].copy( b[ indexes.index ].quaternion );   o.index[1].copy( b[ indexes.index + 1 ].quaternion );   o.index[2].copy( b[ indexes.index + 2 ].quaternion );
        o.middle[0].copy( b[ indexes.middle ].quaternion ); o.middle[1].copy( b[ indexes.middle + 1 ].quaternion ); o.middle[2].copy( b[ indexes.middle + 2 ].quaternion );
        o.ring[0].copy( b[ indexes.ring ].quaternion );     o.ring[1].copy( b[ indexes.ring + 1 ].quaternion );     o.ring[2].copy( b[ indexes.ring + 2 ].quaternion );
        o.pinky[0].copy( b[ indexes.pinky ].quaternion );   o.pinky[1].copy( b[ indexes.pinky + 1 ].quaternion );   o.pinky[2].copy( b[ indexes.pinky + 2 ].quaternion );
        return o;
    }
    _fillGestureFromGesture( destG, srcG ){
        let o = destG;
        o.thumb[0].copy( srcG.thumb[0] );   o.thumb[1].copy( srcG.thumb[1] );   o.thumb[2].copy( srcG.thumb[2] );
        o.index[0].copy( srcG.index[0] );   o.index[1].copy( srcG.index[1] );   o.index[2].copy( srcG.index[2] );
        o.middle[0].copy( srcG.middle[0] ); o.middle[1].copy( srcG.middle[1] ); o.middle[2].copy( srcG.middle[2] );
        o.ring[0].copy( srcG.ring[0] );     o.ring[1].copy( srcG.ring[1] );     o.ring[2].copy( srcG.ring[2] );
        o.pinky[0].copy( srcG.pinky[0] );   o.pinky[1].copy( srcG.pinky[1] );   o.pinky[2].copy( srcG.pinky[2] );
        return o;
    }
    _mirrorGesture( g ){
        // mirror to self
        mirrorQuatSelf(g.thumb[0]);     mirrorQuatSelf(g.thumb[1]);      mirrorQuatSelf(g.thumb[2]);
        mirrorQuatSelf(g.index[0]);     mirrorQuatSelf(g.index[1]);      mirrorQuatSelf(g.index[2]);
        mirrorQuatSelf(g.middle[0]);    mirrorQuatSelf(g.middle[1]);     mirrorQuatSelf(g.middle[2]);
        mirrorQuatSelf(g.ring[0]);      mirrorQuatSelf(g.ring[1]);       mirrorQuatSelf(g.ring[2]);
        mirrorQuatSelf(g.pinky[0]);     mirrorQuatSelf(g.pinky[1]);      mirrorQuatSelf(g.pinky[2]);
        return g;
    }



    init( character ){
        // get skeleton reference
        if ( character.skeleton ){ this.skeleton = character.skeleotn; }
        else{ 
            this.skeleton = null;
            character.traverse( o => {
                if( o.isSkinnedMesh ){
                    this.skeleton = o.skeleton;
                }
            });
        }

        // base bone indexes. The used bones will be i, i+1 and i+2.
        this.right.idxs = { wrist: 0, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
        this.left.idxs = { wrist: 0, thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
        
        let bones = this.skeleton.bones;
        for( let i = 0; i < bones.length; ++i ){
            if ( bones[i].name.includes("RightHandThumb1") ){ this.right.idxs.thumb = i; }
            else if ( bones[i].name.includes("RightHandIndex1") ){ this.right.idxs.index = i; }
            else if ( bones[i].name.includes("RightHandMiddle1") ){ this.right.idxs.middle = i; }
            else if ( bones[i].name.includes("RightHandRing1") ){ this.right.idxs.ring = i; }
            else if ( bones[i].name.includes("RightHandPinky1") ){ this.right.idxs.pinky = i; }
            else if ( bones[i].name.includes("RightHand") ){ this.right.idxs.wrist = i; }
            
            else if ( bones[i].name.includes("LeftHandThumb1") ){ this.left.idxs.thumb = i; }
            else if ( bones[i].name.includes("LeftHandIndex1") ){ this.left.idxs.index = i; }
            else if ( bones[i].name.includes("LeftHandMiddle1") ){ this.left.idxs.middle = i; }
            else if ( bones[i].name.includes("LeftHandRing1") ){ this.left.idxs.ring = i; }
            else if ( bones[i].name.includes("LeftHandPinky1") ){ this.left.idxs.pinky = i; }
            else if ( bones[i].name.includes("LeftHand") ){ this.left.idxs.wrist = i; }
        }

        this.reset();

    }

    reset() {
        // Force pose update to flat
        
        this._fillGestureFromGesture( this.right.defG, handShapes[ "flat" ] );
        this._fillGestureFromGesture( this.left.defG, handShapes[ "flat" ] );
        this._mirrorGesture( this.left.defG );

        this.right.transition = true;
        this.left.transition = true;

        this.right.t = 1; this.right.start = 0; this.right.attackPeak = 0; this.right.relax = 0; this.right.end = 0;
        this.left.t = 1; this.left.start = 0; this.left.attackPeak = 0; this.left.relax = 0; this.left.end = 0;
        this.update( 1 ); // force position reset
    }

    update( dt ){
        this.updateHand( dt, this.right );
        this.updateHand( dt, this.left );
    }

    updateHand( dt, hand ) {
        if ( !hand.transition ){ return; } // no animation required
        
        hand.t += dt;
        
        // wait in same pose
        if ( hand.t < hand.start ){ return; }
        if ( hand.t > hand.attackPeak && hand.t < hand.relax ){ return; }
        
        if ( hand.t <= hand.attackPeak ){
            let t = ( hand.t - hand.start ) / ( hand.attackPeak - hand.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            // shouldar (back), actual shoulder, elbow
            let bones = this.skeleton.bones;   
            for( let i = 0; i < 3 ; ++i ){
                nlerpQuats( bones[ hand.idxs.thumb  + i ].quaternion, hand.srcG.thumb[i],  hand.trgG.thumb[i],  t );
                nlerpQuats( bones[ hand.idxs.index  + i ].quaternion, hand.srcG.index[i],  hand.trgG.index[i],  t );
                nlerpQuats( bones[ hand.idxs.middle + i ].quaternion, hand.srcG.middle[i], hand.trgG.middle[i], t );
                nlerpQuats( bones[ hand.idxs.ring   + i ].quaternion, hand.srcG.ring[i],   hand.trgG.ring[i],   t );
                nlerpQuats( bones[ hand.idxs.pinky  + i ].quaternion, hand.srcG.pinky[i],  hand.trgG.pinky[i],  t );
            }     
            return;
        }

        if ( hand.t >= hand.relax ){
            let t = ( hand.t - hand.relax ) / ( hand.end - hand.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            let bones = this.skeleton.bones;   
            for( let i = 0; i < 3 ; ++i ){
                nlerpQuats( bones[ hand.idxs.thumb  + i ].quaternion, hand.trgG.thumb[i],  hand.defG.thumb[i],  t );
                nlerpQuats( bones[ hand.idxs.index  + i ].quaternion, hand.trgG.index[i],  hand.defG.index[i],  t );
                nlerpQuats( bones[ hand.idxs.middle + i ].quaternion, hand.trgG.middle[i], hand.defG.middle[i], t );
                nlerpQuats( bones[ hand.idxs.ring   + i ].quaternion, hand.trgG.ring[i],   hand.defG.ring[i],   t );
                nlerpQuats( bones[ hand.idxs.pinky  + i ].quaternion, hand.trgG.pinky[i],  hand.defG.pinky[i],  t );
            }     
        }
        
        if ( hand.t > hand.end ){ 
            hand.transition = false;
        }

    }

    newGestureBML( bml ){
        let handedness = E_HANDEDNESS.RIGHT; // default hand
        if ( bml.hand == "left" ){ handedness = E_HANDEDNESS.LEFT; }
        else if ( bml.hand == "both" ){ handedness = E_HANDEDNESS.BOTH; }

        if ( handedness & E_HANDEDNESS.RIGHT ) { this.newGestureHand( bml, this.right, false ); }
        if ( handedness & E_HANDEDNESS.LEFT ) { this.newGestureHand( bml, this.left, true ); }
    }

    newGestureHand( bml, handInfo, mirror = false ){
        let newG = {};

        // fetch/build the correct gesture
        let g = handShapes_2[bml.handshape]; // pinch table (6 states)
        if ( g ){  // this handshape group is not modified by thumb. Set by reference, no cloning involved
            newG = g; 
        }else{
            // might be modified by thumb. Set by reference on each finger
            g = handShapes[bml.handshape];
            if ( !g ){ 
                console.warn( "Gesture: HandShape incorrect handshape \"" + bml.handshape + "\"" );
                return;
            }
            newG.thumb = g.thumb;
            newG.index = g.index;
            newG.middle = g.middle;
            newG.ring = g.ring;
            newG.pinky = g.pinky;

            if ( bml.thumbshape ){
                let thumbGest = thumbShapes[bml.thumbshape];
                if ( !thumbGest ){
                    console.warn( "Gesture: HandShape incorrect thumbshape \"" + bml.thumbshape + "\"" );
                    return;
                }
                newG.thumb = thumbGest;
            }

        }

        // set source pose
        this._fillGestureFromCurrentPose( handInfo.idxs, handInfo.srcG );
        
        // set target pose (and mirror)
        this._fillGestureFromGesture( handInfo.trgG, newG );

        // mirror quaternions for the left. Original quaternions are for right hand
        if ( mirror ){
            this._mirrorGesture( handInfo.trgG );
        }

        // set defualt pose if necessary
        if ( bml.shift ){
            this._fillGestureFromGesture( handInfo.defG, handInfo.trgG );
        }

        // check and set timings
        handInfo.start = bml.start || 0;
        handInfo.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        handInfo.attackPeak = bml.attackPeak || ( (handInfo.end - handInfo.start) * 0.25 + handInfo.start );
        handInfo.relax = bml.relax || ( (handInfo.end - handInfo.attackPeak) * 0.5 + handInfo.attackPeak );
        handInfo.transition = true;
        handInfo.t = 0; 
         
    }

}

export { HandShapeRealizer };