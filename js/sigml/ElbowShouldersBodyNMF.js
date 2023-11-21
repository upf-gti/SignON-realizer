import * as THREE from "three"
import { getBindQuaternion } from "./Utils.js";

class BasicBMLValueInterpolator {
    constructor( config, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.isLeftHand = !!isLeftHand;
        this.config = config;

        // store TWIST quaternions for forearm and hand (visally better than just forearm or wrist)
        this.defValue = 0;
        this.trgValue = 0;
        this.srcValue = 0;
        this.curValue = 0;

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
        this.defValue = 0;
        this.curValue = 0;
    }

    update( dt ) {
        if ( !this.transition ){ return; } // no animation required
        
        this.time += dt;
        // wait in same pose
        if ( this.time < this.start ){ return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ 
            this.curValue = this.trgValue;
            return; 
        }
        
        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1 ){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            this.curValue = this.srcValue * ( 1 - t ) + this.trgValue * t;
            return;
        }

        if ( this.time >= this.relax ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1 ){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;
            this.curValue = this.trgValue * ( 1 - t ) + this.defValue * t;

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
        this.srcValue = this.curValue; 

        // set target pose
        this.trgValue = newTargetValue;

        // set defualt pose if necessary
        if ( shift ){
            this.defValue = this.trgValue;
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

class ElbowRaise extends BasicBMLValueInterpolator {
    newGestureBML ( bml ){
        let value = parseFloat( bml.elbowRaise ) * ( 90 * Math.PI / 180 ); // shoulderRaise = [0,1]. where 1 == 90 Degrees
        return super.newGestureBML( value, bml.start, bml.attackPeak, bml.relax, bml.end, bml.shift );
    }
}

class ShoulderRaise extends BasicBMLValueInterpolator {
    newGestureBML ( bml ){
        let value =  parseFloat( bml.shoulderRaise ) * ( 30 * Math.PI / 180 ); // shoulderRaise = [0,1]. where 1 == 30 Degrees
        return super.newGestureBML( value, bml.start, bml.attackPeak, bml.relax, bml.end, bml.shift );
    }
}

class ShoulderHunch extends BasicBMLValueInterpolator {
    newGestureBML ( bml ){
        let value = parseFloat( bml.shoulderHunch ) * ( 30 * Math.PI / 180 ); // shoulderRaise = [0,1]. where 1 == 30 Degrees
        return super.newGestureBML( value, bml.start, bml.attackPeak, bml.relax, bml.end, bml.shift );
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
        
        this.jointsData = { };
        this.jointsData.shouldersUnion = this.computeJointData( this.config.boneMap.ShouldersUnion, this.config.boneMap.Neck );
        this.jointsData.stomach = this.computeJointData( this.config.boneMap.Stomach, this.config.boneMap.ShouldersUnion );
        this.jointsData.belowStomach = this.computeJointData( this.config.boneMap.BelowStomach, this.config.boneMap.Stomach );
    }

    computeJointData( boneIdx, upAxisReferenceBoneIdx ){
        let bindQuat = (new THREE.Quaternion());
        getBindQuaternion( this.skeleton, boneIdx, bindQuat );

        // compute local axes of rotation based on bones boneIdx and upAxisReferenceBoneIdx.
        let xAxis = new THREE.Vector3();
        let yAxis = new THREE.Vector3();
        let zAxis = new THREE.Vector3();
        zAxis.setFromMatrixPosition( this.skeleton.boneInverses[ boneIdx ].clone().invert() ); // position of boneIdx in mesh coordinates
        yAxis.setFromMatrixPosition( this.skeleton.boneInverses[ upAxisReferenceBoneIdx ].clone().invert() ); // position of upAxisReferenceBoneIdx in mesh coordinates
        yAxis.subVectors( yAxis, zAxis ); // Y axis direction in mesh coordinates
        let m3 = (new THREE.Matrix3).setFromMatrix4( this.skeleton.boneInverses[ boneIdx ] ); // mesh to local, directions only
        yAxis.applyMatrix3( m3 ).normalize(); // Y axis, convert to local boneIdx coordinates
        zAxis.copy( this.config.axes[2] ).applyMatrix3( m3 ).normalize(); // Z convert mesh config front axis from mesh coords to local coords
        xAxis.crossVectors( yAxis, zAxis ).normalize(); // x
        zAxis.crossVectors( xAxis, yAxis ).normalize(); // Z ensure orthogonality

        return { idx: boneIdx, lastFrameQuat: new THREE.Quaternion(), bindQuat: bindQuat, beforeBindAxes: [ xAxis, yAxis, zAxis ] }; // tiltFB, rotateRL, tiltRL || x,y,z
    }

    reset (){
        this.transition = false;
        this.tiltFB = [];
        this.tiltLR = [];
        this.rotateLR = [];
        this.forceBindPose();
    }

    forceBindPose(){
        for( let part in this.jointsData ){
            this.skeleton.bones[ this.jointsData[ part ].idx ].quaternion.copy( this.jointsData[ part ].bindQuat );
        }
    }

    forceLastFramePose(){
        for( let part in this.jointsData ){
            this.skeleton.bones[ this.jointsData[ part ].idx ].quaternion.copy( this.jointsData[ part ].lastFrameQuat );
        }
    }

    update( dt, forceBearing, forceElevation, forceTilt ){
        if ( !this.transition ){ return; }

        let transition = false;

        let tiltFBAngle = 0; //forceElevation;
        for ( let i = 0; i < this.tiltFB.length; ++i ){
            let o = this.tiltFB[i];
            o.update( dt );
            if ( !o.transition ){ this.tiltFB.splice( i, 1 ); --i; }
            tiltFBAngle += o.curValue;
            transition |= o.transition;
        }

        let tiltLRAngle = 0; //forceTilt;
        for ( let i = 0; i < this.tiltLR.length; ++i ){
            let o = this.tiltLR[i];
            o.update( dt );
            if ( !o.transition ){ this.tiltLR.splice( i, 1 ); --i; }
            tiltLRAngle += o.curValue;
            transition |= o.transition;
        }

        let rotateLRAngle = 0; //forceBearing;
        for ( let i = 0; i < this.rotateLR.length; ++i ){
            let o = this.rotateLR[i];
            o.update( dt );
            if ( !o.transition ){ this.rotateLR.splice( i, 1 ); --i; }
            rotateLRAngle += o.curValue;
            transition |= o.transition;
        }

        this.transition = transition;
        let q = this._tempQ_0;

        for( let part in this.jointsData ){
            let data = this.jointsData[ part ];
            let bone = this.skeleton.bones[ data.idx ];
            bone.quaternion.setFromAxisAngle( data.beforeBindAxes[1], rotateLRAngle *0.3333 ); // y
            q.setFromAxisAngle( data.beforeBindAxes[0], tiltFBAngle *0.3333); // x
            bone.quaternion.premultiply( q );
            q.setFromAxisAngle( data.beforeBindAxes[2], tiltLRAngle *0.3333); // z
            bone.quaternion.premultiply( q );
            bone.quaternion.premultiply( data.bindQuat ); // probably should MULTIPLY bind quat (previously adjusting axes)
            bone.quaternion.normalize();
            this.jointsData[part].lastFrameQuat.copy( bone.quaternion );
        }
    }

    newGestureBML( bml ){
        let amount = parseFloat( bml.amount );
        if ( isNaN( amount ) ){ amount = 1; }
        amount = amount * 15 * Math.PI / 180;
        let dstBuffer = null;
        switch( bml.bodyMovement ){
            case "TILT_LEFT": case "TL": amount *= -1;
            case "TILT_RIGHT": case "TR": dstBuffer = this.tiltLR;
                break;
            case "TILT_BACKWARD": case "TB": amount *= -1;
            case "TILT_FORWARD": case "TF": dstBuffer = this.tiltFB;
                break;
            case "ROTATE_RIGHT": case "RR": amount *= -1;
            case "ROTATE_LEFT": case "RL": dstBuffer = this.rotateLR;
                break;
        }

        if ( dstBuffer ){
            let b = new BasicBMLValueInterpolator(this.config, this.skeleton );
            b.newGestureBML( amount, bml.start, bml.attackPeak, bml.relax, bml.end );
            dstBuffer.push( b );
            this.transition = true;
        }

        return true;
    }
}



export { ElbowRaise, ShoulderRaise, ShoulderHunch, BodyMovement }
