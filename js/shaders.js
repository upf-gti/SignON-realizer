import * as THREE from 'three';

const ShaderChunk = {

    vertexShader() {
        return `
            precision mediump float;
            in vec3 position;
            in vec3 normal;
            in vec2 uv;

            uniform mat3 uvTransform;

            
            //varyings
            out vec3 vNormal;
            out vec2 vUv;
            out vec3 vPos;
            
            out vec3 vViewPosition;
            
            //matrices
            uniform mat4 modelMatrix;
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            uniform mat3 normalMatrix;
            
            // #pragma shaderblock "morphing"
            // #pragma shaderblock "skinning"
            
            void applyMorphing( inout vec4 position, inout vec3 normal ) {}
            void applySkinning( inout vec4 position, inout vec3 normal) {}
            
            void main() {
                
                
                vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
                

                vec4 newPos = vec4(position,1.0);
            
                //deforms
                 applyMorphing( newPos, vNormal );
                 applySkinning( newPos, vNormal );

                //normal
                //vUv = uv;
                
                vec4 mvPosition = modelViewMatrix * newPos;
                vPos = (modelMatrix * newPos).xyz;
                //  applyLight(mvPosition);
                
                // get smooth normals
                vec3 transformedNormal = normalMatrix * normal;
                vNormal = normalize( transformedNormal );
                gl_Position = projectionMatrix * mvPosition;
            }
            `
    },

    fragmentShader(){
        return [ 
            `precision mediump float;
            #define USE_SHADOWMAP true`,
            THREE.ShaderChunk.common,
            THREE.ShaderChunk.packing,
            THREE.ShaderChunk.uv_pars_fragment,
            
            `layout(location = 0) out vec4 outColor0;
            // layout(location = 1) out vec4 outColor1;
            // layout(location = 2) out vec4 outColor2;
            
            //varyings
            in vec3 vPos;
            in vec3 vNormal;
            in vec2 vUv;
            in vec3 vViewPosition;
            
            uniform vec3 cameraPosition;
            uniform mat4 viewMatrix;
            uniform bool isOrthographic;
            //lights`,
            
            THREE.ShaderChunk.lights_pars_begin,
            THREE.ShaderChunk.shadowmap_pars_fragment,

            
            `uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
            
            uniform float u_specular;
            uniform float u_roughness;
            uniform float u_normalmap_factor;
            uniform float u_shadow_shrinking;
            uniform bool  u_enable_translucency;
            uniform float u_translucency_scale;
            
            //textures
            uniform sampler2D u_color_texture;
            uniform sampler2D u_specular_texture;
            uniform sampler2D u_normal_texture;
            uniform sampler2D u_opacity_texture;
            uniform sampler2D u_sss_texture;
            
            uniform sampler2D u_transmitance_lut_texture;
            uniform sampler2D u_specular_lut_texture;
        
            
            // #pragma shaderblock "firstPass"`,
            this.perturbNormal(),         
            
            `//We asume that the color is gamma-corrected for now
            vec3 linearizeColor(vec3 color){
                return pow(color, vec3(2.2));
            }
            
            float linearDepthNormalized(float z, float near, float far){
                float z_n = 2.0 * z - 1.0;
                return 2.0 * near * far / (far + near - z_n * (far - near));
            }
            
            float expFunc(float f){
                return f*f*f*(f*(f*6.0-15.0)+10.0);
            }
            
            float lightDepth(sampler2D light_shadowmap, vec2 sample_uv, float inv_tex_size, float bias, float near, float far){
                float tex_size = 1.0/inv_tex_size;
                vec2 topleft_uv = sample_uv * tex_size;
                vec2 offset_uv = fract(topleft_uv);
                offset_uv.x = expFunc(offset_uv.x);
                offset_uv.y = expFunc(offset_uv.y);
                topleft_uv = floor(topleft_uv) * inv_tex_size;
                
                float topleft = texture(light_shadowmap, topleft_uv).x;
                float topright = texture(light_shadowmap, topleft_uv+vec2(inv_tex_size, 0.0)).x;
                float bottomleft = texture(light_shadowmap, topleft_uv+vec2(0.0, inv_tex_size)).x;
                float bottomright = texture(light_shadowmap, topleft_uv+vec2(inv_tex_size, inv_tex_size)).x;
                
                float top = mix(topleft, topright, offset_uv.x);
                float bottom = mix(bottomleft, bottomright, offset_uv.x);
                
                float sample_depth = mix(top, bottom, offset_uv.y);
                return (sample_depth == 1.0) ? 1.0e9 : sample_depth;
            }
            
            vec3 T(float s){
                return texture(u_transmitance_lut_texture, vec2(s, 0.0)).rgb;
                //Is following equation in range [0,4]:
                //  return vec3(0.233, 0.455, 0.649) * exp(-s*s/0.0064) +
                //  vec3(0.1, 0.336, 0.344) * exp(-s*s/0.0484) +
                //  vec3(0.118, 0.198, 0.0) * exp(-s*s/0.187) +
                //  vec3(0.113, 0.007, 0.007) * exp(-s*s/0.567) +
                //  vec3(0.358, 0.004, 0.0) * exp(-s*s/1.99) +
                //  vec3(0.078, 0.0, 0.0) * exp(-s*s/7.41);
            }
            
            float fresnelReflactance(vec3 H, vec3 V, float F0){
                float base = 1.0 - dot(V, H);
                float exponential = pow(base, 5.0);
                return exponential + F0 * (1.0 - exponential);
            }
            
            float KS_Skin_Specular(vec3 N, vec3 L, vec3 V, float m, float roh_s){
                float result = 0.0;
                float ndotl = dot(N, L);
                if(ndotl > 0.0){
                    vec3 h = L + V;
                    vec3 H = normalize(h);
                    float ndoth = dot(N, H);
                    float PH = pow(2.0*texture(u_specular_lut_texture, vec2(ndoth, m)).x, 10.0);
                    float F = fresnelReflactance(H, V, 0.028);
                    float frSpec = max(PH * F / dot(h, h), 0.0);
                    result = ndotl * roh_s * frSpec;
                }
                return result;
            }
            
            void main() {
                vec3 normal = vNormal;`,
                
                THREE.ShaderChunk.lights_fragment_begin,
                THREE.ShaderChunk.lights_fragment_end,
                `vec3 N = normalize(vNormal);
                vec3 V = normalize(cameraPosition - vPos);
                vec3 detailed_normal = perturbNormal(N, V, vUv, texture(u_normal_texture, vUv).xyz);
                detailed_normal = mix(N, detailed_normal, u_normalmap_factor);
                //u_normalmap_factor
                
                //With directional lights this does not make sense because we should check its intrinsic direction
                float attenuation = pointLights[0].decay;
                vec3 lVector = pointLights[0].position - geometry.position; 
                vec3 direction = normalize( lVector );
                vec3 L = normalize(direction);
                
                float NdotL = max(0.0, dot(detailed_normal,L));
                NdotL *= attenuation;
                
                vec3 albedo =  linearizeColor(texture(u_color_texture, vUv).rgb);
                float specular = u_specular * texture(u_specular_texture, vUv).x;
                
                float depth = gl_FragCoord.z;
                float sssMask = texture(u_sss_texture, vUv).x;
                
                // Shadowmap
                #if NUM_POINT_LIGHT_SHADOWS > 0
                float inv_tex_size = 1.0 / pointLightShadows[0].shadowMapSize.x;
                float bias = pointLightShadows[0].shadowBias;
                float near = pointLightShadows[0].shadowCameraNear;
                float far = pointLightShadows[0].shadowCameraFar;
                #endif
                vec4 lspace_pos = pointShadowMatrix[0] * vec4(vPos - u_shadow_shrinking * N, 1.0); //Shrinking explained by Jimenez et al
                lspace_pos = 0.5*(lspace_pos+vec4(1.0));
                float sample_depth = lightDepth(pointShadowMap[0], lspace_pos.xy, inv_tex_size, bias, near, far);
                float real_depth = lspace_pos.z;
                
                float lit = ((real_depth <= sample_depth + bias) ? 1.0 : 0.0);
                
                //Transmitance
                float s = u_translucency_scale * abs(linearDepthNormalized(sample_depth, near, far) - linearDepthNormalized(real_depth, near, far));
                float E = max(0.3 + dot(-N, L), 0.0);
                
                //Final color
                vec3 ambient = vec3(0.0);
                vec3 transmittance = vec3(0.0);
                #ifdef BLOCK_FIRSTPASS
                    ambient = albedo;
                #endif
                if(u_enable_translucency)
                        transmittance = T(s) * pointLights[0].color * albedo * E * attenuation;
                vec3 diffuse = albedo * pointLights[0].color * NdotL * lit;
                
                vec3 reflectance = KS_Skin_Specular(detailed_normal, L, V, u_roughness, specular) * pointLights[0].color * lit;
                
                //outColor [0] = vec4(ambient+diffuse+transmittance+reflectance, 1.0);
                outColor0  =  vec4(texture(u_color_texture, vUv).rgb, 1.0);
                // outColor1 = vec4(0.0);
                // outColor2 = vec4(0.0);
                // #ifdef BLOCK_FIRSTPASS
                //     outColor1 = vec4(sssMask, 0.0, 0.0, 1.0);
                // #endif
            }`
        ].join("\n").replaceAll("varying ", "in ").replaceAll("texture2D", "texture");
    },
    perturbNormal(){
        return `mat3 cotangent_frame(vec3 N, vec3 p, vec2 uv)	
        {	
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
            
        vec3 perturbNormal( vec3 N, vec3 V, vec2 texcoord, vec3 normal_pixel )	
        {	
            #ifdef USE_POINTS	
                return N;	
            #endif	
                
            // assume N, the interpolated vertex normal and 	
            // V, the view vector (vertex to eye)	
            //vec3 normal_pixel = texture2D(normalmap, texcoord ).xyz;	
            normal_pixel = normal_pixel * 255./127. - 128./127.;		
            mat3 TBN = cotangent_frame(N, V, texcoord);		
            return normalize(TBN * normal_pixel);		
        }`;
    },
    vertexShaderQuad(){
        return `in vec3 position;
            in vec2 uv;

            out vec2 vUv;

            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;

            void main() {

                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

            }

        `
    },
    fragmentShaderQuad(){
        return `
        precision highp float;
        precision highp int;

        layout(location = 0) out vec4 pc_FragColor;

        in vec2 vUv;

        uniform sampler2D t0;
        // uniform sampler2D t1;
        // uniform sampler2D t2;

        void main() {

            vec3 texture0 = texture( t0, vUv ).rgb;
            // vec3 texture1 = texture( t1, vUv ).rgb;
            // vec3 texture2 = texture( t2, vUv ).rgb;

            pc_FragColor.rgb =  texture0;
            pc_FragColor.a = 1.0;
           

        }

        `
    },

    fragmentShaderSimple (){
        return `
        precision highp float;
        precision highp int;

        layout(location = 0) out vec4 outColor0;

        in vec2 vUv;     

        void main() {
            

            outColor0.rgb = vec3(1.0,0.0,0.0);
            outColor0.a = 1.0;

        }

        `
    },

    getLightBlock()
    {
        return `
        struct GeometricContext {
            vec3 position;
            vec3 normal;
            vec3 viewDir;
        };
        struct IncidentLight {
            vec3 color;
            vec3 direction;
            bool visible;
        };
        #if NUM_DIR_LIGHTS > 0
        struct DirectionalLight {
                vec3 direction;
                vec3 color;
            };
        uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
        void getDirectionalLightInfo( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight light ) {
                light.color = directionalLight.color;
                light.direction = directionalLight.direction;
                light.visible = true;
            }
        #endif
        #if NUM_POINT_LIGHTS > 0
        struct PointLight {
                vec3 position;
                vec3 color;
                float distance;
                float decay;
            };
        uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
        void getPointLightInfo( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight light ) {
                vec3 lVector = pointLight.position - geometry.position;
                light.direction = normalize( lVector );
                float lightDistance = length( lVector );
                light.color = pointLight.color;
                light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
                light.visible = ( light.color != vec3( 0.0 ) );
            }
        #endif
        #if NUM_SPOT_LIGHTS > 0
        struct SpotLight {
                vec3 position;
                vec3 direction;
                vec3 color;
                float distance;
                float decay;
                float coneCos;
                float penumbraCos;
            };
        uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
        void getSpotLightInfo( const in SpotLight spotLight, const in GeometricContext geometry, out IncidentLight light ) {
                vec3 lVector = spotLight.position - geometry.position;
                light.direction = normalize( lVector );
                float angleCos = dot( light.direction, spotLight.direction );
                float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
                if ( spotAttenuation > 0.0 ) {
                    float lightDistance = length( lVector );
                    light.color = spotLight.color * spotAttenuation;
                    light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
                    light.visible = ( light.color != vec3( 0.0 ) );
                } else {
                    light.color = vec3( 0.0 );
                    light.visible = false;
                }
        }
        #endif
        #if NUM_RECT_AREA_LIGHTS > 0
        struct RectAreaLight {
                vec3 color;
                vec3 position;
                vec3 halfWidth;
                vec3 halfHeight;
            };
        uniform sampler2D ltc_1;  uniform sampler2D ltc_2;
        uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
        #endif
        #if NUM_HEMI_LIGHTS > 0
        struct HemisphereLight {
                vec3 direction;
                vec3 skyColor;
                vec3 groundColor;
            };
        uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
        vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
                float dotNL = dot( normal, hemiLight.direction );
                float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
                vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
                return irradiance;
            }
        #endif";`
    },

    getShadowBlock(){
        return `
        struct PointLightShadow {
            float shadowBias;
            float shadowNormalBias;
            float shadowRadius;
            vec2 shadowMapSize;
            float shadowCameraNear;
            float shadowCameraFar;
        };
        
        struct SpotLightShadow {
            float shadowBias;
            float shadowNormalBias;
            float shadowRadius;
            vec2 shadowMapSize;
        };

        const float UnpackDownscale = 255. / 256.;
        const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
        const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );

        float unpackRGBAToDepth( const in vec4 v ) {
            return dot( v, UnpackFactors );
        }

        float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
            return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
        }

        #ifdef USE_SHADOWMAP
            #if NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0
            vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
            vec4 shadowWorldPosition;
            #endif
            #if NUM_DIR_LIGHT_SHADOWS > 0
            #pragma unroll_loop_start
            for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
                shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
            vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
            }
            #pragma unroll_loop_end
            #endif
            #if NUM_SPOT_LIGHT_SHADOWS > 0
            #pragma unroll_loop_start
            for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
                shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias, 0 );
            vSpotShadowCoord[ i ] = spotShadowMatrix[ i ] * shadowWorldPosition;
            }
            #pragma unroll_loop_end
            #endif
            #if NUM_POINT_LIGHT_SHADOWS > 0
            #pragma unroll_loop_start
            for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
                shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadow[ i ].shadowNormalBias, 0 );
            vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
            }
            #pragma unroll_loop_end
            #endif
        #endif


        float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
            float shadow = 1.0;
            shadowCoord.xyz /= shadowCoord.w;
            shadowCoord.z += shadowBias;
            bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );
            bool inFrustum = all( inFrustumVec );
            bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );
            bool frustumTest = all( frustumTestVec );
            if ( frustumTest ) {
                #if defined( SHADOWMAP_TYPE_PCF )
                vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
                float dx0 = - texelSize.x * shadowRadius;
                float dy0 = - texelSize.y * shadowRadius;
                float dx1 = + texelSize.x * shadowRadius;
                float dy1 = + texelSize.y * shadowRadius;
                float dx2 = dx0 / 2.0;
                float dy2 = dy0 / 2.0;
                float dx3 = dx1 / 2.0;
                float dy3 = dy1 / 2.0;
                shadow = (
                    texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
                ) * ( 1.0 / 17.0 );
            #elif defined( SHADOWMAP_TYPE_PCF_SOFT )
                vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
                float dx = texelSize.x;
                float dy = texelSize.y;
                vec2 uv = shadowCoord.xy;
                vec2 f = fract( uv * shadowMapSize + 0.5 );
                uv -= f * texelSize;
                shadow = (
                    texture2DCompare( shadowMap, uv, shadowCoord.z ) +
                texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
                texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
                mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ), 
                        texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
                        f.x ) +
                mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ), 
                        texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
                        f.x ) +
                mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ), 
                        texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
                        f.y ) +
                mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ), 
                        texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
                        f.y ) +
                mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ), 
                        texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
                        f.x ),
                        mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ), 
                        texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
                        f.x ),
                        f.y )
                ) * ( 1.0 / 9.0 );
            #elif defined( SHADOWMAP_TYPE_VSM )
                shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
            #else
                shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
            #endif
            }
            return shadow;
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
            float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );    dp += shadowBias;
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

        float getShadowMask() {
                float shadow = 1.0;
            #ifdef USE_SHADOWMAP
                #if NUM_DIR_LIGHT_SHADOWS > 0
                DirectionalLightShadow directionalLight;
                #pragma unroll_loop_start
                for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
                    directionalLight = directionalLightShadows[ i ];
                shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
                }
                #pragma unroll_loop_end
                #endif
                #if NUM_SPOT_LIGHT_SHADOWS > 0
                SpotLightShadow spotLight;
                #pragma unroll_loop_start
                for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
                    spotLight = spotLightShadows[ i ];
                shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
                }
                #pragma unroll_loop_end
                #endif
                #if NUM_POINT_LIGHT_SHADOWS > 0
                PointLightShadow pointLight;
                #pragma unroll_loop_start
                for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
                    pointLight = pointLightShadow[ i ];
                shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
                }
                #pragma unroll_loop_end
                #endif
            #endif
            return shadow;
        }
        `
    }
}
export { ShaderChunk }