import * as THREE from "three";

// selected fingers available for mainblend: 0=Not selected, otherwise selected. 1=raw mainblend, 2=mainblend in thumb combinations (hamnosys)
// Array of fingers 0=thumb 1=index 2=middle, 3=ring, 4=pinky
// Four values per finger (0=splay, 1=base, 2=mid, 3=tip)
let handShapes = {
    // raw handshapes
    fist:           { selected:[0,0,0,0,0], shape:[ [-1,0.3,0,0], [0,1,1,1], [0,1,1,1], [0,1,1,1], [0,1,1,1] ] },
    finger2:        { selected:[0,1,0,0,0], shape:[ [1,1,0.6,0.5], [0,0,0,0], [0,1,1,1], [0,1,1,1], [0,1,1,1] ] },
    finger23:       { selected:[0,1,1,0,0], shape:[ [1,1,0.6,0.5], [0,0,0,0], [0,0,0,0], [0,1,1,1], [0,1,1,1] ] },
    finger23spread: { selected:[0,1,1,0,0], shape:[ [1,1,0.6,0.5], [0.8,0,0,0], [-0.2,0,0,0], [0,1,1,1], [0,1,1,1] ] },
    finger2345:     { selected:[0,1,1,1,1], shape:[ [-1,0.3,0,0], [0.8,0,0,0], [0,0,0,0], [0.8,0,0,0], [0.8,0,0,0] ] }, 
    flat:           { selected:[0,1,1,1,1], shape:[ [-1,0.3,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0] ] },

    // thumb combinations - could be reduced to only pinch. Cee are basically pinch but with selected fingers open
    pinch12:     { selected:[2,2,0,0,0], shape:[ [1,0.5,0.25,0.5], [0,0.3,0.8,0.25], [0,1,1,1], [0,1,1,1], [0,1,1,1] ] },
    pinch12open: { selected:[2,2,0,0,0], shape:[ [1,0.5,0.25,0.5], [0,0.3,0.8,0.25], [0, 0.4, 0.2, 0.2], [0, 0.2, 0.2, 0.2], [0, 0, 0.2, 0.2] ] },
    pinchall:    { selected:[2,2,2,2,2], shape:[ [1, 0.8, 0.4, 0.6], [0, 0.6, 0.6, 0.8], [0, 0.4, 0.6, 0.6], [0, 0.4, 0.7, 0.4], [0, 0.7, 0.5, 0.5] ] },
    cee12:       { selected:[3,3,0,0,0], shape:[ [1, 0.5, 0.1, 0.2], [0, 0.15, 0.4, 0.6], [0,1,1,1], [0,1,1,1], [0,1,1,1] ] },
    cee12open:   { selected:[3,3,0,0,0], shape:[ [1, 0.5, 0.1, 0.1], [0, 0.4, 0.5, 0.2], [0, 0.4, 0.2, 0.2], [0, 0.2, 0.2, 0.2], [0, 0, 0.2, 0.2] ] },
    ceeall:      { selected:[3,3,3,3,3], shape:[ [1, 0.7, 0.1, 0.2], [0, 0.4, 0.2, 0.2], [0, 0.4, 0.2, 0.2], [0, 0.4, 0.2, 0.2], [0, 0.4, 0.2, 0.2] ], } 
};

let thumbShapes = {
    default:  [-1,0.3,0,0],
    touch:  [-1,0.3,0,0],
    out:    [0, -0.3, 0, 0],
    opposed: [1, 1, 0, 0],
    across: [1,1,0.6,0.5], 
    // across: [-0.5,0.7,0.7,1], 
}


/* bending Mode:
    1 - all fingers use the same parameters
    2 - bending on a thumb combination. t= thumb, f=rest of fingers 
*/
let handBendings = {
    straight: { 1: [0,0,0], 2:{ t:[0,0,0], f:[0,0,0] } }, 
    halfbent: { 1: [0.5,0,0], 2:{ t:[8/9,0,0], f:[0.5,0,0] } }, 
    bent:     { 1: [1,0,0], 2:{ t:[8/9,0,0], f:[1,0,0] } }, 
    round:    { 1: [0.5,0.5,0.5], 2:{ t:[4/9,3/9,4/9], f:[5/9,6/9,9/9] } }, 
    hooked:   { 1: [0,1,1], 2:{ t:[8/9,1/9,8/9], f:[9/9,6/9,6/9] } }, 
    dblbent:  { 1: [1,1,0], 2:{ t:[8/9,1/9,8/9], f:[9/9,6/9,6/9] } }, 
    dblhooked:{ 1: [1,1,1], 2:{ t:[8/9,1/9,8/9], f:[9/9,6/9,6/9] } },     
}

// probably could be computed through skeleton raw positions
let avatarHandAxes = {
    "R" : { 
        "bends": [
            (new THREE.Vector3(0,-1,-0.3)).normalize(), // thumb base
            (new THREE.Vector3(0,-1,-0.3)).normalize(),
            (new THREE.Vector3(0,-1,-0.3)).normalize(),
            (new THREE.Vector3(1,0, -0.2)).normalize(), // index base
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(), // middle base
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0, 0.1)).normalize(), // ring base
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0, 0.2)).normalize(), // pinky base
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(),
        ],
        "splays": [
            (new THREE.Vector3(1,0,0)).normalize(), // thumb
            (new THREE.Vector3(0,1,0)).normalize(),
            (new THREE.Vector3(0,1,0)).normalize(),
            (new THREE.Vector3(0,1,0)).normalize(),
            (new THREE.Vector3(0,1,0)).normalize(), // pinky
        ]
    },
    "L" : { 
        "bends": [
            (new THREE.Vector3(0,1,0.3)).normalize(), // thumb base
            (new THREE.Vector3(0,1,0.3)).normalize(),
            (new THREE.Vector3(0,1,0.3)).normalize(),
            (new THREE.Vector3(1,0, 0.2)).normalize(), // index base
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(), // middle base
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0, -0.1)).normalize(), // ring base
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0, -0.2)).normalize(), // pinky base
            (new THREE.Vector3(1,0,0)).normalize(),
            (new THREE.Vector3(1,0,0)).normalize(),
        ],
        "splays": [
            (new THREE.Vector3(1,0,0)).normalize(), // thumb
            (new THREE.Vector3(0,-1,0)).normalize(),
            (new THREE.Vector3(0,-1,0)).normalize(),
            (new THREE.Vector3(0,-1,0)).normalize(),
            (new THREE.Vector3(0,-1,0)).normalize(), // pinky
        ]
    }
}

let _tempHandQuat = new THREE.Quaternion(0,0,0,1);


class HandShapeRealizer {
    constructor( boneMap, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.isLeftHand = !!isLeftHand;

        let handName = ( this.isLeftHand ) ? "L" : "R";
        this.idxs = { // base bone indexes. The used bones will be i (base finger), i+1 (mid finger) and i+2 (tip finger). 
            thumb:  boneMap[ handName + "HandThumb" ], 
            index:  boneMap[ handName + "HandIndex" ],
            middle: boneMap[ handName + "HandMiddle" ], 
            ring:   boneMap[ handName + "HandRing" ], 
            pinky:  boneMap[ handName + "HandPinky" ] 
        };
        this.thumbTwistAxis = (new THREE.Vector3()).copy(this.skeleton.bones[ this.idxs.thumb + 1 ].position).normalize();


        this.defG = [ [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0] ];
        this.srcG = [ [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0] ];
        this.trgG = [ [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0] ];
        this.curG = [ [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0] ];
        
        this.time = 0; // current time of transition
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0; 
        this.end = 0;

        this.transition = false;
        
        this.reset();
    }
    
    reset() {

        for( let i = 0; i < this.defG.length; ++i ){
            this.defG[i].fill(0);
            this.srcG[i].fill(0);
            this.trgG[i].fill(0);
            this.curG[i].fill(0);
        }

        this.time = 1; this.start = 0; this.attackPeak = 0; this.relax = 0; this.end = 0;
        this.update( 1 ); // force position reset
    }
       
    // must always update bones. (this.transition would be useless)
    update( dt, fingerplayResult ) {
        
        if ( this.transition ) {
            this.time += dt;
            // wait in same pose
            // if ( this.time <= this.start ){ }
              
            // transition from start to peak
            if ( this.time > this.start && this.time <= this.attackPeak ){
                let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
                if ( t > 1){ t = 1; }
                t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
                
                for( let i = 0; i < this.curG.length; ++i ){
                    let curFinger = this.curG[i];
                    let srcFinger = this.srcG[i];
                    let trgFinger = this.trgG[i];
                    for( let j = 0; j < curFinger.length; ++j ){
                        curFinger[j] = srcFinger[j] * (1-t) + trgFinger[j] * t;
                    }
                }
            }
    
            // wait in peak
            else if ( this.time > this.attackPeak && this.time < this.relax ){ 
                for( let i = 0; i < this.curG.length; ++i ){
                    let curFinger = this.curG[i];
                    let trgFinger = this.trgG[i];
                    for( let j = 0; j < curFinger.length; ++j ){
                        curFinger[j] = trgFinger[j];
                    }
                }
            }

            // transition from peak to default position
            else if ( this.time >= this.relax ){
                let t = ( this.time - this.relax ) / ( this.end - this.relax );
                if ( t > 1){ t = 1; }
                t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
    
                for( let i = 0; i < this.curG.length; ++i ){
                    let curFinger = this.curG[i];
                    let defFinger = this.defG[i];
                    let trgFinger = this.trgG[i];
                    for( let j = 0; j < curFinger.length; ++j ){
                        curFinger[j] = trgFinger[j] * (1-t) + defFinger[j] * t;
                    }
                }

                if ( this.time >= this.end ){ this.transition = false; }
            }
            
        }


        let bones = this.skeleton.bones;
        let bendAxes = (this.isLeftHand) ? avatarHandAxes.L.bends : avatarHandAxes.R.bends;    
        let splayAxes = (this.isLeftHand) ? avatarHandAxes.L.splays : avatarHandAxes.R.splays; 
        let c = this.curG;   
        

        // all finger bends
        let baseBend = Math.min( 1, Math.max( -0.2, c[0][1] + ( fingerplayResult ? fingerplayResult[0] : 0 ) ) );
        bones[ this.idxs.thumb      ].quaternion.setFromAxisAngle(  bendAxes[0],  ((1-baseBend)*1.5-0.5) * (-Math.PI*0.2) ); // these maths because of weird thumb position in mesh 
        bones[ this.idxs.thumb + 1  ].quaternion.setFromAxisAngle(  bendAxes[1],  c[0][2] * Math.PI*0.4 );
        bones[ this.idxs.thumb + 2  ].quaternion.setFromAxisAngle(  bendAxes[2],  c[0][3] * Math.PI*0.4 );
        baseBend = Math.min( 1, Math.max( -0.2, c[1][1] +  ( fingerplayResult ? fingerplayResult[1] : 0 ) ) );
        bones[ this.idxs.index      ].quaternion.setFromAxisAngle(  bendAxes[3],  ( baseBend ) * Math.PI*0.5 );
        bones[ this.idxs.index + 1  ].quaternion.setFromAxisAngle(  bendAxes[4],  c[1][2] * Math.PI*0.6 );
        bones[ this.idxs.index + 2  ].quaternion.setFromAxisAngle(  bendAxes[5],  c[1][3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, c[2][1] +  ( fingerplayResult ? fingerplayResult[2] : 0 ) ) );
        bones[ this.idxs.middle     ].quaternion.setFromAxisAngle(  bendAxes[6],  baseBend * Math.PI*0.5 );
        bones[ this.idxs.middle + 1 ].quaternion.setFromAxisAngle(  bendAxes[7],  c[2][2] * Math.PI*0.6 );
        bones[ this.idxs.middle + 2 ].quaternion.setFromAxisAngle(  bendAxes[8],  c[2][3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, c[3][1] +  ( fingerplayResult ? fingerplayResult[3] : 0 ) ) );
        bones[ this.idxs.ring       ].quaternion.setFromAxisAngle(  bendAxes[9],  baseBend * Math.PI*0.5 );
        bones[ this.idxs.ring + 1   ].quaternion.setFromAxisAngle(  bendAxes[10], c[3][2] * Math.PI*0.6 * 0.9 ); // 0.9 because of eva model
        bones[ this.idxs.ring + 2   ].quaternion.setFromAxisAngle(  bendAxes[11], c[3][3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, c[4][1] +  ( fingerplayResult ? fingerplayResult[4] : 0 ) ) );
        bones[ this.idxs.pinky      ].quaternion.setFromAxisAngle(  bendAxes[12], baseBend * Math.PI*0.5 );
        bones[ this.idxs.pinky + 1  ].quaternion.setFromAxisAngle(  bendAxes[13], c[4][2] * Math.PI*0.6 );
        bones[ this.idxs.pinky + 2  ].quaternion.setFromAxisAngle(  bendAxes[14], c[4][3] * Math.PI*0.5 );

        // thumb splay is weird
        bones[ this.idxs.thumb ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[0], c[0][0] * Math.PI*0.15 ) );
        bones[ this.idxs.thumb ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  this.thumbTwistAxis, (this.isLeftHand?1:-1) * Math.max( 0, c[0][0] ) * Math.PI*0.3 ) );

        // other fingers splay
        bones[ this.idxs.index  ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[1], this._computeSplayAngle( c[1] ) ) );
        bones[ this.idxs.middle ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[2], this._computeSplayAngle( c[2] ) ) );
        bones[ this.idxs.ring   ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[3], -1 * this._computeSplayAngle( c[3] ) ) );
        bones[ this.idxs.pinky  ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[4], -1 * this._computeSplayAngle( c[4] ) - this._computeSplayAngle( c[3] ) ) );
        

    }

    _computeSplayAngle( fingerInfo ){
        return fingerInfo[0] * ( 1 - Math.abs( fingerInfo[1] ) ) * 20*Math.PI/180;
    }
    

    _stringToMainBend( mainbend, handArray, selectedFingers ){        
        // thumb combinations + mainbend. Do not need to change splay
        // bent  "bend1":"800" fingers:"900"
        // round "bend1":"434" fingers:"569"
        // hooked "bend1":"818","bend2":"966" 
        // dblhooked and dblbent do not exist in hamnosys. Assume hooked
        
        let b = handBendings[ mainbend ];
        if ( !b ){ return; }

        // thumb combinations
        if ( selectedFingers[0] >= 2 ){
            let bt = b[2].t;
            handArray[0][1] = bt[0]; 
            handArray[0][2] = bt[1]; 
            handArray[0][3] = bt[2]; 
        }

        // rest of fingers
        for( let i = 1; i < 5; ++i ){
            if ( selectedFingers[i] == 1 ){ 
                let f = b[1];
                handArray[i][1] = f[0]; 
                handArray[i][2] = f[1]; 
                handArray[i][3] = f[2]; 
            }
            if ( selectedFingers[i] >= 2 ){ 
                let bf = b[2].f;
                handArray[i][1] = selectedFingers[i] == 3 ? ( bf[0] * 0.8 ) : bf[0]; 
                handArray[i][2] = bf[1]; 
                handArray[i][3] = bf[2]; 
            }
        }
    }
    _stringToFingerBend( str, outFinger, selectMode = 0 ){
        if ( !str ){ return; }

        let b = handBendings[ str ];
        if ( !b ){ 
            if ( typeof( str ) == "string" ){
                // strings of three int values 0-9
                for( let i = 0; (i < 3) && (i < str.length); ++i ){
                    let val = parseInt( str[i] );
                    if ( isNaN(val) ){ continue; }
                    outFinger[1+i] = val/9;
                }
            }
            return;
        }
        if ( selectMode == 1 ){ 
            let f = b[1];
            outFinger[1] = f[0]; 
            outFinger[2] = f[1]; 
            outFinger[3] = f[2]; 
        }
        if ( selectMode == 2 ){ 
            let bf = b[2].f;
            outFinger[1] = bf[0]; 
            outFinger[2] = bf[1]; 
            outFinger[3] = bf[2]; 
        }


    }
    _stringToSplay( str, outFinger ){
        let val = str;
        // strings int values 0-8
        if ( typeof val == "string" ){ 
            val = parseFloat( val );
        } 
        if ( isNaN(val) ){ return; }
        outFinger[0] = val;
        
    }

    // to avoid having duplicated code for main and second attributes. Fills outHand. Returns 0 on success, >0 otherwise
    _newGestureHandComposer( bml, outHand, isSecond ){

        let g = handShapes[ isSecond ? bml.secondHandshape : bml.handshape ];
        if ( !g ){ 
            console.warn( "Gesture: HandShape incorrect handshape \"" + (isSecond ? bml.secondHandshape : bml.handshape) + "\"" );
            return 1;
        }
            
        // copy selected shape into buffers
        for( let i = 0; i < outHand.length; ++i ){
            let finger = outHand[i];
            let source = g.shape[i];
            for( let j = 0; j < finger.length; ++j ){ finger[j] = source[j]; }
        }
        
        // apply mainbends if any
        this._stringToMainBend( isSecond ? bml.secondMainBend : bml.mainBend, outHand, g.selected );

        // modify with thumbshape
        let thumbGest = thumbShapes[ isSecond ? bml.secondThumbshape : bml.thumbshape ];
        if ( thumbGest ){
            for( let i = 0; i < thumbGest.length; ++i ){ outHand[0][i] = thumbGest[i]; }        
        }

        // tco (thumb combination opening). Applicable to cee and pinch (select mode 2 and 3). 1=keep original, 0=open fingers
        let thumbCombinationOpening = parseFloat( isSecond ? bml.secondtco : bml.tco );
        thumbCombinationOpening = isNaN( thumbCombinationOpening ) ? 0 : Math.max(0, Math.min(1, thumbCombinationOpening ) );
        for( let i = 0; i < outHand.length; ++i ){
            let finger = outHand[i];
            let fingerOpeningFactor = ( g.selected[i] >= 2 ) ? thumbCombinationOpening : 0;
            fingerOpeningFactor *= ( i == 0 ) ? 0.25 : 1;
            for( let j = 0; j < finger.length; ++j ){ finger[j] = finger[j] * ( 1 - fingerOpeningFactor ); }
        }

        return 0;
    }

    /** 
     * bml info
     * start, attackPeak, relax, end
     * handshape: string from the handshape tables
     * secondHandshape (optional)
     * thumbshape: (optional) string from thumbshape table. 
     * secondThumbshape (optional)
     * mainBend: (optional) string from bend table. The 6 basic handshape are affected differently than the 6 thumb combination handshapes
     * secondMainBend (optional)
     * tco: (optional) "Thumb Combination Opening", from 0 (same aperture as default) to 1 (completely open hand). Only affects the 6 thumb combination handshapes
     * secondtco: (optional)
     * bend1, bend2, bend3, bend4, bend5: (optional) string from bend table or string of numbers from 0-9. Overwrites any bend applied before
     * splay1, splay2, splay3, splay4, splay5: (optional) string of numbers from 0-9 
     * mainSplay: (optional) affects all fingers
    */
    newGestureBML( bml ){
              
        if ( this._newGestureHandComposer( bml, this.trgG, false ) ){ return; }// something went wrong
        if ( bml.secondHandshape ){ 
            this._newGestureHandComposer( bml, this.srcG, true ); // use this.srcG as temporal buffer
            for( let i = 0; i < this.trgG.length; ++i ){
                for( let j = 0; j < this.trgG.length; ++j ){
                    this.trgG[i][j] = this.trgG[i][j] * 0.5 +  this.srcG[i][j] * 0.5;
                }
            }
        }

        // specific bendings
        this._stringToFingerBend( bml.bend1, this.trgG[0], 1 ); // thumb
        this._stringToFingerBend( bml.bend2, this.trgG[1], 1 );
        this._stringToFingerBend( bml.bend3, this.trgG[2], 1 );
        this._stringToFingerBend( bml.bend4, this.trgG[3], 1 );
        this._stringToFingerBend( bml.bend5, this.trgG[4], 1 );

        // check if any splay attributes is present. ( function already checks if passed argument is valid )           
        this._stringToSplay( bml.splay1, this.trgG[0] ); // thumb
        this._stringToSplay( bml.splay2 ? bml.splay2 : bml.mainSplay, this.trgG[1] );
        this._stringToSplay( bml.splay3, this.trgG[2] ); // not affected by mainsplay, otherwise it feels weird
        this._stringToSplay( bml.splay4 ? bml.splay4 : bml.mainSplay, this.trgG[3] );
        this._stringToSplay( bml.splay5 ? bml.splay5 : bml.mainSplay, this.trgG[4] );

        // set default pose if necessary
        if ( bml.shift ){
            for( let i = 0; i < this.trgG.length; ++i ){
                let trgFinger = this.trgG[i];
                let defFinger = this.defG[i];
                for( let j = 0; j < trgFinger.length; ++j ){
                    defFinger[j] = trgFinger[j];
                }
            }
        }

        // copy current state into src
        for( let i = 0; i < this.trgG.length; ++i ){
            let srcFinger = this.srcG[i];
            let curFinger = this.curG[i];
            for( let j = 0; j < curFinger.length; ++j ){
                srcFinger[j] = curFinger[j];
            }
        }

        // check and set timings
        this.start = bml.start || 0;
        this.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        this.attackPeak = bml.attackPeak || ( (this.end - this.start) * 0.25 + this.start );
        this.relax = bml.relax || ( (this.end - this.attackPeak) * 0.5 + this.attackPeak );
        this.time = 0; 
            
        this.transition = true;
    }
}


export { HandShapeRealizer };



