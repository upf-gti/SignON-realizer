import * as THREE from "three"

class BasicBMLValueInterpolator {
    constructor( config, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.isLeftHand = !!isLeftHand;
        this.config = config;

        // store TWIST quaternions for forearm and hand (visally better than just forearm or wrist)
        this.defAngle = 0;
        this.trgAngle = 0;
        this.srcAngle = 0;
        this.curAngle = 0;

        this.time = 0; // current time of transition
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0; 
        this.end = 0;
        this.transition = false;
        
        // set default pose
        this.reset();
    }

    reset() {
        // Force pose update to flat
        this.transition = false;
        this.defAngle = 0;
        this.curAngle = 0;
    }

    update( dt ) {
        if ( !this.transition ){ return; } // no animation required
        
        this.time += dt;
        // wait in same pose
        if ( this.time < this.start ){ return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ 
            this.curAngle = this.trgAngle;
            return; 
        }
        
        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1 ){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            this.curAngle = this.srcAngle * ( 1 - t ) + this.trgAngle * t;
            return;
        }

        if ( this.time >= this.relax ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1 ){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            this.curAngle = this.trgAngle * ( 1 - t ) + this.defAngle * t;

            if ( this.time > this.end ){ 
                this.transition = false;
            }
        }
        

    }


    /**
     * bml info
     * start, attackPeak, relax, end
     */
    newGestureBML( newTargetValue, start, attackPeak, relax, end, shift = false ){
        if( isNaN( newTargetValue ) || newTargetValue == null ){ return false; }

        // set source pose twist quaternions
        this.srcAngle = this.curAngle; 

        // set target pose
        this.trgAngle = newTargetValue;

        // set defualt pose if necessary
        if ( shift ){
            this.defAngle = this.trgAngle;
        }

        // check and set timings
        this.start = start;
        this.attackPeak = attackPeak;
        this.relax = relax;
        this.end = end;
        this.time = 0; 
        
        this.transition = true;

        return true;
    }
}


class ShoulderRaise extends BasicBMLValueInterpolator {
    newGestureBML ( bml ){
        let value =  parseFloat( bml.shoulderRaise ) * ( 30 * Math.PI / 180 ); // shoulderRaise = [0,1]. where 1 == 30 Degrees
        super.newGestureBML( value, bml.start, bml.attackPeak, bml.relax, bml.end, bml.shift );
    }
}
class ShoulderHunch extends BasicBMLValueInterpolator {
    newGestureBML ( bml ){
        let value = parseFloat( bml.shoulderHunch ) * ( 30 * Math.PI / 180 ); // shoulderRaise = [0,1]. where 1 == 30 Degrees
        super.newGestureBML( value, bml.start, bml.attackPeak, bml.relax, bml.end, bml.shift );
    }
}



// this class should be different, but need to support jasigning
class BodyMovement {
    constructor ( config, skeleton ){
        this.config = config;
        this.skeleton = skeleton;

        // this should not be like this, but because of jasigning, create and destroy BasicBMLValueInterpolators and stack update results on each BodyMovement.update
        this.tiltFB = [];
        this.tiltLR = [];
        this.rotateLR = [];

        this.transition = false;

        this._tempQ_0 = new THREE.Quaternion();
        this._tempV3_0 = new THREE.Vector3();
        this._tempV3_1 = new THREE.Vector3();
        this._tempV3_2 = new THREE.Vector3();
    }

    reset (){
        this.transition = false;
        this.tiltFB = [];
        this.tiltLR = [];
        this.rotateLR = [];
    }

    update( dt ){
        if ( !this.transition ){ return; }

        let transition = false;

        let tiltFBAngle = 0;
        for ( let i = 0; i < this.tiltFB.length; ++i ){
            let o = this.tiltFB[i];
            o.update( dt );
            if ( !o.transition ){ this.tiltFB.splice( i, 1 ); --i; }
            tiltFBAngle += o.curAngle;
            transition |= o.transition;
        }

        let tiltLRAngle = 0;
        for ( let i = 0; i < this.tiltLR.length; ++i ){
            let o = this.tiltLR[i];
            o.update( dt );
            if ( !o.transition ){ this.tiltLR.splice( i, 1 ); --i; }
            tiltLRAngle += o.curAngle;
            transition |= o.transition;
        }

        let rotateLRAngle = 0;
        for ( let i = 0; i < this.rotateLR.length; ++i ){
            let o = this.rotateLR[i];
            o.update( dt );
            if ( !o.transition ){ this.rotateLR.splice( i, 1 ); --i; }
            rotateLRAngle += o.curAngle;
            transition |= o.transition;
        }

        this.transition = transition;
        let boneMap = this.config.boneMap;
        let q = this._tempQ_0;


        // upper back
        let rotateLRAxis = this._tempV3_0.copy( this.skeleton.bones[ boneMap.Neck ].position).normalize(); // Y        
        let tiltFBAxis = this._tempV3_1.set(1,0,0); // x
        let tiltLRAxis = this._tempV3_2.set(0,0,1); // z
        tiltFBAxis.crossVectors( rotateLRAxis, tiltLRAxis ).normalize(); // compute x 
        tiltLRAxis.crossVectors( tiltFBAxis, rotateLRAxis ).normalize(); // compute z
        this.skeleton.bones[ boneMap.ShouldersUnion ].quaternion.setFromAxisAngle( rotateLRAxis, rotateLRAngle *0.3333 ); // y
        q.setFromAxisAngle( tiltFBAxis, tiltFBAngle *0.3333);
        this.skeleton.bones[ boneMap.ShouldersUnion ].quaternion.premultiply( q );
        q.setFromAxisAngle( tiltLRAxis, tiltLRAngle *0.3333);
        this.skeleton.bones[ boneMap.ShouldersUnion ].quaternion.premultiply( q );

        // mid back
        rotateLRAxis = rotateLRAxis.copy( this.skeleton.bones[ boneMap.ShouldersUnion ].position ).normalize(); // Y        
        tiltFBAxis = tiltFBAxis.set(1,0,0); // x
        tiltLRAxis = tiltLRAxis.set(0,0,1); // z
        tiltFBAxis.crossVectors( rotateLRAxis, tiltLRAxis ).normalize(); // compute x 
        tiltLRAxis.crossVectors( tiltFBAxis, rotateLRAxis ).normalize(); // compute z
        this.skeleton.bones[ boneMap.Spine2 ].quaternion.setFromAxisAngle( rotateLRAxis, rotateLRAngle *0.3333 ); // y
        q.setFromAxisAngle( tiltFBAxis, tiltFBAngle *0.3333);
        this.skeleton.bones[ boneMap.Spine2 ].quaternion.premultiply( q );
        q.setFromAxisAngle( tiltLRAxis, tiltLRAngle *0.3333);
        this.skeleton.bones[ boneMap.Spine2 ].quaternion.premultiply( q );

        // lower back
        rotateLRAxis = rotateLRAxis.copy( this.skeleton.bones[ boneMap.Spine2 ].position ).normalize(); // Y        
        tiltFBAxis = tiltFBAxis.set(1,0,0); // x
        tiltLRAxis = tiltLRAxis.set(0,0,1); // z
        tiltFBAxis.crossVectors( rotateLRAxis, tiltLRAxis ).normalize(); // compute x 
        tiltLRAxis.crossVectors( tiltFBAxis, rotateLRAxis ).normalize(); // compute z
        this.skeleton.bones[ boneMap.Spine1 ].quaternion.setFromAxisAngle( rotateLRAxis, rotateLRAngle *0.3333 ); // y
        q.setFromAxisAngle( tiltFBAxis, tiltFBAngle *0.3333 );
        this.skeleton.bones[ boneMap.Spine1 ].quaternion.premultiply( q );
        q.setFromAxisAngle( tiltLRAxis, tiltLRAngle *0.3333 );
        this.skeleton.bones[ boneMap.Spine1 ].quaternion.premultiply( q );
    }

    newGestureBML( bml ){
        let amount = parseFloat( bml.amount );
        if ( isNaN( amount ) ){ amount = 1; }
        amount = amount * 15 * Math.PI / 180;
        let dstBuffer = null;
        switch( bml.bodyMovement ){
            case "TL": amount *= -1;
            case "TR": dstBuffer = this.tiltLR;
                break;
            case "TB": amount *= -1;
            case "TF": dstBuffer = this.tiltFB;
                break;
            case "RR": amount *= -1;
            case "RL": dstBuffer = this.rotateLR;
                break;
        }

        if ( dstBuffer ){
            let b = new BasicBMLValueInterpolator(this.config, this.skeleton );
            b.newGestureBML( amount, bml.start, bml.attackPeak, bml.relax, bml.end );
            dstBuffer.push( b );
            this.transition = true;
        }
    }
}



export { ShoulderRaise, ShoulderHunch, BodyMovement }