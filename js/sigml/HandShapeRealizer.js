import * as THREE from "three";

// Array of fingers 0=thumb 1=index 2=middle, 3=ring, 4=pinky
// Four values per finger (0=splay, 1=base, 2=mid, 3=tip)
let handShapes = {
    fist: [ [1,1,0.6,0.5], [0,1,1,1], [0,1,1,1], [0,1,1,1], [0,1,1,1] ],
    finger2: [ [1,1,0.6,0.5], [0,0,0,0], [0,1,1,1], [0,1,1,1], [0,1,1,1] ],
    finger23: [ [1,1,0.6,0.5], [0,0,0,0], [0,0,0,0], [0,1,1,1], [0,1,1,1] ],
    finger23spread: [ [1,1,0.6,0.5], [0.8,0,0,0], [-0.2,0,0,0], [0,1,1,1], [0,1,1,1] ],
    finger2345: [ [0,0,0,0], [0.8,0,0,0], [0,0,0,0], [-0.8,0,0,0], [-0.8,0,0,0] ], 
    flat: [ [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0] ],

    pinch12: [ [1,0.5,0.25,0.5], [0,0.3,0.8,0.25], [0,1,1,1], [0,1,1,1], [0,1,1,1] ],
    pinch12open: [ [1, 0.5, 0.1, 0.2], [0, 0.15, 0.4, 0.6], [0,1,1,1], [0,1,1,1], [0,1,1,1] ],
    pinchall: [ [1, 0.8, 0.4, 0.6], [0, 0.6, 0.6, 0.8], [0, 0.4, 0.6, 0.6], [0, 0.4, 0.7, 0.4], [0, 0.7, 0.5, 0.5] ],
    cee12: [  [1,0.5,0.25,0.5], [0,0.3,0.8,0.25], [0, 0.4, 0.2, 0.2], [0, 0.2, 0.2, 0.2], [0, 0, 0.2, 0.2] ],
    cee12open: [ [1, 0.5, 0.1, 0.1], [0, 0.4, 0.5, 0.2], [0, 0.4, 0.2, 0.2], [0, 0.2, 0.2, 0.2], [0, 0, 0.2, 0.2] ],
    ceeall: [ [1, 0.7, 0.1, 0.2], [0, 0.4, 0.2, 0.2], [0, 0.4, 0.2, 0.2], [0, 0.4, 0.2, 0.2], [0, 0.4, 0.2, 0.2] ], 
};

let thumbShapes = {
    default: [0,0,0,0],
    out:    [0, -0.3, 0, 0],
    opposed: [1, 1, 0, 0],
    across: [-0.5,0.7,0.7,1], 
    touch:  [-1,0.3,0,0]
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
        this.mirror = !!isLeftHand;

        let handName = ( this.mirror ) ? "L" : "R";
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
    update( dt ) {
        
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


        // TODO        
        let bones = this.skeleton.bones;
        let bendAxes = (this.mirror) ? avatarHandAxes.L.bends : avatarHandAxes.R.bends;    
        let splayAxes = (this.mirror) ? avatarHandAxes.L.splays : avatarHandAxes.R.splays; 
        let c = this.curG;   
        

        // all finger bends
        bones[ this.idxs.thumb      ].quaternion.setFromAxisAngle(  bendAxes[0],  ((1-c[0][1])*1.5-0.5) * (-Math.PI*0.2) ); // these maths because of weird thumb position in mesh 
        bones[ this.idxs.thumb + 1  ].quaternion.setFromAxisAngle(  bendAxes[1],  c[0][2] * Math.PI*0.4 );
        bones[ this.idxs.thumb + 2  ].quaternion.setFromAxisAngle(  bendAxes[2],  c[0][3] * Math.PI*0.4 );
        bones[ this.idxs.index      ].quaternion.setFromAxisAngle(  bendAxes[3],  c[1][1] * Math.PI*0.5 );
        bones[ this.idxs.index + 1  ].quaternion.setFromAxisAngle(  bendAxes[4],  c[1][2] * Math.PI*0.6 );
        bones[ this.idxs.index + 2  ].quaternion.setFromAxisAngle(  bendAxes[5],  c[1][3] * Math.PI*0.5 );
        bones[ this.idxs.middle     ].quaternion.setFromAxisAngle(  bendAxes[6],  c[2][1] * Math.PI*0.5 );
        bones[ this.idxs.middle + 1 ].quaternion.setFromAxisAngle(  bendAxes[7],  c[2][2] * Math.PI*0.6 );
        bones[ this.idxs.middle + 2 ].quaternion.setFromAxisAngle(  bendAxes[8],  c[2][3] * Math.PI*0.5 );
        bones[ this.idxs.ring       ].quaternion.setFromAxisAngle(  bendAxes[9],  c[3][1] * Math.PI*0.5 );
        bones[ this.idxs.ring + 1   ].quaternion.setFromAxisAngle(  bendAxes[10], c[3][2] * Math.PI*0.6 * 0.9 ); // 0.9 because of eva model
        bones[ this.idxs.ring + 2   ].quaternion.setFromAxisAngle(  bendAxes[11], c[3][3] * Math.PI*0.5 );
        bones[ this.idxs.pinky      ].quaternion.setFromAxisAngle(  bendAxes[12], c[4][1] * Math.PI*0.5 );
        bones[ this.idxs.pinky + 1  ].quaternion.setFromAxisAngle(  bendAxes[13], c[4][2] * Math.PI*0.6 );
        bones[ this.idxs.pinky + 2  ].quaternion.setFromAxisAngle(  bendAxes[14], c[4][3] * Math.PI*0.5 );

        // thumb splay is weird
        bones[ this.idxs.thumb ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[0], c[0][0] * Math.PI*0.15 ) );
        bones[ this.idxs.thumb ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  this.thumbTwistAxis, (this.mirror?1:-1) * Math.max( 0, c[0][0] ) * Math.PI*0.3 ) );

        // other fingers splay
        bones[ this.idxs.index  ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[1], this._computeSplayAngle( c[1] ) ) );
        bones[ this.idxs.middle ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[2], this._computeSplayAngle( c[2] ) ) );
        bones[ this.idxs.ring   ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[3], this._computeSplayAngle( c[3] ) ) );
        bones[ this.idxs.pinky  ].quaternion.multiply( _tempHandQuat.setFromAxisAngle(  splayAxes[4], this._computeSplayAngle( c[4] ) + this._computeSplayAngle( c[3] ) ) );
        

    }

    _computeSplayAngle( fingerInfo ){
        return fingerInfo[0] * ( 1 - Math.abs( fingerInfo[1] ) ) * 20*Math.PI/180;
    }
    _stringToBend( str, outFinger ){
        if ( typeof str != "string" ){ return; }
        switch( str ){
            case "straight": 
                outFinger[1] = 0; outFinger[2] = 0; outFinger[3] = 0;
                break;
            case "bent":
                outFinger[1] = 1; outFinger[2] = 0; outFinger[3] = 0;
                break;
            case "round":
                outFinger[1] = 0.5; outFinger[2] = 0.3; outFinger[3] = 0.3;
                break;
            case "hooked":
                outFinger[1] = 0; outFinger[2] = 1; outFinger[3] = 1;
                break;
            case "dblbent":
                outFinger[1] = 1; outFinger[2] = 1; outFinger[3] = 0;
                break;
            case "dblhooked":
                outFinger[1] = 1; outFinger[2] = 1; outFinger[3] = 1;
                break;
            case "halfbent":
                outFinger[1] = 0.5; outFinger[2] = 0; outFinger[3] = 0;
                break;
            default:
                // strings of three int values 0-9
                for( let i = 0; (i < 3) && (i < str.length); ++i ){
                    let val = parseInt( str[i] );
                    if ( isNaN(val) ){ continue; }
                    outFinger[1+i] = val/9;
                }
                break;
        }
    }
    _stringToSplay( str, outFinger ){
        if ( typeof str != "string" && typeof str != "number" ){ return; }
        // strings int values 0-8
        let val = parseInt( str[0] );
        if ( isNaN(val) ){ return; }
        val = Math.min( 8, val );
        outFinger[0] = 2* val/8 - 1;
    }
    
    /** 
     * bml info
     * start, attackPeak, relax, end
     * handshape: string from the handshape tables
     * f1, f2, f3, f4, f5: string from the handshape tables. Overrides handshape and thumbshape for that specific finger. 1=thumb, 5=pinky
     * thumbshape: (optional) string from thumbshape table. 
     */
    newGestureBML( bml ){

        // build the correct gesture. Might be modified by thumb, thus set by reference on each finger
        let g = handShapes[ bml.handshape ];
        if ( !g ){ 
            console.warn( "Gesture: HandShape incorrect handshape \"" + bml.handshape + "\"" );
            return;
        }
        let sg = handShapes[ bml.secondHandshape ];
        if ( !sg ){ sg = g; }


        // copy current state into src
        for( let i = 0; i < this.trgG.length; ++i ){
            let srcFinger = this.srcG[i];
            let curFinger = this.curG[i];
            for( let j = 0; j < curFinger.length; ++j ){
                srcFinger[j] = curFinger[j];
            }
        }

        // copy blended target
        for( let i = 0; i < this.curG.length; ++i ){
            let trgFinger = this.trgG[i];
            let mainFinger = g[i];
            let secondFinger = sg[i];
            for( let j = 0; j < mainFinger.length; ++j ){
                trgFinger[j] = mainFinger[j] * 0.5 + secondFinger[j] * 0.5;
            }
        }

        // modify with thumbshape
        if ( bml.thumbshape ){
            let thumbGest = thumbShapes[bml.thumbshape];
            let secondThumbGest = thumbShapes[bml.secondThumbshape];
            if ( !thumbGest ){ console.warn( "Gesture: HandShape incorrect thumbshape \"" + bml.thumbshape + "\"" ); thumbGest = g[0]; }
            if ( !secondThumbGest ){ secondThumbGest = thumbGest; }
            
            for( let j = 0; j < thumbGest.length; ++j ){
                this.trgG[0][j] = thumbGest[j] * 0.5 + secondThumbGest[j] * 0.5;
            }        
        }

        // TODO mainbend
        this._stringToBend( bml.bend1, this.trgG[0] ); // thumb
        this._stringToBend( bml.bend2, this.trgG[1] );
        this._stringToBend( bml.bend3, this.trgG[2] );
        this._stringToBend( bml.bend4, this.trgG[3] );
        this._stringToBend( bml.bend5, this.trgG[4] );

        // check if any splay attributes is present. ( function already checks if passed argument is valid )           
        this._stringToSplay( bml.splay1, this.trgG[0] ); // thumb
        this._stringToSplay( bml.splay2 ? bml.splay2 : bml.mainSplay, this.trgG[1] );
        this._stringToSplay( bml.splay3 ? bml.splay3 : bml.mainSplay, this.trgG[2] );
        this._stringToSplay( bml.splay4 ? bml.splay4 : bml.mainSplay, this.trgG[3] );
        this._stringToSplay( bml.splay5 ? bml.splay5 : bml.mainSplay, this.trgG[4] );

        // set defualt pose if necessary
        if ( bml.shift ){
            for( let i = 0; i < this.trgG.length; ++i ){
                let trgFinger = this.trgG[i];
                let defFinger = this.defG[i];
                for( let j = 0; j < trgFinger.length; ++j ){
                    defFinger[j] = trgFinger[j];
                }
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



// fingers(){
//     let bonemap = this.ECAcontroller.bodyController.boneMap;
//     let skeleton = this.ECAcontroller.bodyController.skeleton.bones;

//     let bendBase = Math.PI*0.5 * this.bend;
//     let bendMid = Math.PI*0.6 * this.bend;
//     let bendTip = Math.PI*0.5 * this.bend;
//     let splay = 0.35*(2*this.splay-1) * (1-Math.abs(this.bend)) * Math.PI*0.25;

//     let quat = new THREE.Quaternion(0,0,0,1);

//     skeleton[bonemap.RHandIndex].quaternion.setFromAxisAngle(    (new THREE.Vector3(1,0, -0.2)).normalize(), bendBase );
//     skeleton[bonemap.RHandIndex+1].quaternion.setFromAxisAngle(  (new THREE.Vector3(1,0,0)).normalize(), bendMid );
//     skeleton[bonemap.RHandIndex+2].quaternion.setFromAxisAngle(  (new THREE.Vector3(1,0,0)).normalize(), bendTip );
//     skeleton[bonemap.RHandMiddle].quaternion.setFromAxisAngle(   (new THREE.Vector3(1,0,0)).normalize(), bendBase );
//     skeleton[bonemap.RHandMiddle+1].quaternion.setFromAxisAngle( (new THREE.Vector3(1,0,0)).normalize(), bendMid );
//     skeleton[bonemap.RHandMiddle+2].quaternion.setFromAxisAngle( (new THREE.Vector3(1,0,0)).normalize(), bendTip );
//     skeleton[bonemap.RHandRing].quaternion.setFromAxisAngle(     (new THREE.Vector3(1,0, 0.1)).normalize(), bendBase );
//     skeleton[bonemap.RHandRing+1].quaternion.setFromAxisAngle(   (new THREE.Vector3(1,0,0)).normalize(), bendMid*0.9 );
//     skeleton[bonemap.RHandRing+2].quaternion.setFromAxisAngle(   (new THREE.Vector3(1,0,0)).normalize(), bendTip );
//     skeleton[bonemap.RHandPinky].quaternion.setFromAxisAngle(    (new THREE.Vector3(1,0, 0.2)).normalize(), bendBase );
//     skeleton[bonemap.RHandPinky+1].quaternion.setFromAxisAngle(  (new THREE.Vector3(1,0,0)).normalize(), bendMid );
//     skeleton[bonemap.RHandPinky+2].quaternion.setFromAxisAngle(  (new THREE.Vector3(1,0,0)).normalize(), bendTip );

//     skeleton[bonemap.RHandIndex].quaternion.multiply( quat.setFromAxisAngle(   (new THREE.Vector3(0,1,0)).normalize(), splay ) );
//     skeleton[bonemap.RHandMiddle].quaternion.multiply( quat.setFromAxisAngle(  (new THREE.Vector3(0,1,0)).normalize(), 0.25*splay ) );
//     skeleton[bonemap.RHandRing].quaternion.multiply( quat.setFromAxisAngle(    (new THREE.Vector3(0,1,0)).normalize(), -splay ) );
//     skeleton[bonemap.RHandPinky].quaternion.multiply( quat.setFromAxisAngle(   (new THREE.Vector3(0,1,0)).normalize(), -2*splay ) );
   

//     skeleton[bonemap.RHandThumb].quaternion.setFromAxisAngle(  (new THREE.Vector3(0,-1,-0.3)).normalize(),  ((1-this.bendThumb)*1.5-0.5) * (-Math.PI*0.2) );
//     skeleton[bonemap.RHandThumb+1].quaternion.setFromAxisAngle(  (new THREE.Vector3(0,-1,-0.3)).normalize(), this.bendThumb * Math.PI*0.4 );
//     skeleton[bonemap.RHandThumb+2].quaternion.setFromAxisAngle(  (new THREE.Vector3(0,-1,-0.3)).normalize(), this.bendThumb * Math.PI*0.4 );
//     skeleton[bonemap.RHandThumb].quaternion.multiply( quat.setFromAxisAngle(   (new THREE.Vector3(1,0,0)).normalize(), (2*this.splayThumb-1) * Math.PI*0.1 ) );
//     skeleton[bonemap.RHandThumb].quaternion.multiply( quat.setFromAxisAngle(   (new THREE.Vector3()).copy(skeleton[bonemap.RHandThumb+1].position).normalize(), -this.splayThumb * Math.PI*0.3 ) );
    


//     skeleton[bonemap.LHandIndex].quaternion.setFromAxisAngle(    (new THREE.Vector3(1,0, 0.2)).normalize(), bendBase );
//     skeleton[bonemap.LHandIndex+1].quaternion.setFromAxisAngle(  (new THREE.Vector3(1,0,0)).normalize(), bendMid );
//     skeleton[bonemap.LHandIndex+2].quaternion.setFromAxisAngle(  (new THREE.Vector3(1,0,0)).normalize(), bendTip );
//     skeleton[bonemap.LHandMiddle].quaternion.setFromAxisAngle(   (new THREE.Vector3(1,0,0)).normalize(), bendBase );
//     skeleton[bonemap.LHandMiddle+1].quaternion.setFromAxisAngle( (new THREE.Vector3(1,0,0)).normalize(), bendMid );
//     skeleton[bonemap.LHandMiddle+2].quaternion.setFromAxisAngle( (new THREE.Vector3(1,0,0)).normalize(), bendTip );
//     skeleton[bonemap.LHandRing].quaternion.setFromAxisAngle(     (new THREE.Vector3(1,0, -0.1)).normalize(), bendBase );
//     skeleton[bonemap.LHandRing+1].quaternion.setFromAxisAngle(   (new THREE.Vector3(1,0,0)).normalize(), bendMid*0.9 );
//     skeleton[bonemap.LHandRing+2].quaternion.setFromAxisAngle(   (new THREE.Vector3(1,0,0)).normalize(), bendTip );
//     skeleton[bonemap.LHandPinky].quaternion.setFromAxisAngle(    (new THREE.Vector3(1,0, -0.2)).normalize(), bendBase );
//     skeleton[bonemap.LHandPinky+1].quaternion.setFromAxisAngle(  (new THREE.Vector3(1,0,0)).normalize(), bendMid );
//     skeleton[bonemap.LHandPinky+2].quaternion.setFromAxisAngle(  (new THREE.Vector3(1,0,0)).normalize(), bendTip );

//     skeleton[bonemap.LHandIndex].quaternion.multiply( quat.setFromAxisAngle(   (new THREE.Vector3(0,1,0)).normalize(), -splay ) );
//     skeleton[bonemap.LHandMiddle].quaternion.multiply( quat.setFromAxisAngle(  (new THREE.Vector3(0,1,0)).normalize(), -0.25*splay ) );
//     skeleton[bonemap.LHandRing].quaternion.multiply( quat.setFromAxisAngle(    (new THREE.Vector3(0,1,0)).normalize(), splay ) );
//     skeleton[bonemap.LHandPinky].quaternion.multiply( quat.setFromAxisAngle(   (new THREE.Vector3(0,1,0)).normalize(), 2*splay ) );
   

//     skeleton[bonemap.LHandThumb].quaternion.setFromAxisAngle(  (new THREE.Vector3(0,-1,-0.3)).normalize(),  -((1-this.bendThumb)*1.5-0.5) * (-Math.PI*0.2) );
//     skeleton[bonemap.LHandThumb+1].quaternion.setFromAxisAngle(  (new THREE.Vector3(0,-1,-0.3)).normalize(), -this.bendThumb * Math.PI*0.4 );
//     skeleton[bonemap.LHandThumb+2].quaternion.setFromAxisAngle(  (new THREE.Vector3(0,-1,-0.3)).normalize(), -this.bendThumb * Math.PI*0.4 );
//     skeleton[bonemap.LHandThumb].quaternion.multiply( quat.setFromAxisAngle(   (new THREE.Vector3(1,0,0)).normalize(), (2*this.splayThumb-1) * Math.PI*0.1 ) );
//     skeleton[bonemap.LHandThumb].quaternion.multiply( quat.setFromAxisAngle(   (new THREE.Vector3()).copy(skeleton[bonemap.LHandThumb+1].position).normalize(), this.splayThumb * Math.PI*0.3 ) );
    
// }

export { HandShapeRealizer };



