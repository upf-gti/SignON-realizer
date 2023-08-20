import * as THREE from 'three';

class HandConstellation {
    constructor( boneMap, skeleton, rightHandLocations, leftHandLocations ) {
        this.skeleton = skeleton;
        
        this.boneMap = boneMap;
       
       
        this.time = 0; // current time of transition
        this.start = 0; 
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        
        this.transition = false;

        // assuming both arms are the same size approximately
        this.worldArmSize = 0;
        let v = new THREE.Vector3();
        let u = v.clone();
        let w = v.clone();
        this.skeleton.bones[ boneMap[ "RArm" ] ].getWorldPosition( v );
        this.skeleton.bones[ boneMap[ "RElbow" ] ].getWorldPosition( u );
        this.skeleton.bones[ boneMap[ "RWrist" ] ].getWorldPosition( w );
        this.worldArmSize = v.sub(u).length() + u.sub(w).length();


        this.handLocationsR = rightHandLocations;
        this.handLocationsL = leftHandLocations;

        this.prevOffsetL = new THREE.Vector3(); // in case a handconstellation enters before the previous one ends. Keep the old current offset
        this.prevOffsetR = new THREE.Vector3();
        this.curOffsetL = new THREE.Vector3(); // wrist position resulting from update
        this.curOffsetR = new THREE.Vector3(); // wrist position resulting form update

        // after reaching peak, user might choose to keep updating with real position or keep the peak value reached 
        this.keepUpdatingContact = false;
        this.peakOffsetL = new THREE.Vector3(0,0,0);
        this.peakOffsetR = new THREE.Vector3(0,0,0);
        this.peakUpdated = false;


        this.srcCurOffset = null; // pointer to curOffset L or R
        this.srcPoint = null;
        this.dstCurOffset = null; // pointer to curOffset L or R
        this.dstPoint = null;

        this.distance = 0;
        this.isBothHands = false; // whether to move only src hand to dst point or move both hands to their respective destination points 

        this.cancelledArmsFlag = 0x00; // 0x01 source cancelled, 0x02 destination cancelled (if both hands enabled)
        // set default poses
        this.reset();

        this._tempV3_0 = new THREE.Vector3();
        this._tempV3_1 = new THREE.Vector3();
        this._tempV3_2 = new THREE.Vector3();
    }

    reset(){
        this.transition = false;
        this.prevOffsetL.set(0,0,0);
        this.prevOffsetR.set(0,0,0);
        this.curOffsetL.set(0,0,0);
        this.curOffsetR.set(0,0,0);
        this.distance = 0;
        this.isBothHands = false;
        this.cancelledArmsFlag = 0x00;

        this.keepUpdatingContact = false;
        this.peakUpdated = false;
        this.peakOffsetL.set(0,0,0);
        this.peakOffsetR.set(0,0,0);
    }

    update( dt ){
        // nothing to do
        if ( !this.transition ){ return; } 

        this.time += dt;

        // wait in same pose
        if ( this.time < this.start ){ 
            return;
        }

        if ( this.keepUpdatingContact || !this.peakUpdated ){ 

            this.srcPoint.updateWorldMatrix( true ); // self and parents
            this.dstPoint.updateWorldMatrix( true ); // self and parents
            let srcWorldPoint = this._tempV3_0.setFromMatrixPosition( this.srcPoint.matrixWorld );
            let dstWorldPoint = this._tempV3_1.setFromMatrixPosition( this.dstPoint.matrixWorld );

            let distanceOffsetVector = this._tempV3_2.set(this.worldArmSize * this.distance,0,0);
            if ( this.srcCurOffset == this.curOffsetR ) { distanceOffsetVector.multiplyScalar( -1 ); }
            
            if ( this.isBothHands ){
                distanceOffsetVector.multiplyScalar( 0.5 ); // half the distance for each hand

                if ( this.cancelledArmsFlag & 0x01 ){ this.srcCurOffset.set(0,0,0); }
                else{
                    this.srcCurOffset.lerpVectors( srcWorldPoint, dstWorldPoint, 0.5 );
                    this.srcCurOffset.sub( srcWorldPoint );
                    this.srcCurOffset.add( distanceOffsetVector );
                }
                
                if ( this.cancelledArmsFlag & 0x02 ){ this.dstCurOffset.set(0,0,0); }
                else{
                    this.dstCurOffset.lerpVectors( dstWorldPoint, srcWorldPoint, 0.5 );
                    this.dstCurOffset.sub( dstWorldPoint );
                    this.dstCurOffset.sub( distanceOffsetVector );
                }
            }else{
                this.srcCurOffset.copy( dstWorldPoint );
                this.srcCurOffset.sub( srcWorldPoint );
                this.srcCurOffset.add( distanceOffsetVector );
                this.dstCurOffset.set(0,0,0);
            }

            // does not need to keep updating. Set this src and dst as final positions and flag as peak updated
            if ( this.time > this.attackPeak && !this.keepUpdatingContact && !this.peakUpdated ){
                this.peakOffsetL.copy( this.curOffsetL );
                this.peakOffsetR.copy( this.curOffsetR );
                this.peakUpdated = true;
            }
        }

        // reminder: srcCurOffset and dstCurOffset are pointers to curOffsetL and curOffsetR
        // now that final points are computed, interpolate from origin to target
        let t = 0;
        if ( this.time <= this.attackPeak ){
            t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            this.curOffsetL.lerpVectors( this.prevOffsetL, this.curOffsetL, t );
            this.curOffsetR.lerpVectors( this.prevOffsetR, this.curOffsetR, t );

        }    
        else if ( this.time > this.attackPeak && this.time < this.relax ){ 
            // t = 1;
            // nothing else to update
        }            
        else if ( this.time >= this.relax){
            t = ( this.end - this.time ) / ( this.end - this.relax );
            if ( t > 1 ){ t = 1; }
            if ( t < 0 ){ t = 0; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            
            if ( this.time >= this.end ){ this.transition = false; }

            if ( !this.keepUpdatingContact ){
                this.curOffsetL.copy( this.peakOffsetL );
                this.curOffsetR.copy( this.peakOffsetR );
            }
            this.curOffsetL.multiplyScalar( t );
            this.curOffsetR.multiplyScalar( t );

        }
        
    }

    cancelArm( arm = "R" ){
        if ( arm == "B" ){ this.reset(); }
        if ( this.isBothHands ){
            if ( arm == "R"){ 
                this.cancelledArmsFlag |= ( this.srcCurOffset == this.curOffsetR ) ? 0x01 : 0x02; 
                this.prevOffsetR.set(0,0,0); 
                this.curOffsetR.set(0,0,0); 
            }
            else if ( arm == "L"){ 
                this.cancelledArmsFlag |= ( this.srcCurOffset == this.curOffsetL ) ? 0x01 : 0x02; 
                this.prevOffsetL.set(0,0,0); 
                this.curOffsetL.set(0,0,0); 
            }
        }
        else{ // only one arm is working. Cancel only if it is the selected arm
            if ( arm == "R" && this.srcCurOffset == this.curOffsetR ){ this.reset(); }
            else if ( arm == "L" && this.srcCurOffset == this.curOffsetL ){ this.reset(); }
        }
    }


    _newGestureLocationComposer( bml, handLocations, hand = "R", isSource = true ){
        // check all-in-one variable first
        let result = handLocations[ isSource ? bml.srcContact : bml.dstContact ];
        if ( result ){ return result; }

        // check decomposed variables
        let finger = parseInt( isSource ? bml.srcFinger : bml.dstFinger );
        let side = isSource ? bml.srcSide : bml.dstSide; 
        let location = isSource ? bml.srcLocation : bml.dstLocation;

        if ( isNaN( finger ) || finger < 1 || finger > 5 ){ finger = ""; }
        if ( typeof( location ) != "string" || location.length < 1){ location = ""; }
        else{ 
            location = location.toLowerCase();
            location = location[0].toUpperCase() + location.slice( 1 ); 
        }
        if ( typeof( side ) != "string" || side.length < 1 ){ side = ""; }
        else{ 
            side = side.toLowerCase();
            side = side[0].toUpperCase() + side.slice( 1 ); 
            if ( !isNaN( finger ) ){ // jasigning...
                if ( side == "Right" ){ side = hand == "R" ? "Ulnar" : "Radial"; }
                else if ( side == "Left" ){ side = hand == "R" ? "Radial" : "Ulnar"; }
            }
        }
        let name = finger + location + side; 

        result = handLocations[ name ];
        if ( !result ){ result = handLocations[ "2Tip" ]; }
        return result;
    }
    /**
     * bml info
     * start, attackPeak, relax, end
     * distance: [-ifinity,+ifninity] where 0 is touching and 1 is the arm size. Distance between endpoints. Right now only horizontal distance is applied
     * 
     * Location of the hand in the specified hand (or dominant hand)
     * srcContact: (optional) source contact location in a single variable. Strings must be concatenate as srcFinger + srcLocation + srcSide (whenever each variable is needed)
     * srcFinger: (optional) 1,2,3,4,5
     * srcLocation: (optional) string from handLocations (although no forearm, elbow, upperarm are valid inputs here)
     * srcSide: (optional) Ulnar, Radial, Palmar, Back. (ulnar == thumb side, radial == pinky side. Since hands are mirrored, this system is better than left/right)
     * 
     * Location of the hand in the unspecified hand (or non dominant hand)
     * dstContact: (optional) source contact location in a single variable. Strings must be concatenate as dstFinger + dstLocation + dstSide (whenever each variable is needed)
     * dstFinger: (optional) 1,2,3,4,5
     * dstLocation: (optional) string from handLocations (although no forearm, elbow, upperarm are valid inputs here)
     * dstSide: (optional) Ulnar, Radial, Palmar, Back 
     * 
     * keepUpdatingContact: (optional) once peak is reached, the location will be updated only if this is true. 
     *                  i.e: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
     *                       set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  

     */
    newGestureBML( bml, domHand = "R"  ) {
        this.keepUpdatingContact = !!bml.keepUpdatingContact;
        this.peakUpdated = false;
        this.cancelledArmsFlag = 0x00;
        let srcLocations = null;
        let dstLocations = null;
        let srcHand = "R";

        if ( bml.hand == "both" ){ // src default to domhand
            this.isBothHands = true;
            srcHand = domHand == "L" ? "L" : "R";
        }else{
            this.isBothHands = false;
            if ( bml.hand == "right" ){ srcHand = "R"; }
            else if ( bml.hand == "left" ){ srcHand = "L"; }
            else if ( bml.hand == "nonDom" ){ srcHand = domHand == "L" ? "R" : "L"; }
            else{ srcHand = domHand == "L" ? "L" : "R"; }
        }

        // save current state as previous state. curOffset changes on each update
        this.prevOffsetL.copy( this.curOffsetL );
        this.prevOffsetR.copy( this.curOffsetR );


        // set pointers
        if ( srcHand == "L" ){
            this.srcCurOffset = this.curOffsetL;
            this.dstCurOffset = this.curOffsetR;
            srcLocations = this.handLocationsL; 
            dstLocations = this.handLocationsR;
        }else{
            this.srcCurOffset = this.curOffsetR;
            this.dstCurOffset = this.curOffsetL;
            srcLocations = this.handLocationsR;
            dstLocations = this.handLocationsL
        }
        this.srcPoint = this._newGestureLocationComposer( bml, srcLocations, srcHand, true );
        this.dstPoint = this._newGestureLocationComposer( bml, dstLocations, srcHand =="R" ? "L":"R", false );
        
        this.distance = parseFloat( bml.distance );
        this.distance = isNaN( this.distance ) ? 0 : this.distance;

        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0;
        this.transition = true;
    }   
}


export { HandConstellation };