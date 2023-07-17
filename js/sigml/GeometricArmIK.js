import * as THREE from "three";
import { getTwistQuaternion } from "./SigmlUtils.js";

class GeometricArmIK{
    constructor( skeleton, shoulderIndex, shouldeUnionSpineIndex, isLeftHand = false ){
        this.skeleton = skeleton;
        this.shoulderIndex = shoulderIndex;
        this.isLeftHand = !!isLeftHand;

        this.shoulderBone = this.skeleton.bones[ shoulderIndex];
        this.armBone = this.skeleton.bones[ shoulderIndex + 1 ];
        this.elbowBone = this.skeleton.bones[ shoulderIndex + 2 ];
        this.wristBone = this.skeleton.bones[ shoulderIndex + 3 ];

        // arm axes
        this.zAxis = this.elbowBone.position.clone().normalize();
        this.yAxis = new THREE.Vector3(0,1,0);
        this.xAxis = new THREE.Vector3(1,0,0);
        this.yAxis.crossVectors( this.zAxis, this.xAxis ).normalize();
        this.xAxis.crossVectors( this.yAxis, this.zAxis ).normalize();

        // elbow axis
        this.elbowRotAxis = this.elbowBone.position.clone().normalize();
        this.elbowRotAxis.crossVectors( new THREE.Vector3(0,1,0), this.elbowRotAxis ).normalize();

        this.elbowSize = this.elbowBone.position.length();
        this.wristSize = this.wristBone.position.length();            
        this.armSize = this.wristSize + this.elbowSize;

        this.shoulderRestQuaternion = new THREE.Quaternion();
        let m1 = this.skeleton.boneInverses[ shoulderIndex ].clone().invert();
        let m2 = this.skeleton.boneInverses[ shouldeUnionSpineIndex ]; // 3
        m1.premultiply(m2);
        this.shoulderRestQuaternion.setFromRotationMatrix(m1);


        this._tempM4_0 = new THREE.Matrix4();
        this._tempQ_0 = new THREE.Quaternion();
        this._tempV3_0 = new THREE.Vector3(); // local target
        this._tempV3_1 = new THREE.Vector3(); // local target direction normalized
        this._tempV3_2 = new THREE.Vector3(); // target projection into arm coordinates
        this._tempV3_3 = new THREE.Vector3(); // new wrist position normalized
        this._tempV3_4 = new THREE.Vector3();
    }

    reachTarget( targetWorldPoint, forcedElbowRaiseDelta = 0, forcedShoulderRaise = 0, forcedShoulderHunch = 0, armTwistCorrection = true ){
        let wristBone = this.wristBone;
        let elbowBone = this.elbowBone;
        let armBone = this.armBone;
        let shoulderBone = this.shoulderBone;

        elbowBone.quaternion.set(0,0,0,1);
        armBone.quaternion.set(0,0,0,1);
        shoulderBone.quaternion.copy( this.shoulderRestQuaternion );

        let elbowSize = this.elbowSize;
        let wristSize = this.wristSize;            
        let armSize = wristSize + elbowSize;

        // axes of the arm
        let zAxis = this.zAxis;
        let yAxis = this.yAxis;
        let xAxis = this.xAxis;


        let _tempM4_0 = this._tempM4_0;
        let _tempQ_0 = this._tempQ_0;
        let _tempV3_0 = this._tempV3_0; // local target
        let _tempV3_1 = this._tempV3_1; // local target direction normalized
        let _tempV3_2 = this._tempV3_2; // target projection into arm coordinates
        let _tempV3_3 = this._tempV3_3; // new wrist position normalized
        let _tempV3_4 = this._tempV3_4;

        // first compute of localtarget, without shoulder correction
        wristBone.updateWorldMatrix( true ); // update self and parents
        _tempM4_0.copy( armBone.matrixWorld ).invert();
        let localTarget = _tempV3_0.copy(targetWorldPoint).applyMatrix4( _tempM4_0 );
        let localTargetNorm = _tempV3_1.copy(localTarget).normalize();
        let targetDistance = Math.max( 0.000001, Math.min( armSize, localTarget.length() ) ); // ensure there is a solution
        localTarget.copy( localTargetNorm ).multiplyScalar( targetDistance );

        // shoulder correction - Aesthetics. TODO: clean, a bit convoluted
        let armProjection = _tempV3_2.set( xAxis.dot( localTarget ), yAxis.dot( localTarget ), zAxis.dot( localTarget ) );
        armProjection.x *= this.isLeftHand ? -1 : 1;
        let forwardCorrection = Math.sin( -Math.PI*0.5 + Math.PI * Math.max( 0, Math.min( 1, -armProjection.z / armSize ) ) ) * 0.5 + 0.5;  // how lateral it is --> radians * factor; factor = sin( -90 + 180 * targetRatio )
        forwardCorrection = Math.PI*0.30 * forwardCorrection; //  how lateral it is
        forwardCorrection += forcedShoulderHunch;
        forwardCorrection = Math.max( - Math.PI*0.1, Math.min( Math.PI*0.3, forwardCorrection ) );
        forwardCorrection *= this.isLeftHand ? -1 : 1;  
        let forwardCorrectionQuat = _tempQ_0.setFromAxisAngle( yAxis, forwardCorrection );
        shoulderBone.quaternion.multiply( forwardCorrectionQuat )
        
        let upwardsCorrection = Math.max(0, Math.min( 1, (armProjection.y + armSize*0.25) / (armSize) ));
        upwardsCorrection = Math.sin( upwardsCorrection * Math.PI - Math.PI*0.5) *0.5 + 0.5;
        upwardsCorrection = Math.PI * 0.2 * upwardsCorrection;
        upwardsCorrection += forcedShoulderRaise;
        let upwardsCorrectionQuat = _tempQ_0.setFromAxisAngle( xAxis, -upwardsCorrection );
        shoulderBone.quaternion.multiply( upwardsCorrectionQuat );

        // recompute localtarget and armprojection
        shoulderBone.updateMatrixWorld(true);
        armBone.updateMatrixWorld(true);
        _tempM4_0.copy( armBone.matrixWorld ).invert();
        localTarget = _tempV3_0.copy( targetWorldPoint ).applyMatrix4( _tempM4_0 );
        armProjection = _tempV3_2.set( xAxis.dot( localTarget ), yAxis.dot( localTarget ), zAxis.dot( localTarget ) );
        localTargetNorm = _tempV3_1.copy(localTarget).normalize();
        targetDistance = Math.max( 0.000001, Math.min( armSize, localTarget.length() ) ); // ensure there is a solution
        localTarget.copy( localTargetNorm ).multiplyScalar( targetDistance );

        // elbow
        // c*c = a*a + b*b + 2ab*cos(C)
        let value = ( elbowSize*elbowSize + wristSize*wristSize - targetDistance*targetDistance ) / ( 2 * wristSize * elbowSize ); // law of cosines before arcos
        let elbowAngle = Math.PI - Math.acos( Math.max( -0.999999999, Math.min( 0.999999999, value ) ) ); // ensure there is a solution
        elbowAngle = ( elbowAngle > 2.8 ) ? 2.8 : elbowAngle; // avoid edge cases. If forearm is too large it can go over the shoulder point and corrupt the bearing
        elbowBone.quaternion.setFromAxisAngle( this.elbowRotAxis, -elbowAngle );

        // new wrist position normalized
        _tempV3_3.copy( wristBone.position ).applyQuaternion( elbowBone.quaternion );
        _tempV3_3.add( elbowBone.position );
        let newWristPosNorm = _tempV3_3.normalize();

        // elbow raise
        let automaticElbowRaise = 0;
        let f = Math.min( 1, Math.max( 0, - armProjection.z / ( armSize * 0.5 ) ) );
        automaticElbowRaise = - Math.PI * 0.1 * ( 1 - f ) - Math.PI * 0.3 * f;
        automaticElbowRaise +=  -forcedElbowRaiseDelta;
        if ( this.isLeftHand ){ automaticElbowRaise *= -1; }
        armBone.quaternion.premultiply( _tempQ_0.setFromAxisAngle( newWristPosNorm, automaticElbowRaise ) );

        // only elbow folded. Compute this elevation+bearing and the target elevation+bearing and compute delta angles for quaternion
        let projectionTarget = _tempV3_4.set( xAxis.dot( localTargetNorm ), yAxis.dot( localTargetNorm ), zAxis.dot( localTargetNorm ) );
        let elevationDest = Math.atan2( projectionTarget.y, Math.sqrt(projectionTarget.x*projectionTarget.x + projectionTarget.z*projectionTarget.z) );
        let bearingDest = Math.atan2( projectionTarget.x, projectionTarget.z );

        let projectionWrist = _tempV3_4.set( xAxis.dot( newWristPosNorm ), yAxis.dot( newWristPosNorm ), zAxis.dot( newWristPosNorm ) );
        let elevationSrc = Math.atan2( projectionWrist.y, Math.sqrt(projectionWrist.x*projectionWrist.x + projectionWrist.z*projectionWrist.z) );
        let bearingSrc = Math.atan2( projectionWrist.x, projectionWrist.z );

        let resultElevation = ( elevationDest - elevationSrc );
        let resultBearing = ( bearingDest - bearingSrc );
        armBone.quaternion.premultiply( _tempQ_0.setFromAxisAngle( xAxis, -resultElevation ) );
        armBone.quaternion.premultiply( _tempQ_0.setFromAxisAngle( yAxis, resultBearing ) );


        if ( armTwistCorrection ) { this._correctArmTwist(); }
    }


    assignAngles( elbowAngle, elbowRaiseAngle, armElevationAngle, armBearingAngle, shoulderForwardAngle, shoulderUpwardAngle, armTwistCorrection = true ){
        let wristBone = this.wristBone;
        let elbowBone = this.elbowBone;
        let armBone = this.armBone;
        let shoulderBone = this.shoulderBone;

        wristBone.quaternion.set(0,0,0,1);
        elbowBone.quaternion.set(0,0,0,1);
        armBone.quaternion.set(0,0,0,1);
        shoulderBone.quaternion.copy( this.shoulderRestQuaternion );

        // axes of the arm
        let yAxis = this.yAxis;
        let xAxis = this.xAxis;

        let _tempQ_0 = this._tempQ_0;

        // shoulder
        if ( this.isLeftHand ){ shoulderForwardAngle *= -1; }
        let forwardCorrectionQuat = _tempQ_0.setFromAxisAngle( yAxis, shoulderForwardAngle );
        shoulderBone.quaternion.multiply( forwardCorrectionQuat )
        let upwardsCorrectionQuat = _tempQ_0.setFromAxisAngle( xAxis, -shoulderUpwardAngle );
        shoulderBone.quaternion.multiply( upwardsCorrectionQuat );

        // elbow
        elbowBone.quaternion.setFromAxisAngle( this.elbowRotAxis, -elbowAngle );

        // elbow raise
        if ( this.isLeftHand ){ elbowRaiseAngle *= -1; }
        armBone.quaternion.premultiply( _tempQ_0.setFromAxisAngle( newWristPosNorm, elbowRaiseAngle ) );

        // arm
        armBone.quaternion.premultiply( _tempQ_0.setFromAxisAngle( xAxis, -armElevationAngle ) );
        armBone.quaternion.premultiply( _tempQ_0.setFromAxisAngle( yAxis, armBearingAngle ) );

        if ( armTwistCorrection ) { this._correctArmTwist(); }
    }


    // remove arm twisting and insert it into elbow. Just for aesthetics
    _correctArmTwist(){
        let wristBone = this.wristBone;
        let elbowBone = this.elbowBone;
        let armBone = this.armBone;

        // remove arm twisting and insert it into elbow
        // (quaternions) R = S * T ---> T = normalize( [ Wr, proj(Vr) ] ) where proj(Vr) projection into some arbitrary twist axis
        let twistq = this._tempQ_0;
        let twistAxis = this._tempV3_4.copy(elbowBone.position).normalize();
        getTwistQuaternion( armBone.quaternion, twistAxis, twistq );
        elbowBone.quaternion.premultiply( twistq );
        armBone.quaternion.multiply( twistq.invert() );

        // previous fix might induce some twisting in forearm. remove forearm twisting. Keep only swing rotation
        twistAxis = this._tempV3_4.copy(wristBone.position).normalize();
        getTwistQuaternion( elbowBone.quaternion, twistAxis, twistq );
        elbowBone.quaternion.multiply( twistq.invert() );
    }
}

export { GeometricArmIK };