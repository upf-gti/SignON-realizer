\perturbNormal.block

    mat3 cotangent_frame(vec3 N, vec3 p, vec2 uv) {

        // get edge vectors of the pixel triangle
        #ifdef STANDARD_DERIVATIVES
        
        vec3 dp1 = dFdx( p );
        vec3 dp2 = dFdy( p );
        vec2 duv1 = dFdx( uv );
        vec2 duv2 = dFdy( uv );
        
        // solve the linear system
        vec3 dp2perp = cross( dp2, N );
        vec3 dp1perp = cross( N, dp1 );
        vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
        vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
        #else
        vec3 T = vec3(1.0,0.0,0.0); //this is wrong but its a fake solution
        vec3 B = cross(N,T);
        T = cross(B,N);
        #endif
        
        // construct a scale-invariant frame
        float invmax = inversesqrt( max( dot(T,T), dot(B,B) ) );
        return mat3( T * invmax, B * invmax, N );
    }

    vec3 perturbNormal( vec3 N, vec3 V, vec2 texcoord, vec3 normal_pixel ){
        // assume N, the interpolated vertex normal and
        // V, the view vector (vertex to eye)
        //vec3 normal_pixel = texture2D(normalmap, texcoord ).xyz;
        normal_pixel = normal_pixel * 255./127. - 128./127.;
        mat3 TBN = cotangent_frame(N, V, texcoord);
        return normalize(TBN * normal_pixel);
    }

    vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {
        vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );
        vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );
        vec2 st0 = dFdx( vUv.st );
        vec2 st1 = dFdy( vUv.st );
        vec3 N = surf_norm;
        vec3 q1perp = cross( q1, N );
        vec3 q0perp = cross( N, q0 );
        vec3 T = q1perp * st0.x + q0perp * st1.x;
        vec3 B = q1perp * st0.y + q0perp * st1.y;
        float det = max( dot( T, T ), dot( B, B ) );
        float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );
        return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );
    }

\alphaNoise.block

    float hash_2d(vec2 p) {
        return fract(1.0e4 * sin(17.0 * p.x + 0.1 * p.y) * (0.1 + abs(sin(13.0 * p.y + p.x))));
    }
    float hash_3d(vec3 p) {
        return hash_2d(vec2(hash_2d(p.xy), p.z));
    }
    float compute_alpha_hash_threshold(vec3 pos, float hash_scale) {
        vec3 dx = dFdx(pos);
        vec3 dy = dFdx(pos);
        float delta_max_sqr = max(length(dx), length(dy));
        float pix_scale = 1.0 / (hash_scale * delta_max_sqr);

        vec2 pix_scales =
                vec2(exp2(floor(log2(pix_scale))), exp2(ceil(log2(pix_scale))));

        vec2 a_thresh = vec2(hash_3d(floor(pix_scales.x * pos.xyz)),
                hash_3d(floor(pix_scales.y * pos.xyz)));

        float lerp_factor = fract(log2(pix_scale));

        float a_interp = (1.0 - lerp_factor) * a_thresh.x + lerp_factor * a_thresh.y;

        float min_lerp = min(lerp_factor, 1.0 - lerp_factor);

        vec3 cases = vec3(a_interp * a_interp / (2.0 * min_lerp * (1.0 - min_lerp)),
                (a_interp - 0.5 * min_lerp) / (1.0 - min_lerp),
                1.0 - ((1.0 - a_interp) * (1.0 - a_interp) /
                            (2.0 * min_lerp * (1.0 - min_lerp))));

        float alpha_hash_threshold =
                (lerp_factor < (1.0 - min_lerp)) ? ((lerp_factor < min_lerp) ? cases.x : cases.y) : cases.z;

        return clamp(alpha_hash_threshold, 0.0, 1.0);
    }

\gBufferFrag

    precision mediump float;
    #define varying in
    layout(location = 0) out highp vec4 pc_fragColor0;
    layout(location = 1) out highp vec4 pc_fragColor1;
    layout(location = 2) out highp vec4 pc_fragColor2;
    layout(location = 3) out highp vec4 pc_fragColor3;

    #define texture2D texture
    #define HIGH_PRECISION
    #define STANDARD 

    #define USE_UV
    precision highp float;
    precision highp int;
    
    #import THREE.common
    #import THREE.packing
    #import THREE.uv_pars_fragment

    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vWorldNormal;

    uniform sampler2D map;
    uniform sampler2D specularMap;
    uniform sampler2D normalMap;
    uniform sampler2D alphaMap;
    uniform sampler2D sssMap;
    
    #import perturbNormal 
    #import alphaNoise

    // GLTF textures come in linear space
    vec4 GammaToLinear( vec4 value ) { return vec4( pow(value.rgb, vec3(2.2)), value.a ); }    

    void main() {
    
        vec4 diffuse = texture2D( map, vUv );
        float alpha = diffuse.a;

        float specularValue = texture2D( specularMap, vUv ).r;

        vec3 normalMapColor = texture2D( normalMap, vUv ).rgb;
        vec3 N = normalize( vWorldNormal );
        vec3 V = normalize( cameraPosition - vWorldPosition );
        vec3 detailedN  = perturbNormal( N, V, vUv, normalMapColor );
        float sss = texture2D( sssMap, vUv ).r;
        
        #ifdef ALPHA_TEST
            alpha = texture2D( alphaMap, vUv ).r;
            if (alpha < compute_alpha_hash_threshold(vViewPosition, 1.5)) {
                discard;
            }
        #endif

        pc_fragColor0 = vec4(diffuse.rgb, alpha);
        pc_fragColor1 = vec4(vWorldPosition, sss);

        float maskValue = 0.0;

        #ifdef IS_BODY
            maskValue = 10.0; // It has to be greater than 1..
        #endif

        #ifndef SKIP_NORMALS
            pc_fragColor2 = vec4(N * 0.5 + vec3(0.5), maskValue + specularValue);
            pc_fragColor3 = vec4(detailedN * 0.5 + 0.5, 1.0 - alpha);
        #else
            pc_fragColor2 = vec4(0.0);
            pc_fragColor3 = vec4(0.0);
        #endif
    }