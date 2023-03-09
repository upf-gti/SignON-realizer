import { Vector3 } from "three";

let tempVec3 = new Vector3(0,0,0);
function cubicBezierVec3( a, b, c, d, out, t ){
    let invT = 1.0 - t;
    tempVec3.copy(a);
    tempVec3.multiplyScalar( invT * invT * invT );
    out.copy( tempVec3 );

    tempVec3.copy(b);
    tempVec3.multiplyScalar( 3* t * invT * invT );
    out.add( tempVec3 );

    tempVec3.copy(c);
    tempVec3.multiplyScalar( 3* t * t * invT );
    out.add( tempVec3 );

    tempVec3.copy(d);
    tempVec3.multiplyScalar( t * t * t );
    out.add( tempVec3 );

    return out;
}

// ------------ THREEJS Quaternions

// mirror THREE.Quaternion for avatars
function mirrorQuat( destQuat, srcQuat ){
    //destQuat.x = srcQuat.x;
    destQuat.y = -srcQuat.y;
    destQuat.z = -srcQuat.z;
    //destQuat.w = srcQuat.w;
}

function mirrorQuatSelf( q ){
    //q.x = srcQuat.x;
    q.y = -q.y;
    q.z = -q.z;
    //q.w = q.w;
}

// nlerp THREE.Quaternion. Good for interpolation between similar/close quaternions. Cheaper than slerp but might interpolate through the wrong/weird path. Use slerp (more expensive but finds shortest path)
function nlerpQuats( destQuat, qa, qb, t ){
    destQuat.x = qa.x * (1-t) + qb.x * t;
    destQuat.y = qa.y * (1-t) + qb.y * t;
    destQuat.z = qa.z * (1-t) + qb.z * t;
    destQuat.w = qa.w * (1-t) + qb.w * t;
    destQuat.normalize();
}

// decompose a quaternion into twist and swing quaternions. (Twist before swing decomposition). Arguments cannot be the same instance of quaternion
function twistSwingQuats( q, normAxis, outTwist, outSwing ){
    //  R = [ Wr, Vr ] = S * T  source rotation
    // T = norm( [ Wr, proj(Vr) ] ) twist 
    // S = R * inv(T)
    let dot =  q.x * normAxis.x + q.y * normAxis.y + q.z * normAxis.z;
    outTwist.set( dot * normAxis.x, dot * normAxis.y, dot * normAxis.z, q.w )
    outTwist.normalize(); // already manages (0,0,0,0) quaternions by setting identity

    outSwing.copy( outTwist );
    outSwing.invert(); // actually computes the conjugate so quite cheap
    outSwing.premultiply( q );
    outSwing.normalize();
}

export { cubicBezierVec3, mirrorQuat, mirrorQuatSelf, nlerpQuats, twistSwingQuats }