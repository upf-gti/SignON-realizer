import * as THREE from 'three';
import { stringToDirection } from './SigmlUtils.js';

class LocationBodyArm {
    constructor( config, skeleton, isLeftHand = false ) {
        this.skeleton = skeleton;
        this.bodyLocations = config.bodyLocations;
        this.handLocations = isLeftHand ? config.handLocationsL : config.handLocationsR;
        this.isLeftHand = !!isLeftHand;
        
        let boneMap = config.boneMap;
        let handName = isLeftHand ? "L" : "R";
        this.idx = boneMap[ handName + "Shoulder" ]// shoulder (back) index 
        
        // p : without offset. Raw location interpolation
        this.cur = { p: new THREE.Vector3(), e: 0, offset: new THREE.Vector3() }; // { world point, elbow raise, offset due to previous motions+handconstellation }
        this.src = { p: new THREE.Vector3(), e: 0, offset: new THREE.Vector3() }; // { world point, elbow raise, offset due to previous motions+handconstellation }
        this.trg = { p: new THREE.Vector3(), e: 0 }; // { world point, elbow raise }
        this.def = { p: new THREE.Vector3(), e: 0 }; // { world point, elbow raise }

        // if not null, this will be de point that tries to reach the target. Otherwise, the wrist is assumed
        this.contactFinger = null;
        this.keepUpdatingContact = false; // flag to enable constant update of target position. If disabled, contact is only updated during start-peak 
        this.contactUpdateDone = false; // internal flag to indicate final contact update into this.trg has been done. Always false when keepUpdatingContact == true

        this.time = 0; // current time of transition
        this.start = 0; 
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        
        this.transition = false;

        this._tempV3_0 = new THREE.Vector3();
        this._tempV3_1 = new THREE.Vector3();
        this._tempV3_2 = new THREE.Vector3();
        
        this.worldArmSize = 0;
        this.skeleton.bones[ boneMap[ handName + "Arm" ] ].getWorldPosition( this._tempV3_0 );
        this.skeleton.bones[ boneMap[ handName + "Elbow" ] ].getWorldPosition( this._tempV3_1 );
        this.skeleton.bones[ boneMap[ handName + "Wrist" ] ].getWorldPosition( this._tempV3_2 );
        this.worldArmSize = this._tempV3_0.sub( this._tempV3_1 ).length() + this._tempV3_1.sub( this._tempV3_2 ).length();

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

        this.keepUpdatingContact = false;
        this.contactUpdateDone = false;
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
            let newTarget = this._tempV3_0.copy( this.trg.p );

            if ( this.contactFinger && !this.contactUpdateDone ){ // use some finger instead of the wrist
                this.contactFinger.updateWorldMatrix( true ); // self and parents
                
                this._tempV3_1.setFromMatrixPosition( this.contactFinger.matrixWorld );
                this._tempV3_2.setFromMatrixPosition( this.skeleton.bones[ this.idx + 3 ].matrixWorld );

                let dir = this._tempV3_1.sub( this._tempV3_2 );
                newTarget.sub( dir );

                // stop updating after peak, if keepUpdating is disabled. Hold last newTarget value as target
                if ( !this.keepUpdatingContact && this.time >= this.attackPeak ){
                    this.contactUpdateDone = true;
                    this.trg.p.copy( newTarget );
                }
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
    
                this.cur.offset.copy( this.src.offset ).multiplyScalar( 1 - t );
                this.cur.e = this.src.e * ( 1 - t ) + this.trg.e * t;
                this.cur.p.lerpVectors( this.src.p, newTarget, t );
                
                // overwriting newTarget ( aka this._tempV3_0 ). Add curve on the z axis (slightly better visually)
                let extraZSizeFactor = Math.min( 1, newTarget.sub( this.src.p ).lengthSq() / (this.worldArmSize * this.worldArmSize * 0.5) );
                let extraZsize = this.worldArmSize * 0.3 * extraZSizeFactor; // depending on how far the next objective
                this.cur.p.z += 2 * extraZsize * t * (1-t); // bezier simplified     [ 0 | size | 0 ]
            }    
            else if ( this.time >= this.relax ){
                let t = ( this.time - this.relax ) / ( this.end - this.relax );
                if ( t > 1){ t = 1; }
                t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
    
                this.cur.offset.set(0,0,0);
                this.cur.e = this.trg.e * ( 1 - t ) + this.def.e * t;
                this.cur.p.lerpVectors( newTarget, this.def.p, t );

                // overwriting newTarget ( aka this._tempV3_0 ). Add curve on the z axis (slightly better visually)
                let extraZSizeFactor = Math.min( 1, newTarget.sub( this.def.p ).lengthSq() / (this.worldArmSize * this.worldArmSize * 0.5) );
                let extraZsize = this.worldArmSize * 0.3 * extraZSizeFactor; // depending on how far the next objective
                let extra =  2 * extraZsize * t * (1-t); // bezier simplified    [ 0 | size | 0 ]
                this.cur.p.z += extra;
            }
        }

    }


    // all second and main attributes do not get mixed until the end (jasigning)
    _newGestureLocationComposer( bml, symmetry, resultPos, isSecond = false ){
        let distance = isNaN( bml.distance ) ? 0 : bml.distance;
        let location = isSecond ? bml.secondLocationBodyArm : bml.locationBodyArm;

        // Symmetry should be only for sides
        // for symmetry - the left and right must be swapped
        // if ( ( symmetry & 0x01 ) && location ){ 
        //     if ( location[location.length-1] == "L" ){ location = location.slice(0, location.length-1) + "R"; } 
        //     else if( location[location.length-1] == "R" ){ location = location.slice(0, location.length-1) + "L"; } 
        // }
        if ( location == "ear" || location == "earlobe" || location == "cheek" || location == "eye" || location == "eyebrow" || location == "shoulder" ){
            location += this.isLeftHand ? "L" : "R";
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
        if ( stringToDirection( side, this._tempV3_0, symmetry ) ){
            side = this._tempV3_0;
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
     * locationBodyArm: string from bodyLocations
     * secondLocationBodyArm: (optional)
     * distance: (optional) [0,1] how far from the body to locate the hand. 0 = touch, 1 = arm extended (distance == arm size). 
     * side: (optional) string from sides table. Location will offset into that direction
     * secondSide: (optional)
     * sideDistance: (optional) how far to move the indicated side. Metres
     * secondSideDistance: (optional)
     * 
     * elbowRaise: (optional) in degrees. Positive values raise the elbow.
     * 
     * Following attributes describe which part of the hand will try to reach the locationBodyArm location 
     * srcFinger: (optional) 1,2,3,4,5
     * srcLocation: (optional) string from handLocations (although no forearm, elbow, upperarm are valid inputs here)
     * srcSide: (optional) Ulnar, Radial, Palmar, Back. (ulnar == thumb side, radial == pinky side. Since hands are mirrored, this system is better than left/right)
     * keepUpdatingContact: (optional) once peak is reached, the location will be updated only if this is true. 
     *                  i.e: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
     *                       set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
     * shift does not use contact locations
     */
    newGestureBML( bml, symmetry = 0x00, lastFrameWorldPosition = null ) {
        this.keepUpdatingContact = !!bml.keepUpdatingContact;
        this.contactUpdateDone = false;

        if ( !this._newGestureLocationComposer( bml, symmetry, this.trg.p, false ) ){
            console.warn( "Gesture: Location Arm no location found with name \"" + bml.locationBodyArm + "\"" );
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

        // in case the user selects a specific finger bone as end effector. Not affected by shift
        this.contactFinger = null;
        let srcFinger = parseInt( bml.srcFinger );
        let srcSide = bml.srcSide; 
        let srcLocation = bml.srcLocation;
        if ( srcFinger || srcSide || srcLocation ){ 

            if ( isNaN( srcFinger ) || srcFinger < 1 || srcFinger > 5 ){ srcFinger = ""; }
            if ( typeof( srcLocation ) != "string" || srcLocation.length < 1){ srcLocation = ""; }
            else{ 
                srcLocation = srcLocation.toLowerCase(); 
                srcLocation = srcLocation[0].toUpperCase() + srcLocation.slice( 1 ); 
            }
            if ( typeof( srcSide ) != "string" || srcSide.length < 1 ){ srcSide = ""; }
            else{ 
                srcSide = srcSide.toLowerCase();
                srcSide = srcSide[0].toUpperCase() + srcSide.slice( 1 ); 
                if ( !isNaN( srcFinger ) ){ // jasigning...
                    if ( srcSide == "Right" ){ srcSide = this.isLeftHand ? "Radial" : "Ulnar"; }
                    else if ( srcSide == "Left" ){ srcSide = this.isLeftHand ? "Ulnar" : "Radial"; }
                }
            }
            let srcName = srcFinger + srcLocation + srcSide; 
         
            // only hand locations allowed as contact
            if ( !srcName.includes( "Arm" ) && !srcName.includes( "Elbow" ) ){
                this.contactFinger = this.handLocations[ srcName ];
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