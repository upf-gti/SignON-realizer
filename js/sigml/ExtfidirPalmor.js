import * as THREE from "three";
import { stringToDirection, nlerpQuats } from "./Utils.js";


class ExtfidirPalmor { 
    constructor( config, skeleton, isLeftHand = false ){
        this.skeleton = skeleton;
        this.isLeftHand = !!isLeftHand;

        let boneMap = config.boneMap;
        let handName = ( isLeftHand ) ? "L" : "R";
        let bones = this.skeleton.bones;

        this.wristBone = bones[ boneMap[ handName + "Wrist" ] ];
        this.forearmBone = bones[ boneMap[ handName + "Elbow" ] ];

        // before-bind axes
        this.twistAxisForearm = ( new THREE.Vector3() ).copy( bones[ boneMap[ handName + "Wrist" ] ].position ).normalize(),
        this.twistAxisWrist = ( new THREE.Vector3() ).copy( bones[ boneMap[ handName + "HandMiddle" ] ].position ).normalize(),
        this.bearingAxis = ( new THREE.Vector3() ).crossVectors( bones[ boneMap[ handName + "HandRing" ] ].position, bones[ boneMap[ handName + "HandIndex" ] ].position ).multiplyScalar( isLeftHand ? -1: 1 ).normalize()
        this.elevationAxis = ( new THREE.Vector3() ).crossVectors( this.bearingAxis, this.twistAxisWrist ).normalize(); // compute elevation
        this.bearingAxis.crossVectors( this.twistAxisWrist, this.elevationAxis ).normalize(); // compute bearing
  
        this.palmor = {
            srcAngle: 0, // aprox
            trgAngle: 0,
            defAngle: 0,
        };

        this.extfidir = {
            trgDir: new THREE.Vector3(0,-1,0),
            defDir: new THREE.Vector3(0,-1,0),
        };

        this.curAproxPalmor = 0;
        this.srcQuat = new THREE.Quaternion(0,0,0,1);
        this.curQuat = new THREE.Quaternion(0,0,0,1);
        
        this.time = 0; // current time of transition
        this.start = 0;
        this.attackPeak = 0;
        this.relax = 0; 
        this.end = 0;
        this.transition = false;
        this.reset();

        this._tempMat3_0 = new THREE.Matrix3();
        this._tempV3_0 = new THREE.Vector3(); // world pos and cross products
        this._tempV3_1 = new THREE.Vector3(); // z axis
        this._tempV3_2 = new THREE.Vector3(); // x axis
        this._tempV3_3 = new THREE.Vector3(); // y axis
        this._tempQ_0 = new THREE.Quaternion();
    }

    reset() {
        // Force pose update to flat
        this.transition = false;
        this.curQuat.set(0,0,0,1);
        this.srcQuat.set(0,0,0,1);
        this.curAproxPalmor = 0;
        this.palmor.srcAngle = 0;
        this.palmor.trgAngle = 0;
        this.palmor.defAngle = 0;
        this.extfidir.trgDir.set(0,-1,0);
        this.extfidir.defDir.set(0,-1,0);
    }

      // compute the swing rotation so as to get the twistAxisWrist to point at a certain location. It finds the forearm twist correction
      _computeSwingFromCurrentPose( targetPoint, resultWristQuat ){
        let elevation = Math.atan2( targetPoint.y, Math.sqrt( targetPoint.x * targetPoint.x + targetPoint.z * targetPoint.z ) );
        let bearing = Math.atan2( targetPoint.x, targetPoint.z );
        
        // this solves ir
        if ( this.isLeftHand && bearing > 1.58825 ){ bearing -= Math.PI * 2; } 
        else if ( !this.isLeftHand && bearing < -1.58825 ){ bearing += Math.PI * 2; } 


        let wristBone = this.wristBone;
        wristBone.quaternion.set(0,0,0,1); // swing computation requires it to be with no palmor
        wristBone.updateWorldMatrix( true );
        let wToLMat3 = this._tempMat3_0.setFromMatrix4( wristBone.matrixWorld ).invert(); // gets only rotation (and scale)
        
        let worldZAxisToLocal = this._tempV3_1.set(0,0,1).applyMatrix3( wToLMat3 ).normalize();        
        let worldXAxisToLocal = this._tempV3_2.set(1,0,0).applyMatrix3( wToLMat3 ).normalize();        
        let worldYAxisToLocal = this._tempV3_3.crossVectors( worldZAxisToLocal, worldXAxisToLocal ).normalize();
        
        // make hand point out in world coordinates ( +Z )
        let angle = Math.acos( this.twistAxisWrist.dot( worldZAxisToLocal ) );
        let rotAx = this._tempV3_0;
        rotAx.crossVectors( this.twistAxisWrist, worldZAxisToLocal ).normalize();
        resultWristQuat.setFromAxisAngle( rotAx, angle );

        // adjust hand orientation so its palm is facing down in world coordinates ( 0,-1,0 )
        let newElevationAxis = this._tempV3_0.copy( this.elevationAxis ).applyQuaternion( resultWristQuat );
        angle = Math.acos( newElevationAxis.dot( worldXAxisToLocal ) );
        rotAx.crossVectors( newElevationAxis, worldXAxisToLocal ).normalize(); // should be worldZAxis, but sign might differ
        this._tempQ_0.setFromAxisAngle( rotAx, angle );
        resultWristQuat.premultiply( this._tempQ_0 );
      
        // now, add extfidir        
        let elevationRot = this._tempQ_0.setFromAxisAngle( worldXAxisToLocal, -elevation ); // -elevation because of how the axis is computed vs atan2
        resultWristQuat.premultiply( elevationRot );
        let bearingRot = this._tempQ_0.setFromAxisAngle( worldYAxisToLocal, bearing );
        resultWristQuat.premultiply( bearingRot );

    }

    update(dt){
        this.wristBone.quaternion.set(0,0,0,1);
        // if( !this.transition ){ return; }

        this.time += dt;
        if ( this.time < this.start ){ 
            this.wristBone.quaternion.copy( this.srcQuat );
        }
        else if ( this.time < this.attackPeak ){      
            this._computeSwingFromCurrentPose( this.extfidir.trgDir, this.curQuat );
            this._tempQ_0.setFromAxisAngle( this.twistAxisWrist, this.palmor.trgAngle );
            this.curQuat.multiply( this._tempQ_0 );
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            nlerpQuats( this.curQuat, this.srcQuat, this.curQuat, t );
            //this.curQuat.slerpQuaternions( this.srcQuat, this.curQuat, t );

            this.curAproxPalmor = this.palmor.srcAngle * (1-t) + this.palmor.trgAngle * t;
            this.wristBone.quaternion.copy( this.curQuat );
        }
        else if ( this.time < this.relax ){ 
            this._computeSwingFromCurrentPose( this.extfidir.trgDir, this.curQuat );
            this._tempQ_0.setFromAxisAngle( this.twistAxisWrist, this.palmor.trgAngle );
            this.curQuat.multiply( this._tempQ_0 );
            this.wristBone.quaternion.copy( this.curQuat );
            this.curAproxPalmor = this.palmor.trgAngle;
        }
        else { 
            this._computeSwingFromCurrentPose( this.extfidir.trgDir, this.srcQuat );
            this._tempQ_0.setFromAxisAngle( this.twistAxisWrist, this.palmor.trgAngle );
            this.srcQuat.multiply( this._tempQ_0 );

            this._computeSwingFromCurrentPose( this.extfidir.defDir, this.curQuat );
            this._tempQ_0.setFromAxisAngle( this.twistAxisWrist, this.palmor.defAngle );
            this.curQuat.multiply( this._tempQ_0 );

            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1 ){ 
                t = 1; 
                this.transition = false;
            }
            nlerpQuats( this.curQuat, this.srcQuat, this.curQuat, t );
            //this.curQuat.slerpQuaternions( this.srcQuat, this.curQuat, t ); 
            this.wristBone.quaternion.copy( this.curQuat );
            this.curAproxPalmor = this.palmor.trgAngle * (1-t) + this.palmor.defAngle * t;

        }
    }


    /**
     * bml info
     * start, attackPeak, relax, end
     * extfidir: string from sides
     * secondExtfidir: (optional) string from sides. Will compute midpoint between extifidir and secondExtfidir
    */
    newGestureBMLExtfidir( bml, symmetry = false ){
        if( !bml.extfidir ){ return; }
        
        if( !stringToDirection( bml.extfidir, this.extfidir.trgDir, symmetry, true ) ){ 
            console.warn( "Gesture: Extfidir incorrect direction \"" + bml.extfidir + "\"" );
            return false; 
        }
        this.extfidir.trgDir.normalize();
        if( stringToDirection( bml.secondExtfidir, this._tempV3_0, symmetry, true ) ){
            this.extfidir.trgDir.lerpVectors( this.extfidir.trgDir, this._tempV3_0, 0.5 );
            this.extfidir.trgDir.normalize();
        }
        
        // set defualt point if necessary
        if( bml.shift ){
            this.extfidir.defDir.copy( this.extfidir.trgDir );
        }  
        return true;  
    }

    /**
     * bml info
     * start, attackPeak, relax, end
     * palmor: string from palmorRightTable
     * secondPalmor: (optional)
    */
    newGestureBMLPalmor( bml, symmetry = 0x00 ){
        if( !bml.palmor ){ return; }

        // TODO (?): solve atan2(0,-0) == up    
        let result = this._tempV3_0;
        if ( !stringToDirection( bml.palmor, result, symmetry, true ) ){ return false; }
        let angle = Math.atan2( result.x, -result.y ); // -y so down is angle=0º
        
        if ( stringToDirection( bml.secondPalmor, result, symmetry, true ) ){ 
            let secondAngle = Math.atan2( result.x, -result.y ); // -y so down is angle=0º
            // find shortest path between angle and secondAngle. 
            // TODO (?): simply interpolate result vectors instead of angles to avoid this if
            if( Math.abs( angle - secondAngle ) > Math.PI ){
                if( ( angle - secondAngle ) < 0 ){ secondAngle -= 2 * Math.PI; }
                else{ secondAngle += 2 * Math.PI; }
            }
            angle = ( angle + secondAngle ) * 0.5
        }
        if ( !this.isLeftHand && angle < -120 * Math.PI/180 ){ angle += Math.PI *2; }
        else if ( this.isLeftHand && angle > 120 * Math.PI/180 ){ angle -= Math.PI *2; }
        // if ( !this.isLeftHand && angle < -140 * Math.PI/180 ){ angle += Math.PI *2; }
        // else if ( this.isLeftHand && angle > 140 * Math.PI/180 ){ angle -= Math.PI *2; }
        
        this.palmor.trgAngle = angle;

        // set defualt pose if necessary
        if ( bml.shift ){
            this.palmor.defAngle = this.palmor.trgAngle;
        }

        return true;
    }

    newGestureBML( bml, symmetry = 0x00 ){

        this.srcQuat.copy( this.curQuat );
        this.palmor.srcAngle = this.curAproxPalmor;

        if ( !this.newGestureBMLExtfidir( bml, symmetry ) ){
            if ( this.time > this.relax ){ this.extfidir.trgDir.copy( this.extfidir.defDir ); }
            // this.extfidir.trgDir.copy( this.extfidir.defDir );
        }
        symmetry = (symmetry & 0xfe) | ( ( symmetry & 0x01 ) ^ ( this.extfidir.trgDir.z < 0 ? 0x01 : 0x00 ) );
        if ( !this.newGestureBMLPalmor( bml, symmetry ) ){
            if ( this.time > this.relax ){ this.palmor.trgAngle = this.palmor.defAngle; }
            // this.palmor.trgAngle = this.palmor.defAngle;
        }

        this.time = 0;
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.transition = true; 

        return true;
    }
}


export { ExtfidirPalmor }; 
