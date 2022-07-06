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

\transmitance.block

    vec4 shadowCoord = directionalShadowCoord;
    vec2 shadowMapSize = directionalLightShadow.shadowMapSize;
    float shadowBias = directionalLightShadow.shadowBias;
    float shadowRadius = directionalLightShadow.shadowRadius;

    float shadow = getShadow( directionalShadowMap[ i ], shadowMapSize, shadowBias, shadowRadius, shadowCoord );
    shadowCoord.xyz /= shadowCoord.w;
    shadowCoord.z += shadowBias;

    float depthDiff = abs( shadow - shadowCoord.z );
    
    // Transmitance (we use vertex normal because it does not contain high frequency detail)
    float s = translucencyScale * depthDiff;
    float E = max(0.3 + dot(-normal, directLight.direction), 0.0) * mask;
    transmitance = T(s) * directionalLight.color * albedo * E;

\quadVert

    out vec2 vUv;
    out vec3 vViewPosition;
    out vec3 vNormal;

    #ifdef USE_SHADOWMAP
        #if NUM_DIR_LIGHT_SHADOWS > 0
            varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
        #endif
        #if NUM_SPOT_LIGHT_SHADOWS > 0
            varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHT_SHADOWS ];
        #endif
        #if NUM_POINT_LIGHT_SHADOWS > 0
            varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
        #endif
    #endif

    void main() {
        vNormal = vec3( normal );
        vUv = uv;
        vec4 mvPosition = vec4( position, 1.0 );
        mvPosition = modelViewMatrix * mvPosition;
        vViewPosition = - mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }

\gBufferVert

    precision mediump sampler2DArray;
    #define attribute in
    #define varying out
    #define texture2D texture
    precision highp float;
    precision highp int;
    #define HIGH_PRECISION
    #define STANDARD 
    #define VERTEX_TEXTURES
    #define MAX_BONES 1024
    #define USE_MAP
    #define USE_COLOR_ALPHA
    #define USE_NORMALMAP
    #define TANGENTSPACE_NORMALMAP
    #define USE_ROUGHNESSMAP
    #define USE_METALNESSMAP
    #define USE_UV
    #define USE_SKINNING
    #define BONE_TEXTURE
    // #define USE_MORPHTARGETS
    // #define USE_MORPHNORMALS
    // #define MORPHTARGETS_TEXTURE
    // #define MORPHTARGETS_COUNT 50
    #define USE_SHADOWMAP
    #define SHADOWMAP_TYPE_PCF
    #ifdef USE_INSTANCING
        attribute mat4 instanceMatrix;
    #endif
    #ifdef USE_INSTANCING_COLOR
        attribute vec3 instanceColor;
    #endif
    #ifdef USE_TANGENT
        attribute vec4 tangent;
    #endif

    #if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )
        attribute vec3 morphTarget0;
        attribute vec3 morphTarget1;
        attribute vec3 morphTarget2;
        attribute vec3 morphTarget3;
        #ifdef USE_MORPHNORMALS
            attribute vec3 morphNormal0;
            attribute vec3 morphNormal1;
            attribute vec3 morphNormal2;
            attribute vec3 morphNormal3;
        #else
            attribute vec3 morphTarget4;
            attribute vec3 morphTarget5;
            attribute vec3 morphTarget6;
            attribute vec3 morphTarget7;
        #endif
    #endif

    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;

    #include <common>
    #include <uv_pars_vertex>
    #include <color_pars_vertex>
    #include <fog_pars_vertex>
    #include <normal_pars_vertex>
    #include <morphtarget_pars_vertex>
    #include <skinning_pars_vertex>

    #ifdef USE_SHADOWMAP
        #if NUM_DIR_LIGHT_SHADOWS > 0
            uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
            varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
            struct DirectionalLightShadow {
                float shadowBias;
                float shadowNormalBias;
                float shadowRadius;
                vec2 shadowMapSize;
            };
            uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
        #endif
        #if NUM_SPOT_LIGHT_SHADOWS > 0
            uniform mat4 spotShadowMatrix[ NUM_SPOT_LIGHT_SHADOWS ];
            varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHT_SHADOWS ];
            struct SpotLightShadow {
                float shadowBias;
                float shadowNormalBias;
                float shadowRadius;
                vec2 shadowMapSize;
            };
            uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
        #endif
        #if NUM_POINT_LIGHT_SHADOWS > 0
            uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
            varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
            struct PointLightShadow {
                float shadowBias;
                float shadowNormalBias;
                float shadowRadius;
                vec2 shadowMapSize;
                float shadowCameraNear;
                float shadowCameraFar;
            };
            uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
        #endif
    #endif
   
    #include <logdepthbuf_pars_vertex>

    void main() {
        
        #include <uv_vertex>
        #include <color_vertex>
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <normal_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <displacementmap_vertex>
        #include <project_vertex>
        #include <logdepthbuf_vertex>
        #include <worldpos_vertex>

        vViewPosition =  - mvPosition.xyz;
        vWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );

        #ifdef USE_SHADOWMAP
            #if NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0
                vec3 shadowWorldNormal = vWorldNormal;
                vec4 shadowWorldPosition;
            #endif
            #if NUM_DIR_LIGHT_SHADOWS > 0
                
            #endif
            #if NUM_SPOT_LIGHT_SHADOWS > 0
                shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * spotLightShadows[ 0 ].shadowNormalBias, 0 );
                vSpotShadowCoord[ 0 ] = spotShadowMatrix[ 0 ] * shadowWorldPosition;
            #endif
            #if NUM_POINT_LIGHT_SHADOWS > 0
                shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ 0 ].shadowNormalBias, 0 );
                vPointShadowCoord[ 0 ] = pointShadowMatrix[ 0 ] * shadowWorldPosition;
            #endif
        #endif
        vWorldPosition = worldPosition.xyz;
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
    
    #include <common>
    #include <packing>
    #include <uv_pars_fragment>

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

\deferredFinal

    #define RE_Direct RE_Direct_BlinnPhong
    #define SHADOWMAP_TYPE_PCF
    #define USE_SHADOWMAP

    precision highp float;
    precision highp int;

    layout(location = 0) out highp vec4 pc_fragLight;
    layout(location = 1) out highp vec4 pc_fragTransmitance;
    layout(location = 2) out highp vec4 pc_fragDepth;

    in vec2 vUv;
    #include <common>
    #include <packing>
    #include <normal_pars_fragment>
    #include <lights_pars_begin>
    #include <bsdfs>
    #include <lights_phong_pars_fragment>
    #include <shadowmap_pars_fragment>

    uniform sampler2D map;
    uniform sampler2D normalMap;
    uniform sampler2D positionMap;
    uniform sampler2D depthMap;
    uniform sampler2D detailedNormalMap;
    uniform sampler2D transmitanceLut;
    
    uniform float ambientIntensity;
    uniform float specularIntensity;
    uniform float shadowShrinking;
    uniform float translucencyScale;
    
    uniform float cameraNear;
    uniform float cameraFar;
    uniform vec3  cameraEye;

    #if NUM_DIR_LIGHT_SHADOWS > 0
        uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
    #endif
    #if NUM_POINT_LIGHT_SHADOWS > 0
        uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
    #endif
    #if NUM_SPOT_LIGHT_SHADOWS > 0
        uniform mat4 spotShadowMatrix[ NUM_SPOT_LIGHT_SHADOWS ];
    #endif
    
    float readDepth( sampler2D depthSampler, vec2 coord ) {
        float fragCoordZ = texture2D( depthSampler, coord ).x;
        float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
        return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
    }

    // Can be precomputed
    vec3 T(float s) {
        return texture2D(transmitanceLut, vec2(s, 0.0)).rgb;
        // return vec3(0.233, 0.455, 0.649) * exp(-s*s/0.0064) +
        // vec3(0.1, 0.336, 0.344) * exp(-s*s/0.0484) +
        // vec3(0.118, 0.198, 0.0) * exp(-s*s/0.187) +
        // vec3(0.113, 0.007, 0.007) * exp(-s*s/0.567) +
        // vec3(0.358, 0.004, 0.0) * exp(-s*s/1.99) +
        // vec3(0.078, 0.0, 0.0) * exp(-s*s/7.41);
    }

    float expFunc(float f) { return f*f*f*(f*(f*6.0-15.0)+10.0); }

    float ExpFunc(float f) { return f*f*f*(f*(f*6.0-15.0)+10.0); }
    vec4 GammaToLinear( vec4 value ) { return vec4( pow(value.rgb, vec3(2.2)), value.a ); }    
    vec4 LinearToGamma( vec4 value ) { return vec4( pow(value.rgb, vec3(1.0/2.2)), value.a ); }    
    void main() {
        
        vec4 colorBuffer = texture( map, vUv );
        vec3 albedo = colorBuffer.rgb;
        
        vec4 positionBuffer = texture( positionMap, vUv );
        vec3 position = positionBuffer.rgb;
        float sss = positionBuffer.a;
        
        vec4 normalBuffer = texture( normalMap, vUv );
        vec3 normal = normalize( normalBuffer.rgb * 2.0 - 1.0);
        float mask = normalBuffer.a > 1.0 ? 1.0 : 0.0;
        float specularValue = normalBuffer.a;

        vec4 dNormalsMap = texture( detailedNormalMap, vUv );
        vec3 dNormals = normalize(dNormalsMap.xyz * 2.0 - 1.0);
        float alpha = 1.0 - dNormalsMap.a;
        
        float depth = texture( depthMap, vUv ).r;
        float linearDepth = readDepth( depthMap, vUv );

        vec3 transmitance = vec3(0.0);

        BlinnPhongMaterial material;
        material.diffuseColor = albedo;
        material.specularColor = vec3(specularValue);
        material.specularShininess = specularIntensity;
        material.specularStrength = shadowShrinking;
        
        GeometricContext geometry;
        geometry.position = position;
        geometry.normal = dNormals;
        geometry.viewDir = normalize( cameraPosition - position );

        ReflectedLight reflectedLight;
        IncidentLight directLight;

        #if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
            PointLight pointLight;
            #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
            PointLightShadow pointLightShadow;
            #endif
            #pragma unroll_loop_start
            for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
                pointLight = pointLights[ i ];
                getPointLightInfo( pointLight, geometry, directLight );
                #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
                    pointLightShadow = pointLightShadows[ i ];
                    vec4 pointShadowWorldPosition = vec4(position, 1.0) + vec4( dNormals * pointLightShadows[ 0 ].shadowNormalBias, 0.0 );
                    vec4 pointShadowCoord = pointShadowMatrix[ 0 ] * pointShadowWorldPosition;
                    directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, pointShadowCoord, pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
                #endif
                RE_Direct( directLight, geometry, material, reflectedLight );
            }
            #pragma unroll_loop_end
        #endif
        #if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
            SpotLight spotLight;
            #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
            SpotLightShadow spotLightShadow;
            #endif
            #pragma unroll_loop_start
            for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
                spotLight = spotLights[ i ];
                getSpotLightInfo( spotLight, geometry, directLight );
                #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
                    spotLightShadow = spotLightShadows[ i ];
                    vec4 spotShadowWorldPosition = vec4(position, 1.0) + vec4( dNormals * spotLightShadows[ 0 ].shadowNormalBias, 0.0 );
                    vec4 spotShadowCoord = spotShadowMatrix[ 0 ] * spotShadowWorldPosition;
                    directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, spotShadowCoord ) : 1.0;
                #endif
                RE_Direct( directLight, geometry, material, reflectedLight );
            }
            #pragma unroll_loop_end
        #endif
        #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
            DirectionalLight directionalLight;
            #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            DirectionalLightShadow directionalLightShadow;
            #endif
            #pragma unroll_loop_start
            for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
                directionalLight = directionalLights[ i ];
                getDirectionalLightInfo( directionalLight, geometry, directLight );
                #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
                    directionalLightShadow = directionalLightShadows[ i ];
                    vec4 directionalShadowWorldPosition = vec4(position, 1.0) + vec4( shadowShrinking * dNormals * directionalLightShadows[ 0 ].shadowNormalBias, 0.0 );
                    vec4 directionalShadowCoord = directionalShadowMatrix[ 0 ] * directionalShadowWorldPosition;
                    directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, directionalShadowCoord ) : 1.0;

                    #import transmitance

                #endif
                RE_Direct( directLight, geometry, material, reflectedLight );
            }
            #pragma unroll_loop_end
        #endif

        #if defined( RE_IndirectDiffuse )
            vec3 iblIrradiance = vec3( 0.0 );
            vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
            irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );
            #if ( NUM_HEMI_LIGHTS > 0 )
                #pragma unroll_loop_start
                for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
                    irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );
                }
                #pragma unroll_loop_end
            #endif
        #endif

        // vec3 directDiffuse;
        // vec3 directSpecular;
        // vec3 indirectDiffuse;
        // vec3 indirectSpecular;

        vec3 diffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
        vec3 specular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
        diffuse += albedo * ambientIntensity;

        pc_fragLight = vec4( diffuse, mask );
        pc_fragTransmitance = vec4( specular, 1.0 );
        pc_fragDepth = vec4( linearDepth, sss, 1.0, 1.0 );
    }

\horizontalBlur

    precision highp float;
    precision highp int;
    layout(location = 0) out highp vec4 pc_fragDataH;
    in vec2 vUv;

    #include <common>
    #include <packing>

    uniform float width;
    uniform float sssLevel;
    uniform float correction;
    uniform float maxdd;
    uniform vec2 invPixelSize;
    uniform sampler2D irradianceMap;
    uniform sampler2D depthMap;

    uniform float cameraNear;
    uniform float cameraFar;
    
    float readDepth( sampler2D depthSampler, vec2 coord ) {
        float fragCoordZ = texture2D( depthSampler, coord ).x;
        float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
        return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
    }

    void main() {

        // Gaussian weights for the six samples around the current pixel
        //   -3 -2 -1 +1 +2 +3
        float w[7];
        w[0] = w[6] = 0.006; w[1] = w[5] = 0.061; w[2] = w[4] = 0.242;
        w[3] = 0.382;

        float wW[6];
        wW[0] = wW[5] = 0.006; wW[1] = wW[4] = 0.061; wW[2] = wW[3] = 0.242;

        // Fetch color and linear depth
        vec4 colorM = vec4(0.0);
        float depthM = readDepth( depthMap, vUv );
        
        if(depthM >= 0.0 && depthM <= 1.0) {

            float iSx = depthM + correction * min(abs(dFdx(depthM)), maxdd);
            float sX = sssLevel / iSx;
            vec2 finalWidth = sX * width * invPixelSize * vec2(1.0, 0.0);
            vec2 offset = vUv - finalWidth;

            // Accumulate samples
            for(int i = 0; i < 6; i++) {
                vec3 tap = texture2D( irradianceMap, offset ).rgb;
                colorM.rgb += w[ i ] * tap;
                offset += finalWidth / 3.0;
            }

        }

        pc_fragDataH = colorM;
    }

\verticalBlur

    precision highp float;
    layout(location = 0) out highp vec4 pc_fragDataV;
    in vec2 vUv;

    #include <common>
    #include <packing>
    
    uniform float width;
    uniform float sssLevel;
    uniform float correction;
    uniform float maxdd;
    uniform vec2 invPixelSize;
    uniform sampler2D irradianceMap;
    uniform sampler2D depthMap;

    uniform float cameraNear;
    uniform float cameraFar;
    
    float readDepth( sampler2D depthSampler, vec2 coord ) {
        float fragCoordZ = texture2D( depthSampler, coord ).x;
        float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
        return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
    }

    void main() {

        // Gaussian weights for the six samples around the current pixel
        //   -3 -2 -1 +1 +2 +3
        float w[7];
        w[0] = w[6] = 0.006; w[1] = w[5] = 0.061; w[2] = w[4] = 0.242;
        w[3] = 0.382;

        // Fetch color and linear depth
        vec4 color = vec4(0.0);
        float depthValue = readDepth( depthMap, vUv );

        if(depthValue >= 0.0 && depthValue <= 1.0) {
            
            float iSy = depthValue + correction * min(abs(dFdy(depthValue)), maxdd);
            float sY = sssLevel / iSy;
            vec2 finalWidth = sY * width * invPixelSize * vec2(0.0, 1.0);
            vec2 offset = vUv - finalWidth;
            
            // Accumulate samples
            for(int i = 0; i < 7; i++) {
                vec3 tap = texture2D( irradianceMap, offset ).rgb;
                color.rgb += w[ i ] * tap;
                offset += finalWidth / 3.0;
            }

        }

        pc_fragDataV = vec4( color.rgb, 1.0 );
    }

\accumulativeStep

    precision highp float;
    layout(location = 0) out highp vec4 pc_finalColor;
    #define varying in
    #define texture2 texture
    varying vec2 vUv;

    uniform vec3 weight;
    uniform sampler2D colorMap;
    uniform sampler2D depthMap;
    
    void main() {
        vec4 color = texture2D( colorMap, vUv );
        float depth = texture2D( depthMap, vUv ).x;
        float mask = depth >= 1.0 ? 1.0 : 0.0;
        pc_finalColor = vec4( color.rgb * weight, mask );
    }

\gammaCorrection

    precision highp float;
    layout(location = 0) out highp vec4 pc_Color;
    varying vec2 vUv;
    uniform sampler2D colorMap;
    
    void main() {
        vec4 tex = texture2D( colorMap, vUv );
        pc_Color = LinearTosRGB( tex );
    }