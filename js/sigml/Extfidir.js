import * as THREE from "three";
import { stringToDirection, nlerpQuats } from "./SigmlUtils.js";

// receives bml instructions and animates the wrists. Swing rotation only 
class Extfidir {
    constructor( config, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.isLeftHand = !!isLeftHand;

        let boneMap = config.boneMap;

        let handName = ( isLeftHand ) ? "L" : "R";
        let bones = this.skeleton.bones;
        this.idx = boneMap[ handName + "Wrist" ]; // wrist index
        this.wristBone = bones[ this.idx ];
        this.twistAxis = ( new THREE.Vector3() ).copy( bones[ boneMap[ handName + "HandMiddle" ] ].position ).normalize();
        this.leftAxis = ( new THREE.Vector3() ).subVectors( 
            isLeftHand ? bones[ boneMap[ handName + "HandRing" ] ].position : bones[ boneMap[ handName + "HandIndex" ] ].position, 
            isLeftHand ? bones[ boneMap[ handName + "HandIndex" ] ].position : bones[ boneMap[ handName + "HandRing" ] ].position ).normalize();
        this.upAxis = ( new THREE.Vector3() ).crossVectors( this.twistAxis, this.leftAxis ).normalize(); // compute Y
        this.leftAxis.crossVectors( this.upAxis, this.twistAxis ).normalize(); // compute X
        
        this.defPoint = new THREE.Vector3();
        this.trgPoint = new THREE.Vector3(); 
        // no defG  = new THREE.Quaternion. Will reuse srcG and trgG during relax-end
        this.trgG = new THREE.Quaternion();
        this.srcG = new THREE.Quaternion();
        this.curG = new THREE.Quaternion();
        
        // when extfidir is "inwards", the "l" and "r" are swapped. Make the change gradually
        this.srcPalmorRefactor = 1;
        this.trgPalmorRefactor = 1;
        this.curPalmorRefactor = 1;
        this.defPalmorRefactor = 1;
        
        // when positioning the hand "outwards down", there might be some twist needed for the forearm.
        this.foreArmCorrectionAngle = 0;
        
        
        this.reset();
        
        this.time = 0; // current time of transition
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0; 
        this.end = 0;
        this.transition = false;

        this._tempMat4_0 = new THREE.Matrix4();
        this._tempV3_0 = new THREE.Vector3(); // world pos and cross products
        this._tempV3_1 = new THREE.Vector3(); // z axis
        this._tempV3_2 = new THREE.Vector3(); // x axis
        this._tempV3_3 = new THREE.Vector3(); // y axis
        this._tempQ_0 = new THREE.Quaternion();
    }

    reset() {
        // Force pose update to flat
        this.transition = false;

        stringToDirection( "o", this.defPoint );
        this.defPalmorRefactor = 1;
        this.curPalmorRefactor = 1;
        this.foreArmCorrectionAngle = 0;
    }

    
    // compute the swing rotation so as to get the twistAxis to point at a certain location. It finds the forearm twist correction
    _computeSwingFromCurrentPose( targetPoint, resultWristQuat ){
        let elevation = Math.atan2( targetPoint.y, Math.sqrt( targetPoint.x * targetPoint.x + targetPoint.z * targetPoint.z ) );
        let bearing = Math.atan2( targetPoint.x, targetPoint.z );
        
        // this solves ir
        if ( this.isLeftHand ){ 
            if ( bearing > 1.58825 ){ bearing -= Math.PI * 2; } 
        } 
        else {
            if ( bearing < -1.58825 ){ bearing += Math.PI * 2; } 
        }


        let wristBone = this.wristBone;
        wristBone.quaternion.set(0,0,0,1); // swing computation requires it to be with no palmor
        wristBone.updateWorldMatrix( true );
        let invWorld = this._tempMat4_0;
        invWorld.copy( wristBone.matrixWorld );
        invWorld.invert();
        let wristWorldPos = this._tempV3_0;
        wristWorldPos.setFromMatrixPosition( wristBone.matrixWorld );
        
        let worldZAxisToLocal = this._tempV3_1.set(0,0,10000);
        worldZAxisToLocal.add(wristWorldPos);
        worldZAxisToLocal.applyMatrix4( invWorld );
        worldZAxisToLocal.normalize();
        
        let worldXAxisToLocal = this._tempV3_2.set(10000,0,0);
        worldXAxisToLocal.add( wristWorldPos );
        worldXAxisToLocal.applyMatrix4( invWorld );
        worldXAxisToLocal.normalize();
        
        let worldYAxisToLocal = this._tempV3_3.crossVectors( worldZAxisToLocal, worldXAxisToLocal ).normalize();
        
        // make hand point out in world coordinates ( +Z )
        let angle = Math.acos( this.twistAxis.dot( worldZAxisToLocal ) );
        let rotAx = this._tempV3_0;
        rotAx.crossVectors( this.twistAxis, worldZAxisToLocal );
        rotAx.normalize();
        resultWristQuat.setFromAxisAngle( rotAx, angle );

        // adjust hand orientation so it is facing down in world coordinates
        let newLeftAxis = this._tempV3_0.copy( this.leftAxis ).applyQuaternion( resultWristQuat );
        angle = Math.acos( newLeftAxis.dot( worldXAxisToLocal ) );
        rotAx.crossVectors( newLeftAxis, worldXAxisToLocal ); // should be worldZAxis, but sign might differ
        rotAx.normalize();
        this._tempQ_0.setFromAxisAngle( rotAx, angle );
        resultWristQuat.premultiply( this._tempQ_0 );

        this.foreArmCorrectionAngle = angle * ( worldZAxisToLocal.dot( rotAx ) < 0 ? -1 : 1 );
        
        // now, add extfidir        
        let elevationRot = this._tempQ_0.setFromAxisAngle( worldXAxisToLocal, -elevation ); // -elevation because of the axis vs atan
        resultWristQuat.premultiply( elevationRot );
        let bearingRot = this._tempQ_0.setFromAxisAngle( worldYAxisToLocal, bearing );
        resultWristQuat.premultiply( bearingRot );

    }

    update( dt ) {

        // if ( !this.transition ){ return; } // no animation required
        
        this.time += dt;

        // wait in same pose
        if ( this.time < this.start ){ this.curPalmorRefactor = this.srcPalmorRefactor; return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ 
            this._computeSwingFromCurrentPose( this.trgPoint, this.trgG ); // trgG update needed for relax-end
            this.curG.copy( this.trgG );
            this.curPalmorRefactor = this.trgPalmorRefactor;
            return; 
        }
        
        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            this._computeSwingFromCurrentPose( this.trgPoint, this.trgG );
            nlerpQuats( this.curG, this.srcG, this.trgG, t );
            // this.curG.slerpQuaternions( this.srcG, this.trgG, t ); // slerp performs worse than nlerp for some reason (about appearance, not hardware performance)
            this.curPalmorRefactor = this.srcPalmorRefactor * (1-t) + this.trgPalmorRefactor * t;
            return;
        }

        if ( this.time < this.end ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            this._computeSwingFromCurrentPose( this.defPoint, this.srcG ); 
            nlerpQuats( this.curG, this.trgG, this.srcG, t ); // reusing srcG as defG
            // this.curG.slerpQuaternions( this.trgG, this.srcG, t ); // slerp performs worse than nlerp for some reason (about appearance, not hardware performance)
            this.curPalmorRefactor = this.trgPalmorRefactor * (1-t) + this.defPalmorRefactor * t;
            return;
        }
        
        // local extfidir does not require constant update
        if ( this.time >= this.end ){ 
            this._computeSwingFromCurrentPose( this.defPoint, this.curG );
            this.curPalmorRefactor = this.defPalmorRefactor;
            this.transition = false;
        }

    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * extfidir: string from sides
     * secondExtfidir: (optional) string from sides. Will compute midpoint between extifidir and secondExtfidir
     */
    newGestureBML( bml, symmetry = false ){
        if( !bml.extfidir ){ return; }
      
        if( !stringToDirection( bml.extfidir, this.trgPoint, symmetry ) ){ 
            console.warn( "Gesture: Extfidir incorrect direction \"" + bml.extfidir + "\"" );
            return; 
        }
        if( stringToDirection( bml.secondExtfidir, this._tempV3_0, symmetry ) ){
            this.trgPoint.lerpVectors( this.trgPoint, this._tempV3_0, 0.5 );
            this.trgPoint.normalize();
        }
        
        this.trgPalmorRefactor = this.trgPoint.z < 0 ? -1 : 1;
        this.srcPalmorRefactor = this.curPalmorRefactor;
        // set defualt point if necessary
        if( bml.shift ){
            this.defPoint.copy( this.trgPoint );
            this.defPalmorRefactor = this.trgPalmorRefactor;
        }
        
        // set source pose swing quaternions
        this.srcG.copy( this.curG );

        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0; 
        
        this.transition = true;


    }

}

export { Extfidir };