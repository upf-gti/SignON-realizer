import * as THREE from 'three'

const SSS_ShaderChunk = {

    perturbNormal: `
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
    `,

    deferredFS() {

        
        return [`
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
            
            `,
            THREE.ShaderChunk.common,
            THREE.ShaderChunk.packing,
            THREE.ShaderChunk.uv_pars_fragment,
            `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldPosition;

            uniform sampler2D map;
            uniform sampler2D normalMap;
            uniform sampler2D opacityMap;
            uniform sampler2D u_sss_texture;
            
            `, 
            this.perturbNormal, 
            `
            vec4 mapTexelToLinear( vec4 value ) { return LinearToLinear( value ); }    

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
            void main() {
                vec3 normal = vNormal;
            
                vec4 diffuse = texture2D( map, vUv);
                float alpha = diffuse.a;
                vec3 mapN = texture2D( normalMap, vUv ).rgb;
                vec3 N = normalize( vNormal );
                vec3 V = normalize( cameraPosition - vWorldPosition );
                vec3 detailedN  = perturbNormal( N, V, vUv, mapN );
                float sss = texture2D( u_sss_texture, vUv ).r;
                
                if (alpha < compute_alpha_hash_threshold(vViewPosition, 1.5)) {
                    discard;
                }

                pc_fragColor0 = vec4(mapTexelToLinear(diffuse).rgb, alpha);
                pc_fragColor1 = vec4(vWorldPosition, sss);

                pc_fragColor2 = vec4(N * 0.5 + vec3(0.5), 0.0);
                pc_fragColor3 = vec4(detailedN * 0.5 + 0.5, 1.0);
               
            }
        `].join("\n");
    },

    deferredFinalFS() {

        return `
        #define RE_Direct RE_Direct_BlinnPhong
        #define SHADOWMAP_TYPE_PCF

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

        uniform sampler2D geometry_texture;
        uniform sampler2D map;
        uniform sampler2D normalMap;
        uniform sampler2D depth_texture;
        uniform sampler2D detailed_normal_texture;
        
        uniform sampler2D specular_texture;
        uniform float specularIntensity;
        uniform float alphaTest;

        uniform float u_ambientIntensity;
        uniform float u_shadowShrinking;
        uniform float u_translucencyScale;
        
        uniform float camera_near;
        uniform float camera_far;
        uniform vec3 camera_eye;

        uniform mat4 projectionMatrix;
        
        mat4 u_invvp;

        //const int NR_LIGHTS = 32;
        //uniform Light lights[NR_LIGHTS];

        #if NUM_DIR_LIGHT_SHADOWS > 0
            uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
            varying vec4 vDirectionalShadowCoord[NUM_DIR_LIGHT_SHADOWS ];
            struct DirectionalLightShadow {
                float shadowBias;
                float shadowNormalBias;
                float shadowRadius;
                vec2 shadowMapSize;
            };
            uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS];
            uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
        #endif
        #if NUM_SPOT_LIGHT_SHADOWS > 0
            uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
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
            uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
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
        float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
    		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	    }
        vec2 cubeToUV( vec3 v, float texelSizeY ) {
    		vec3 absV = abs( v );
    		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
    		absV *= scaleToCube;
    		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
    		vec2 planar = v.xy;
    		float almostATexel = 1.5 * texelSizeY;
    		float almostOne = 1.0 - almostATexel;
    		if ( absV.z >= almostOne ) {
    			if ( v.z > 0.0 )
    				planar.x = 4.0 - v.x;
            } else if ( absV.x >= almostOne ) {
                    float signX = sign( v.x );
                    planar.x = v.z * signX + 2.0 * signX;
            } else if ( absV.y >= almostOne ) {
                    float signY = sign( v.y );
                    planar.x = v.x + 2.0 * signY + 2.0;
                    planar.y = v.z * signY - 2.0;
            }
                return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
        }

        float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
    		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
    		vec3 lightToPosition = shadowCoord.xyz;
    		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
    		vec3 bd3D = normalize( lightToPosition );
    		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
    			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
    			return (
    				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
    				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
    				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
    				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
    				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
    				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
    				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
    				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
    				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
    		#else
    			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
    		#endif
        }
        float linearDepthNormalized(float z, float near, float far){
            float z_n = 2.0 * z - 1.0;
            return 2.0 * near * far / (far + near - z_n * (far - near));
        }
        // Can be precomputed
        vec3 T(float s){
            return vec3(0.233, 0.455, 0.649) * exp(-s*s/0.0064) +
            vec3(0.1, 0.336, 0.344) * exp(-s*s/0.0484) +
            vec3(0.118, 0.198, 0.0) * exp(-s*s/0.187) +
            vec3(0.113, 0.007, 0.007) * exp(-s*s/0.567) +
            vec3(0.358, 0.004, 0.0) * exp(-s*s/1.99) +
            vec3(0.078, 0.0, 0.0) * exp(-s*s/7.41);
        }
        float expFunc(float f)
        {
            return f*f*f*(f*(f*6.0-15.0)+10.0);
        }
        void main() {
            
            vec4 colorBuffer = texture( map, vUv );
            vec3 albedo = colorBuffer.rgb;
            colorBuffer.a =colorBuffer.a;
            float alpha = colorBuffer.a;

            //if ( alpha < alphaTest ) discard;

            vec4 positionBuffer = texture( geometry_texture, vUv );
            vec3 position = positionBuffer.rgb;
            float sss = positionBuffer.a;

            vec3 normal = normalize( texture( normalMap, vUv ).rgb * 2.0 - 1.0);
            float mask = 1.0 - texture( normalMap, vUv ).a;
            vec3 dNormals = normalize(texture( detailed_normal_texture, vUv ).xyz * 2.0 - 1.0);
            
            vec3 specular = texture( specular_texture, vUv ).rgb;
            vec3 transmitance;
            
            vec3 L;
            float NdotL = 1.0;
            //NdotL *= 1.0 - (light_distance - u_light_att.x) / (u_light_att.y - u_light_att.x);
            
            ReflectedLight reflectedLight;
            
            u_invvp = inverse( projectionMatrix * viewMatrix );
            
            BlinnPhongMaterial material;
            material.diffuseColor = albedo;
            material.specularColor = specular;
            material.specularShininess = specularIntensity;
            material.specularStrength = u_shadowShrinking;
            
            GeometricContext geometry;
            geometry.position = - position;
            geometry.normal = dNormals;
            geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( position );
            float light_depth;
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
                        directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
                    #endif
                    RE_Direct( directLight, geometry, material, reflectedLight );

                    //Shadowmap
                    vec2 invtexsize = pointLightShadow.shadowMapSize * vec2( 4.0, 2.0 );
                    float texsize = 1.0/invtexsize.y;
                    float bias = pointLightShadow.shadowBias;
                    float near = pointLightShadow.shadowCameraNear;
                    float far = pointLightShadow.shadowCameraFar;
                    L = directLight.direction;

                    vec4 lspace_pos = pointShadowMatrix[ i ] * vec4(position - u_shadowShrinking * normal, 1.0); //Shrinking explained bt Jimenez et al
                    lspace_pos = 0.5*(lspace_pos+vec4(1.0));

                    vec2 samples = lspace_pos.xy;
                    vec2 topleft_uv = samples * texsize;
                    vec2 offset_uv = fract(topleft_uv);
                    offset_uv.x = expFunc(offset_uv.x);
                    offset_uv.y = expFunc(offset_uv.y);
                    topleft_uv = floor(topleft_uv) * invtexsize.y;

                    vec2 topright_uv = (topleft_uv+vec2(invtexsize.x, 0.0));
                    vec2 bottomright_uv = (topleft_uv+vec2(invtexsize.x, invtexsize.y));

                    float topleft = texture2D(pointShadowMap[ i ], topleft_uv).x;
                    float topright = texture2D(pointShadowMap[ i ], topright_uv ).x;
                    float bottomleft = texture2D(pointShadowMap[ i ], topleft_uv+vec2(0.0, invtexsize.y)).x;
                    float bottomright = texture2D(pointShadowMap[ i ], bottomright_uv ).x;
                    float top = mix(topleft, topright, offset_uv.x);
                    float bottom = mix(bottomleft, bottomright, offset_uv.x);
                    float sample_depth = mix(top, bottom, offset_uv.y);// getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar );
                
                    float real_depth = lspace_pos.z;

                    
                    light_depth = topleft;//(sample_depth == 1.0) ? 1.0e9 : sample_depth;
                    //Transmitance (we use vertex normal because it does not contain high frequency detail)
                    float u_scale = u_translucencyScale; //To be defined with uniform 
                    float s = u_scale * abs(linearDepthNormalized(light_depth, near, far) - linearDepthNormalized(real_depth, near, far));
                    float E = max(0.3 + dot(-normal, L), 0.0);
                    transmitance += T(s) * pointLight.color * albedo * E;
                 
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
                    directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
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
                        directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
                    #endif
                    RE_Direct( directLight, geometry, material, reflectedLight );
                    L = directionalLight.direction;
                    float light_distance = length(L);
                    L /= light_distance;
                    NdotL *= max(0.0, dot(dNormals,L));
                    //NdotL *= 1.0 - (light_distance - u_light_att.x) / (u_light_att.y - u_light_att.x);
                }
                #pragma unroll_loop_end
            #endif
            #if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
                RectAreaLight rectAreaLight;
                #pragma unroll_loop_start
                for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
                        rectAreaLight = rectAreaLights[ i ];
                    RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );
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
            #if defined( RE_IndirectSpecular )
                vec3 radiance = vec3( 0.0 );
                vec3 clearcoatRadiance = vec3( 0.0 );
            #endif

            //Transmitance (we use vertex normal because it does not contain high frequency detail)
            // float u_scale = u_translucencyScale; //To be defined with uniform 
            // float s = u_scale * abs(linearDepthNormalized(light_depth, near, far) - linearDepthNormalized(real_depth, near, far));
            // float E = max(0.3 + dot(-N, L), 0.0);

            // vec3 transmitance = T(s) * u_light_color * albedo * E;

            vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
            vec3 ambient = albedo * u_ambientIntensity;
            vec3 diffuse = outgoingLight;// * NdotL;
            vec3 final_color = ambient + diffuse;
           
            
            //pc_fragLight = vec4(texture( normalMap, vUv ).rgb, alpha) ;
            pc_fragLight = vec4(final_color, sss);
            pc_fragTransmitance = vec4(transmitance, 1.0);
            pc_fragDepth = vec4( mask == 1.0 ? light_depth : 0.0, 1.0, sss, 1.0);
        }

        `
    },

    horizontalBlurFS(){

        return `
        precision highp float;
        precision highp int;
        
        layout(location = 0) out highp vec4 pc_fragData;

        in vec2 vUv;
        #include <common>
        uniform float u_width;
        uniform float u_sssLevel;
        uniform float u_correction;
        uniform float u_maxdd;
        uniform vec2 u_invPixelSize;

        uniform float camera_near;
        uniform float camera_far;

        uniform sampler2D irradiance_texture;
        uniform sampler2D depth_aux_texture;

        float linearDepthNormalized(float z, float near, float far){
            float z_n = 2.0 * z - 1.0;
            return 2.0 * near * far / (far + near - z_n * (far - near));
        }

        void main() {
            float w[6];
            w[0] = w[5] = 0.006;
            w[1] = w[4] = 0.061;
            w[2] = w[3] = 0.242;
            float o[6];
            o[0] = -1.0;
            o[1] = -0.667;
            o[2] = -0.333;
            o[3] = 0.333;
            o[4] = 0.667;
            o[5] = 1.0;
        
            vec3 depth_aux_value = texture2D(depth_aux_texture, vUv).xyz;
            float depth = linearDepthNormalized(depth_aux_value.x, camera_near, camera_far);
            float mask = depth_aux_value.x > 0.0 ? 1.0 : 0.0;
            vec3 color = texture2D(irradiance_texture, vUv).rgb;
        
            if(mask == 1.0 && depth >= camera_near && depth <= camera_far){
            color *= 0.382;
            
            float s_x = u_sssLevel / (depth + u_correction * min(abs(dFdx(depth)), u_maxdd));
            vec2 finalWidth = s_x * u_width * u_invPixelSize * vec2(1.0, 0.0);
            vec2 offset;
        
                for(int i=0; i<6; i++){
                    offset = vUv + finalWidth*o[i];
                    vec3 tap = texture2D(irradiance_texture, offset).rgb;
                    color.rgb += w[i] * (texture2D(depth_aux_texture, offset).x > 0.0 ? tap : color);
                }
            }
            
            pc_fragData = texture2D(irradiance_texture, vUv);//vec4(vec3(1.0,0.0,0.0), 1.0);
            
        }
        `;
    },

    accumulativeFS(){
        return `	
        
        precision highp float;
	
        layout(location = 0) out highp vec4 pc_finalColor;
        #define varying in
        #define texture2 texture
        varying vec2 vUv;
    
        uniform vec3 u_weight;
        uniform sampler2D u_color_texture;
        uniform sampler2D u_depth_aux_tex;
        
    
        void main() {
            vec4 color = texture2D( u_color_texture, vUv );
            float sssIntensity = texture2D( u_depth_aux_tex, vUv ).y;
            pc_finalColor = vec4(color.rgb * u_weight, sssIntensity);
        }
    `
    },

    finalGammaFS(){
        return `	
        
        precision highp float;
        layout(location = 0) out highp vec4 pc_finalColor;
        
        #define varying in
        #define texture2 texture

        varying vec2 vUv;

        uniform sampler2D u_texture;
        
        void main() {
            pc_finalColor = vec4( pow(texture2D(u_texture, vUv).rgb, vec3(0.5)), 1.0 );
        }
    `
    }

}
export { SSS_ShaderChunk }