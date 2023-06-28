import * as THREE from 'three';
import { directionStringSymmetry } from './SigmlUtils.js';


// finger: (optional) if present, it indicates the contact finger. The location will specify the zone of the finger
// location: generic hand location
// side: back, palm, ulnar, radial

/*
  location:
    - (f) tip
    - (f) pad
    - (f) middle
    - (f) base
    - (f) metacarpal
    - ball of thumb 
    - wrist
    - forearm
    - elbow
    - upper arm
    - (not specified) shoulder
*/

class HandConstellation {
    constructor( boneMap, skeleton, rightHandLocations, leftHandLocations, ikSolverR, ikSolverL ) {
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


        this.ikSolverL = ikSolverL;
        this.ikSolverR = ikSolverR;
        this.handLocationsR = rightHandLocations;
        this.handLocationsL = leftHandLocations;
        this.resultPosL = new THREE.Vector3(); // wrist position resulting from update
        this.resultPosR = new THREE.Vector3(); // wrist position resulting form update

        this.srcResultPos = null; // pointer to resultPos L or R
        this.srcPoint = null;
        this.dstResultPos = null; // pointer to resultPos L or R
        this.dstPoint = null;

        this.distance = 0;
        this.isBothHands = false; // whether to move only src hand to dst point or move both hands to their respective destination points 

        // set default poses
        this.reset();
    }

    reset(){
        this.transition = false;
 
    }

    update( dt, posR, posL, elbowR, elbowL ){
        // nothing to do
        if ( !this.transition ){ return; } 
        
        this.time += dt;
        
        let t = 0;
        // wait in same pose
        if ( this.time < this.start ){ 
            return;
        }
        else if ( this.time <= this.attackPeak ){
            t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
        }    
        else if ( this.time > this.attackPeak && this.time < this.relax ){ 
            t = 1;
        }            
        else if ( this.time >= this.relax){
            t = ( this.end - this.time ) / ( this.end - this.relax );
            if ( t > 1 ){ t = 1; }
            if ( t < 0 ){ t = 0; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            
            if ( this.time >= this.end ){
                t = 0;
                this.transition = false;
            }
        }

        let srcWristPos = posR;
        let dstWristPos = posL;
        if ( this.srcResultPos == this.resultPosL ){
            srcWristPos = posL;
            dstWristPos = posR;
        }

        this.srcPoint.updateWorldMatrix( true ); // self and parents
        this.dstPoint.updateWorldMatrix( true ); // self and parents
        let srcWorldPoint = (new THREE.Vector3()).setFromMatrixPosition( this.srcPoint.matrixWorld );
        let dstWorldPoint = (new THREE.Vector3()).setFromMatrixPosition( this.dstPoint.matrixWorld );

        let srcDir = (new THREE.Vector3()).subVectors( srcWorldPoint, srcWristPos );
        let dstDir = (new THREE.Vector3()).subVectors( dstWorldPoint, dstWristPos );

        let distanceOffsetVector = (new THREE.Vector3(this.worldArmSize * this.distance * t))
        if ( this.srcResultPos == this.resultPosR ) { distanceOffsetVector.multiplyScalar( -1 ); }

        
        if ( this.isBothHands ){
            distanceOffsetVector.multiplyScalar( 0.5 ); // half the distance for each hand
            this.srcResultPos.lerpVectors( srcWorldPoint, dstWorldPoint, t * 0.5 );
            this.srcResultPos.add( distanceOffsetVector );
            this.srcResultPos.sub( srcDir );
            this.dstResultPos.lerpVectors( dstWorldPoint, srcWorldPoint, t * 0.5 );
            this.dstResultPos.sub( distanceOffsetVector );
            this.dstResultPos.sub( dstDir );
        }else{
            this.srcResultPos.lerpVectors( srcWorldPoint, dstWorldPoint, t );
            this.srcResultPos.add( distanceOffsetVector );
            this.srcResultPos.sub( srcDir );
            this.dstResultPos.copy( dstWristPos );
        }
        
        // this.ikSolverL.reachTarget( this.resultPosL, elbowL, true );
        // this.ikSolverR.reachTarget( this.resultPosR, elbowR, true );
    }


    _newGestureLocationComposer( bml,  handLocations, isSource = true ){
        let finger = parseInt( isSource ? bml.srcFinger : bml.dstFinger );
        let side = isSource ? bml.srcSide : bml.dstSide; 
        let location = isSource ? bml.srcLocation : bml.dstLocation;

        if ( isNaN( finger ) || finger < 1 || finger > 5 ){ finger = ""; }
        if ( typeof( location ) != "string" ){ location = ""; }
        if ( typeof( side ) != "string" ){ side = ""; }
        let name = finger + location + side; 

        return handLocations[ name ];
    }
    /**
     * bml info
     * start, attackPeak, relax, end
     * distance: [-ifinity,+ifninity] where 0 is touching and 1 is the arm size. Distance between endpoints
     */
    newGestureBML( bml, domHand = "R"  ) {

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


        // set pointers
        if ( srcHand == "L" ){
            this.srcResultPos = this.resultPosL;
            this.dstResultPos = this.resultPosR;
            srcLocations = this.handLocationsL; 
            dstLocations = this.handLocationsR;
        }else{
            this.srcResultPos = this.resultPosR;
            this.dstResultPos = this.resultPosL;
            srcLocations = this.handLocationsR;
            dstLocations = this.handLocationsL
        }
        this.srcPoint = this._newGestureLocationComposer( bml, srcLocations, true );
        this.dstPoint = this._newGestureLocationComposer( bml, dstLocations, false );
        
        this.distance = parseFloat( bml.distance );
        this.distance = isNaN( this.distance ) ? 0 : this.distance;

        // check and set timings
        this.start = bml.start || 0;
        this.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        this.attackPeak = bml.attackPeak || ( (this.end - this.start) * 0.25 + this.start );
        this.relax = bml.relax || ( (this.end - this.attackPeak) * 0.5 + this.attackPeak );
        this.time = 0;
        this.transition = true;
    }   
}


export { HandConstellation };