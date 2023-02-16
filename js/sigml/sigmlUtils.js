
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

export { mirrorQuat, mirrorQuatSelf, nlerpQuats, twistSwingQuats }