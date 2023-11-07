import * as THREE from "three";

// selected fingers available for mainblend: 0=Not selected, otherwise selected. 1=raw mainblend, 2=mainblend in thumb combinations (hamnosys)
// Array of fingers 0=thumb 1=index 2=middle, 3=ring, 4=pinky
// Four values per finger (0=splay, 1=base, 2=mid, 3=tip)
let handshapes = {

    // basic handshapes    
    FIST:           { selected: [0,0,0,0,0], shape: [ [0,0.5,0,0],[0,1,1,1],[0,1,1,1],[0,1,1,1],[0,1,1,1] ] },
    FINGER_2:        { selected: [0,1,0,0,0], shape: [ [0.5,0.75,0.6,0.5],[0,0,0,0],[0,1,1,1],[0,1,1,1],[0,1,1,1] ] },
    FINGER_23:       { selected: [0,1,1,0,0], shape: [ [0.6,0.8,0.8,0.5],[0,0,0,0],[0,0,0,0],[0,1,1,1],[0,1,1,1] ] },
    FINGER_23_SPREAD: { selected: [0,1,1,0,0], shape: [ [0.6,0.8,0.8,0.5],[0.8,0,0,0],[-0.2,0,0,0],[0,1,1,1],[0,1,1,1] ] },
    FINGER_2345:     { selected: [0,1,1,1,1], shape: [ [0,0.5,0,0],[0.8,0,0,0],[0,0,0,0],[0.8,0,0,0],[0.8,0,0,0] ] },
    FLAT:           { selected: [0,1,1,1,1], shape: [ [0,0.5,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0] ] },
    // thumb combinations - could be reduced to only pinch. Cee are basically pinch but with selected fingers open
    PINCH_12:        { selected: [2,2,0,0,0], shape: [ [1, 0.56, 0.5, 0.22],[0,0.3,0.8,0.25],[0,1,1,1],[0,1,1,1],[0,1,1,1] ] },
    PINCH_12_OPEN:    { selected: [2,2,0,0,0], shape: [ [1, 0.56, 0.5, 0.22],[0,0.3,0.8,0.25],[0,0.4,0.2,0.2],[0,0.2,0.2,0.2],[0,0,0.2,0.2] ] },
    PINCH_ALL:       { selected: [2,2,2,2,2], shape: [ [1, 0.95, 0.1, 0.4],[0,0.67,0.44,0.56],[0,0.56,0.44,0.56],[0,0.67,0.33,0.33],[0,0.89,0.22,0.22] ] },
    CEE_12:          { selected: [3,3,0,0,0], shape: [ [1, 0.7, 0.1, 0.2],[0,0.41,0.51,0.21],[0,1,1,1],[0,1,1,1],[0,1,1,1] ] },
    CEE_12_OPEN:      { selected: [3,3,0,0,0], shape: [ [1, 0.7, 0.1, 0.2],[0,0.4,0.5,0.2],[0,0.4,0.2,0.2],[0,0.2,0.2,0.2],[0,0,0.2,0.2] ] },
    CEE_ALL:         { selected: [3,3,3,3,3], shape: [ [1, 0.7, 0.1, 0.2],[0,0.4,0.2,0.2],[0,0.4,0.2,0.2],[0,0.4,0.2,0.2],[0,0.4,0.2,0.2] ] }
};

let thumbshapes = {
    OUT:     [0,0,0,0], 
    DEFAULT: [0,0.5,0,0],
    TOUCH:   [0,0.5,0,0],
    OPPOSED: [1,1,0,0],
    ACROSS:  [0.5,0.77,0.55,0.77]
}


/* bending Mode:
    1 - all fingers use the same parameters
    2 - bending on a thumb combination. t= thumb, f=rest of fingers 
*/
let handBendings = {
    STRAIGHT: { 1: [0,0,0], 2:{ t:[0.45,0,0], f:[0,0,0] } }, 
    HALF_BENT: { 1: [0.5,0,0], 2:{ t:[8/9,0,0], f:[0.5,0,0] } }, 
    BENT:     { 1: [1,0,0], 2:{ t:[8/9,0,0], f:[1,0,0] } }, 
    ROUND:    { 1: [0.5,0.5,0.5], 2:{ t:[6/9,3/9,4/9], f:[5/9,6/9,9/9] } }, 
    HOOKED:   { 1: [0,1,1], 2:{ t:[8/9,1/9,8/9], f:[9/9,6/9,6/9] } }, 
    DOUBLE_BENT:  { 1: [1,1,0], 2:{ t:[8/9,1/9,8/9], f:[9/9,6/9,6/9] } }, 
    DOUBLE_HOOKED:{ 1: [1,1,1], 2:{ t:[8/9,1/9,8/9], f:[9/9,6/9,6/9] } },     
}


class HandShapeRealizer {
    constructor( config, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.isLeftHand = !!isLeftHand;
        
        let boneMap = config.boneMap;
        let handName = ( this.isLeftHand ) ? "L" : "R";
        this.fingerIdxs = [ // base bone indexes. The used bones will be i (base finger), i+1 (mid finger) and i+2 (tip finger). 
            boneMap[ handName + "HandThumb" ], 
            boneMap[ handName + "HandIndex" ],
            boneMap[ handName + "HandMiddle" ], 
            boneMap[ handName + "HandRing" ], 
            boneMap[ handName + "HandPinky" ] 
        ];
        
        this.handshapes = config.handshapes ? config.handshapes : handshapes;
        this.thumbshapes = config.thumbshapes ? config.thumbshapes : thumbshapes;
        this.handBendings = config.handBendings ? config.handBendings : handBendings;

        this.fingerAxes = isLeftHand ? config.fingerAxes.L : config.fingerAxes.R;
        this.thumbAfterBindTwistAxis = (new THREE.Vector3()).copy(this.skeleton.bones[ this.fingerIdxs[0] + 1 ].position).applyQuaternion( this.fingerAxes.quats[0] ).normalize();
        let meshToLocal = new THREE.Matrix3();
        // for each bone in each finger, transform bend and splay axis from mesh space to bone local space + bind + correctionQuat (thumb needs a correction)
        for ( let i = 0; i < this.fingerIdxs.length; ++i ){
            for ( let j = 0; j<3; ++j){
                meshToLocal.setFromMatrix4( this.skeleton.boneInverses[ this.fingerIdxs[ i ] + j ] );
                this.fingerAxes.bends[ i*3+j  ] = (new THREE.Vector3()).copy( this.fingerAxes.bends[ i*3+j ] ).applyMatrix3( meshToLocal ).applyQuaternion( this.fingerAxes.quats[ i*3+j ] ).normalize();
                if ( j == 0 ){
                    this.fingerAxes.splays[ i ] = (new THREE.Vector3()).copy( this.fingerAxes.splays[ i ] ).applyMatrix3( meshToLocal ).applyQuaternion( this.fingerAxes.quats[ i*3 ] ).normalize();
                }
            }
        }

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
        
        this._tempQ_0 = new THREE.Quaternion(0,0,0,1);

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

        // order of quaternion multiplication matter
        let bones = this.skeleton.bones;
        let bendAxes = this.fingerAxes.bends; 
        let splayAxes = this.fingerAxes.splays; 
        let c = this.curG;   
        
        // all finger bends
        let thumbBase;
        let baseBend = thumbBase = Math.min( 1, Math.max( -0.2, c[0][1] + ( fingerplayResult ? fingerplayResult[0] : 0 ) ) );
        bones[ this.fingerIdxs[0]      ].quaternion.setFromAxisAngle(  bendAxes[0],  baseBend * Math.PI*0.5 ); 
        bones[ this.fingerIdxs[0] + 1  ].quaternion.setFromAxisAngle(  bendAxes[1],  c[0][2] * Math.PI*0.4 );
        bones[ this.fingerIdxs[0] + 2  ].quaternion.setFromAxisAngle(  bendAxes[2],  c[0][3] * Math.PI*0.4 );
        baseBend = Math.min( 1, Math.max( -0.2, c[1][1] +  ( fingerplayResult ? fingerplayResult[1] : 0 ) ) );
        bones[ this.fingerIdxs[1]      ].quaternion.setFromAxisAngle(  bendAxes[3],  baseBend * Math.PI*0.5 );
        bones[ this.fingerIdxs[1] + 1  ].quaternion.setFromAxisAngle(  bendAxes[4],  c[1][2] * Math.PI*0.6 );
        bones[ this.fingerIdxs[1] + 2  ].quaternion.setFromAxisAngle(  bendAxes[5],  c[1][3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, c[2][1] +  ( fingerplayResult ? fingerplayResult[2] : 0 ) ) );
        bones[ this.fingerIdxs[2]     ].quaternion.setFromAxisAngle(  bendAxes[6],  baseBend * Math.PI*0.5 );
        bones[ this.fingerIdxs[2] + 1 ].quaternion.setFromAxisAngle(  bendAxes[7],  c[2][2] * Math.PI*0.6 );
        bones[ this.fingerIdxs[2] + 2 ].quaternion.setFromAxisAngle(  bendAxes[8],  c[2][3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, c[3][1] +  ( fingerplayResult ? fingerplayResult[3] : 0 ) ) );
        bones[ this.fingerIdxs[3]       ].quaternion.setFromAxisAngle(  bendAxes[9],  baseBend * Math.PI*0.5 );
        bones[ this.fingerIdxs[3] + 1   ].quaternion.setFromAxisAngle(  bendAxes[10], c[3][2] * Math.PI*0.6 );
        bones[ this.fingerIdxs[3] + 2   ].quaternion.setFromAxisAngle(  bendAxes[11], c[3][3] * Math.PI*0.5 );
        baseBend = Math.min( 1, Math.max( -0.2, c[4][1] +  ( fingerplayResult ? fingerplayResult[4] : 0 ) ) );
        bones[ this.fingerIdxs[4]      ].quaternion.setFromAxisAngle(  bendAxes[12], baseBend * Math.PI*0.5 );
        bones[ this.fingerIdxs[4] + 1  ].quaternion.setFromAxisAngle(  bendAxes[13], c[4][2] * Math.PI*0.6 );
        bones[ this.fingerIdxs[4] + 2  ].quaternion.setFromAxisAngle(  bendAxes[14], c[4][3] * Math.PI*0.5 );

        // thumb splay is weird
        bones[ this.fingerIdxs[0] ].quaternion.multiply( this._tempQ_0.setFromAxisAngle( splayAxes[ 0 ], c[ 0 ][ 0 ] * Math.PI * 0.2 ) );
        bones[ this.fingerIdxs[0] ].quaternion.multiply( this._tempQ_0.setFromAxisAngle( this.thumbAfterBindTwistAxis, ( this.isLeftHand ? 1 : -1 ) * Math.max( 0, c[ 0 ][ 0 ] ) * thumbBase * Math.PI * 0.4 ) ); // finger rotates only if splay + base bend

        // other fingers splay
        bones[ this.fingerIdxs[1]  ].quaternion.multiply( this._tempQ_0.setFromAxisAngle(  splayAxes[1], this._computeSplayAngle( c[1] ) ) );
        bones[ this.fingerIdxs[2] ].quaternion.multiply( this._tempQ_0.setFromAxisAngle(  splayAxes[2], this._computeSplayAngle( c[2] ) ) );
        bones[ this.fingerIdxs[3]   ].quaternion.multiply( this._tempQ_0.setFromAxisAngle(  splayAxes[3], -1 * this._computeSplayAngle( c[3] ) ) );
        bones[ this.fingerIdxs[4]  ].quaternion.multiply( this._tempQ_0.setFromAxisAngle(  splayAxes[4], -1 * this._computeSplayAngle( c[4] ) - this._computeSplayAngle( c[3] ) ) );
        
        // apply bind quaternions
        for ( let i = 0; i < 5; ++i ){
            bones[ this.fingerIdxs[i]      ].quaternion.multiply(  this._tempQ_0.copy(this.fingerAxes.quats[i*3]) );
            bones[ this.fingerIdxs[i] + 1  ].quaternion.multiply(  this._tempQ_0.copy(this.fingerAxes.quats[i*3+1]) );
            bones[ this.fingerIdxs[i] + 2  ].quaternion.multiply(  this._tempQ_0.copy(this.fingerAxes.quats[i*3+2]) );            
        }                
    }

    _computeSplayAngle( fingerInfo ){
        return fingerInfo[0] * ( 1 - Math.abs( fingerInfo[1] ) ) * 20*Math.PI/180;
    }
    

    _stringToMainBend( mainbend, handArray, selectedFingers ){        
        // thumb combinations + mainbend. Do not need to change splay
        // BENT  "bend1":"800" fingers:"900"
        // ROUND "bend1":"434" fingers:"569"
        // HOOKED "bend1":"818","bend2":"966" 
        // DOUBLE_HOOKED and DOUBLE_BENT do not exist in hamnosys. Assume HOOKED
        
        let b = this.handBendings[ mainbend ];
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

    // selectMode: if str is not numbers,  0 does nothing, 1 same shapes as mainbend in basic handshape, 2 same as mainbend in thumbcombinations
    _stringToFingerBend( str, outFinger, selectMode = 0, bendRange = 9 ){
        if ( !str ){ return; }

        let b = this.handBendings[ str ];
        if ( !b ){ 
            if ( typeof( str ) == "string" ){
                // strings of three int values 0-9
                for( let i = 0; (i < 3) && (i < str.length); ++i ){
                    let val = parseInt( str[i] );
                    if ( isNaN(val) ){ continue; }
                    outFinger[1+i] = val / bendRange;
                }
            }
            return;
        }
        if ( selectMode == 1 ){ // basic handshapes
            let f = b[1];
            outFinger[1] = f[0]; 
            outFinger[2] = f[1]; 
            outFinger[3] = f[2]; 
        }
        if ( selectMode >= 2 ){  // thumb combination handshapes
            let bf = b[2].f;
            outFinger[1] = selectedFingers[i] == 3 ? ( bf[0] * 0.8 ) : bf[0]; 
            outFinger[2] = bf[1]; 
            outFinger[3] = bf[2]; 
        }


    }
    _stringToSplay( str, outFinger ){
        let val = str;
        if ( typeof val == "string" ){ 
            val = parseFloat( val );
        } 
        if ( isNaN(val) ){ return; }
        outFinger[0] = val;
    }

    // to avoid having duplicated code for main and second attributes. Fills outHand. Returns 0 on success, >0 otherwise
    _newGestureHandComposer( bml, outHand, isSecond ){

        let shapeName = isSecond ? bml.secondHandshape : bml.handshape;
        if ( shapeName.toUpperCase ){ shapeName = shapeName.toUpperCase(); }
        let g = this.handshapes[ shapeName ];
        if ( !g ){ 
            console.warn( "Gesture: HandShape incorrect handshape \"" + shapeName + "\"" );
            return 1;
        }
            
        // copy selected shape into buffers
        for( let i = 0; i < outHand.length; ++i ){
            let finger = outHand[i];
            let source = g.shape[i];
            for( let j = 0; j < finger.length; ++j ){ finger[j] = source[j]; }
        }
        
        let selectedFingers = g.selected;
        
        // special fingers override default
        let specFing = bml.specialFingers; // get special fingers
        if (specFing && !isSecond) {
            selectedFingers = [selectedFingers[0],0,0,0,0];
            specFing = specFing.split(''); // ['23'] -> ['2','3']
            for (let i = 0; i < specFing.length; i++) {
                let num = parseInt(specFing[i]) - 1;
                if (isNaN(num) || num > 4) { specFing.splice(i, 1); i--; continue; }
                selectedFingers[num] = (g.selected[0] ? g.selected[0] : 1); // depending on thumb, selected value is 1,2 or 3
                specFing[i] = num;
            } // str to num (['2', '3'] -> [2,3])
            
            if (!specFing.length) selectedFingers = g.selected; // abort special fingers, no finger was valid
            else {

                switch (bml.handshape) {
                    case "FIST":
                        for (let i = 1; i < selectedFingers.length; i++) {
                            if (!selectedFingers[i]) outHand[i] = [0,0,0,0]; // non-selected fingers into flat
                            selectedFingers[i] = 1 - selectedFingers[i];
                        }
                        break;
                        
                    case "FLAT": case "CEE_ALL": case "PINCH_ALL":
                        for (let i = 1; i < selectedFingers.length; i++) {
                            if (!selectedFingers[i]) outHand[i] = [0,1,1,1]; // non-selected fingers into fist
                        }
                        break;
                        
                    case "PINCH_12": case "PINCH_12_OPEN": case "CEE_12": case "CEE_12_OPEN":
                        for (let i = 0; i < specFing.length; i++) {
                            outHand[specFing[i]] = [...handshapes[(bml.handshape.includes("CEE_") ? "CEE_ALL" : "PINCH_ALL")].shape[specFing[i]]];
                        }
                        break;
                        
                    default:
                        // get default fingers (handshapes: fingerX)
                        let defFing = bml.handshape.match(/\d+/g); // ['FINGER_23_SPREAD'] -> ['23']
                        if (defFing) {
                            defFing = defFing[0].split(''); // ['23'] -> ['2','3']
                            defFing = defFing.map(function(str) {
                                return parseInt(str) - 1;
                            }); // str to num (['2', '3'] -> [2,3])
                            if(defFing[0] == 0) defFing.shift(); // avoid thumb
                            
                            // change handshape
                            for (let i = 0; i < specFing.length; i++) {                                
                                if (!defFing[i]) { 
                                    outHand[specFing[i]] = [...outHand[defFing[0]]]; // copy array as value not reference
                                }  // if more special fingers than default
                                else if (specFing[i] == defFing[i]) continue; // default and special are the same finger -> skip
                                else { outHand[specFing[i]] = [...outHand[defFing[i]]]; } // interchange finger config (eg: default=2, special=5)
                            }
                        }
                        break;

                    }
                    
                    // change default to open or fist
                    var isOpen = bml.handshape.includes("_OPEN", 5);
                    for (let i = 1; i < selectedFingers.length; i++) {
                        if (!selectedFingers[i]) { outHand[i] = (isOpen ? [0,0.2,0.2,0.2] : [0,1,1,1]); }
                    }
                    
                    // relocate thumb
                    if ( bml.handshape.includes("PINCH_") ) { outHand[0] = [...handshapes["PINCH_ALL"].shape[0]]; }
                    else if ( bml.handshape.includes("CEE_") ) { outHand[0] = [...handshapes["CEE_ALL"].shape[0]]; }
                }    
        }

        // apply mainbends if any
        this._stringToMainBend( isSecond ? bml.secondMainBend : bml.mainBend, outHand, selectedFingers );

        // modify with thumbshape
        let thumbGest = this.thumbshapes[ isSecond ? bml.secondThumbshape : bml.thumbshape ];
        if ( thumbGest ){
            for( let i = 0; i < thumbGest.length; ++i ){ outHand[0][i] = thumbGest[i]; }        
        }

        // tco (thumb combination opening). Applicable to cee and pinch (select mode 2 and 3). 1=keep original, 0=open fingers
        let thumbCombinationOpening = parseFloat( isSecond ? bml.secondtco : bml.tco );
        thumbCombinationOpening = isNaN( thumbCombinationOpening ) ? 0 : Math.max(-1, Math.min(1, thumbCombinationOpening ) );
        for( let i = 0; i < outHand.length; ++i ){
            let finger = outHand[i];
            let fingerOpeningFactor = thumbCombinationOpening * (( i == 0 ) ? -0.25 : 1);
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
     * mainSplay: (optional) affects all fingers except middle finger
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

        // Jasigning uses numbers in a string for bend. Its range is 0-4. This realizer works with 0-9. Remap
        let bendRange = parseInt( bml._bendRange );
        bendRange = isNaN( bendRange ) ? 9 : bendRange; 

        // specific bendings
        this._stringToFingerBend( bml.bend1, this.trgG[0], 1, bendRange ); // thumb
        this._stringToFingerBend( bml.bend2, this.trgG[1], 1, bendRange );
        this._stringToFingerBend( bml.bend3, this.trgG[2], 1, bendRange );
        this._stringToFingerBend( bml.bend4, this.trgG[3], 1, bendRange );
        this._stringToFingerBend( bml.bend5, this.trgG[4], 1, bendRange );

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
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0; 
            
        this.transition = true;
    }
}


export { HandShapeRealizer };



