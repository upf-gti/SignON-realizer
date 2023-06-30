import * as THREE from 'three';
import { directionStringSymmetry } from './SigmlUtils.js';

// Description of sigml points supported. keys: our proposal (what the realizer uses). Values: list of tags of sigml that are mapped to that key
// headtop : headtop,
// forehead : head, forehead,
// eyeL : eyebrows, eyes, uppereyelid, lowereyelid,
// eyeR : eyebrows, eyes, uppereyelid, lowereyelid,
// nose : nose,
// upperlip : nostrils, upperlip,
// mouth: lips, lowerlip, tongue, teeth, upperteeth, lowerteeth,
// chin : chin, underchin,
// earL : ear, earlobe,
// earR : ear, earlobe,
// cheekL : cheek,
// cheekR : cheek,
// neck : neck,
// shoulderL : shoulders, shouldertop,
// shoulderR : shoulders, shouldertop,
// chest : chest,
// stomach : stomach,
// belowstomach : belowstomach,

let sides = {
    'u'     : (new THREE.Vector3(  0,   1,   0 )).normalize(),   
    'ul'    : (new THREE.Vector3(  1,   1,   0 )).normalize(),   
    'l'     : (new THREE.Vector3(  1,   0,   0 )).normalize(),   
    'dl'    : (new THREE.Vector3(  1,  -1,   0 )).normalize(),   
    'd'     : (new THREE.Vector3(  0,  -1,   0 )).normalize(),   
    'dr'    : (new THREE.Vector3( -1,  -1,   0 )).normalize(),  
    'r'     : (new THREE.Vector3( -1,   0,   0 )).normalize(),  
    'ur'    : (new THREE.Vector3( -1,   1,   0 )).normalize(),  

    "uo"    : (new THREE.Vector3(  0,   1,   1 )).normalize(),
    "uol"   : (new THREE.Vector3(  1,   1,   1 )).normalize(),
    "ol"    : (new THREE.Vector3(  1,   0,   1 )).normalize(),
    "dol"   : (new THREE.Vector3(  1,  -1,   1 )).normalize(),
    "do"    : (new THREE.Vector3(  0,  -1,   1 )).normalize(),
    "dor"   : (new THREE.Vector3( -1,  -1,   1 )).normalize(),
    "or"    : (new THREE.Vector3( -1,   0,   1 )).normalize(),
    "uor"   : (new THREE.Vector3( -1,   1,   1 )).normalize(),
    "o"     : (new THREE.Vector3(  0,   0,   1 )).normalize(),
    
    "ui"    : (new THREE.Vector3(  0,   1,  -1 )).normalize(),
    "uil"   : (new THREE.Vector3(  1,   1,  -1 )).normalize(),
    "il"    : (new THREE.Vector3(  1,   0,  -1 )).normalize(),
    "dil"   : (new THREE.Vector3(  1,  -1,  -1 )).normalize(),
    "di"    : (new THREE.Vector3(  0,  -1,  -1 )).normalize(),
    "dir"   : (new THREE.Vector3( -1,  -1,  -1 )).normalize(),
    "ir"    : (new THREE.Vector3( -1,   0,  -1 )).normalize(),
    "uir"   : (new THREE.Vector3( -1,   1,  -1 )).normalize(),
    "i"     : (new THREE.Vector3(  0,   0,  -1 )).normalize(),
}

class LocationBodyArm {
    constructor( boneMap, skeleton, bodyLocations, isLeftHand = false ) {
        this.skeleton = skeleton;
        this.bodyLocations = bodyLocations;
        this.mirror = !!isLeftHand;

        let handName = isLeftHand ? "L" : "R";
        this.idx = boneMap[ handName + "Shoulder" ]// shoulder (back) index 
        
        // p : without offset. Raw location interpolation
        this.cur = { p: new THREE.Vector3(), e: 0, offset: new THREE.Vector3() }; // { world point, elbow raise, offset due to previous motions+handconstellation }
        this.src = { p: new THREE.Vector3(), e: 0, offset: new THREE.Vector3() }; // { world point, elbow raise, offset due to previous motions+handconstellation }
        this.trg = { p: new THREE.Vector3(), e: 0 }; // { world point, elbow raise }
        this.def = { p: new THREE.Vector3(), e: 0 }; // { world point, elbow raise }

        // if not null, this will be de point that tries to reach the target. Otherwise, the wrist is assumed
        this.contactFinger = null;
        this.contactFingerMap = [ boneMap[ handName + "HandThumb" ], boneMap[ handName + "HandIndex" ], boneMap[ handName + "HandMiddle" ], boneMap[ handName + "HandRing" ], boneMap[ handName + "HandPinky" ] ];

        this.time = 0; // current time of transition
        this.start = 0; 
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        
        this.transition = false;

        this.worldArmSize = 0;
        let v = new THREE.Vector3();
        let u = v.clone();
        let w = v.clone();
        this.skeleton.bones[ boneMap[ handName + "Arm" ] ].getWorldPosition( v );
        this.skeleton.bones[ boneMap[ handName + "Elbow" ] ].getWorldPosition( u );
        this.skeleton.bones[ boneMap[ handName + "Wrist" ] ].getWorldPosition( w );
        this.worldArmSize = v.sub(u).length() + u.sub(w).length();

        // set default poses
        this.reset();
    }

    reset(){
        this.transition = false;
        this.contactFinger = null;
        this.cur.p.set(0,0,0);
        this.cur.e = 0;
        this.def.p.set(0,0,0);
        this.def.e = 0;
    }

    update( dt ){
        // nothing to do
        if ( !this.transition ){ return; } 
        
        this.time += dt;
        
        // wait in same pose
        if ( this.time < this.start ){ 
            // this.cur.p.copy( this.src.p ); 
            // this.cur.e = this.src.e;
        }
        else if ( this.time >= this.end ){
            this.cur.p.copy( this.def.p );
            this.cur.offset.set(0,0,0); // just in case
            this.cur.e = this.def.e;
            this.transition = false; // flag as "nothing to do"
        }
        else{
            let newTarget = this.trg.p.clone();

            if ( this.contactFinger ){ // use some finger instead of the wrist
                this.contactFinger.updateWorldMatrix( true ); // self and parents
                
                let a = new THREE.Vector3();
                let b = new THREE.Vector3();
                a.setFromMatrixPosition( this.contactFinger.matrixWorld );
                b.setFromMatrixPosition( this.skeleton.bones[ this.idx + 3 ].matrixWorld );

                a.sub(b);
                newTarget.sub( a );
            }
            
            
            // interpolations
            if ( this.time > this.attackPeak && this.time < this.relax ){ 
                this.cur.p.copy( newTarget );
                this.cur.offset.set(0,0,0);
                this.cur.e = this.trg.e;

            }            
            else if ( this.time <= this.attackPeak ){
                let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
                if ( t > 1){ t = 1; }
                t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
    
                this.cur.p.lerpVectors( this.src.p, newTarget, t );
                this.cur.offset.copy( this.src.offset ).multiplyScalar( 1 - t );
                this.cur.e = this.src.e * ( 1 - t ) + this.trg.e * t;
            }    
            else if ( this.time >= this.relax ){
                let t = ( this.time - this.relax ) / ( this.end - this.relax );
                if ( t > 1){ t = 1; }
                t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
    
                this.cur.p.lerpVectors( newTarget, this.def.p, t );
                this.cur.offset.set(0,0,0);
                this.cur.e = this.trg.e * ( 1 - t ) + this.def.e * t;
            }
        }

    }


    // all second and main attributes do not get mixed until the end (jasigning)
    _newGestureLocationComposer( bml, symmetry, resultPos, isSecond = false ){
        let distance = isNaN( bml.distance ) ? 0 : bml.distance;
        let location = isSecond ? bml.secondLocationArm : bml.locationArm;

        // for symmetry - the left and right must be swapped
        if ( ( symmetry & 0x01 ) && location ){ 
            if ( location[location.length-1] == "L" ){ location = location.slice(0, location.length-1) + "R"; } 
            else if( location[location.length-1] == "R" ){ location = location.slice(0, location.length-1) + "L"; } 
        }
        if ( location == "ear" || location == "earlobe" || location == "cheek" || location == "eye" || location == "shoulder" ){
            location += this.mirror ? "L" : "R";
        }
       
        
        location = this.bodyLocations[ location ];
        if ( !location ){ 
            return false;
        }

        // use src as temporal buffer
        location.getWorldPosition( resultPos );
        resultPos.z += this.worldArmSize * distance;

        // same as in location
        let side = isSecond ? bml.secondSide : bml.side;
        if ( side && symmetry ){ side = directionStringSymmetry( side, symmetry ); }
        side = sides[ side ];
        if ( side ){

            let sideDist = isSecond ? bml.secondSideDistance : bml.sideDistance;
            sideDist = isNaN( sideDist ) ? 0 : sideDist;
            
            resultPos.x += side.x * sideDist;
            resultPos.y += side.y * sideDist;
            resultPos.z += side.z * sideDist;
        }

        return true;
    }
    /**
     * bml info
     * start, attackPeak, relax, end
     * locationArm: string from bodyLocations
     * secondLocationArm
     * distance: (optional) [0,1] how far from the body to locate the hand. 0 = touch, 1 = arm extended (distance == arm size). 
     * side: (optional) string from sides table. Location will offset into that direction
     * secondSide: (optional)
     * sideDistance: (optional) how far to move the indicated side. Metres
     * secondSideDistance: (optional)
     */
    newGestureBML( bml, symmetry = 0x00, lastFrameWorldPosition = null ) {

        if ( !this._newGestureLocationComposer( bml, symmetry, this.trg.p, false ) ){
            console.warn( "Gesture: Location Arm no location found with name \"" + bml.locationArm + "\"" );
            return;
        };
        if( this._newGestureLocationComposer( bml, symmetry, this.src.p, true ) ){ // use src as temporal buffer
            this.trg.p.lerp( this.src.p, 0.5 );
        }


        // elbow raise in degrees (in bml)
        let elbowRaise = parseInt( bml.elbowRaise );
        elbowRaise = isNaN( elbowRaise ) ? 0 : elbowRaise;  
        this.trg.e = elbowRaise * Math.PI / 180;

        // source: Copy current arm state
        if ( lastFrameWorldPosition ){
            this.src.offset.subVectors( lastFrameWorldPosition, this.cur.p );
            this.src.p.copy( this.cur.p );
        }
        else{
            this.src.offset.copy( this.cur.offset );
            this.src.p.copy( this.cur.p );
        }
        this.src.e = this.cur.e;
        
        // change arm's default pose if necesary
        if ( bml.shift ){
            this.def.p.copy( this.trg.p );
            this.def.e = this.trg.e;
        }

        // in case the user selects a specific finger bone as end effector. Not affected by shifg
        this.contactFinger = null;
        if ( bml.contactFinger ){
            let digit = parseInt( bml.contactFinger );
            if ( digit > 0 && digit < 6){ // form 1 to 5
                let contactBoneIdx = this.contactFingerMap[ digit - 1 ];
                switch( bml.contactFingerZone ){
                    case "base": break;
                    case "mid": contactBoneIdx += 1; break;
                    case "high": contactBoneIdx += 2;  break;
                    case "tip": 
                    default: contactBoneIdx += 3; break;
                }
                this.contactFinger = this.skeleton.bones[ contactBoneIdx ];
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


export { LocationBodyArm };