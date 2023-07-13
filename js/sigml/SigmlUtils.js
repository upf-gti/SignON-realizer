function quadraticBezierVec3( a, b, c, out, t ){
    let invT = 1.0 - t;
    let ta = invT * invT;
    let tb = 2 * t * invT;
    let tc = t * t;

    out.x = a.x * ta + b.x * tb + c.x * tc;
    out.y = a.y * ta + b.y * tb + c.y * tc;
    out.z = a.z * ta + b.z * tb + c.z * tc;
    return out;
}

function cubicBezierVec3( a, b, c, d, out, t ){
    let invT = 1.0 - t;
    let ta = invT * invT * invT;
    let tb = 3 * t * invT * invT;
    let tc = 3 * t * t * invT;
    let td = t * t * t;

    out.x = a.x * ta + b.x * tb + c.x * tc + d.x * td;
    out.y = a.y * ta + b.y * tb + c.y * tc + d.y * td;
    out.z = a.z * ta + b.z * tb + c.z * tc + d.z * td;
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
    //q.x = -q.x;
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
function getTwistSwingQuaternions( q, normAxis, outTwist, outSwing ){
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

function getTwistQuaternion( q, normAxis, outTwist ){
    let dot =  q.x * normAxis.x + q.y * normAxis.y + q.z * normAxis.z;
    outTwist.set( dot * normAxis.x, dot * normAxis.y, dot * normAxis.z, q.w )
    outTwist.normalize(); // already manages (0,0,0,0) quaternions by setting identity
    return outTwist;
}

// symmetry string
function directionStringSymmetry( str, flags ){
    let result = str;

    if ( flags & 0x01 ){ // left-right symmetry
        if ( result.includes( "l" ) ){ result = result.replace( "l", "r" ); } 
        else if( result.includes( "r" ) ){ result =result.replace( "r", "l" ); }
    }

    if ( flags & 0x02 ){ // up-down symmetry
        if ( result.includes( "u" ) ){ result = result.replace( "u", "d" ); } 
        else if( result.includes( "d" ) ){ result =result.replace( "d", "u" ); }
    }

    if ( flags & 0x04 ){ // in-out symmetry
        if ( result.includes( "i" ) ){ result = result.replace( "i", "o" ); } 
        else if( result.includes( "o" ) ){ result =result.replace( "o", "i" ); }
    }

    return result;
}


// symmetry bit0 = left-right, bit1 = up-down, bit2 = in-out symmetry
function stringToDirection( str, outV, symmetry = 0x00 ){
    outV.set(0,0,0);
    if ( typeof( str ) != "string" ){ return false; }

    let success = false;

    // right hand system
    if ( str.includes( "l" ) ){ outV.x += 1; success = true; } 
    if ( str.includes( "r" ) ){ outV.x -= 1; success = true; }
    if ( str.includes( "u" ) ){ outV.y += 1; success = true; } 
    if ( str.includes( "d" ) ){ outV.y -= 1; success = true; }
    if ( str.includes( "o" ) ){ outV.z += 1; success = true; } 
    if ( str.includes( "i" ) ){ outV.z -= 1; success = true; }

    if ( symmetry & 0x01 ){ outV.x *= -1; }
    if ( symmetry & 0x02 ){ outV.y *= -1; }
    if ( symmetry & 0x04 ){ outV.z *= -1; }

    outV.normalize();
    return success;
}


// Skeleton

// O(n)
function findIndexOfBone( skeleton, name ){
    let b = skeleton.bones;
    for( let i = 0; i < b.length; ++i ){
        if ( b[i].name == name ){ return i; }
    }
    return -1;
}

export { quadraticBezierVec3, cubicBezierVec3,  mirrorQuat, mirrorQuatSelf, nlerpQuats, getTwistSwingQuaternions, getTwistQuaternion,  directionStringSymmetry, stringToDirection,  findIndexOfBone }