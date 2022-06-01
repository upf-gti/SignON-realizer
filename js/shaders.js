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
    getVertexShaderReduced(){
        reutrn [
            `precision mediump sampler2DArray;
            #define attribute in
            #define varying out
            #define texture2D texture
            precision highp float;
            precision highp int;
            #define HIGH_PRECISION
            #define SHADER_NAME MeshPhongMaterial
            #define VERTEX_TEXTURES
            #define MAX_BONES 0
            #define USE_FOG
            #define BONE_TEXTURE
            #define USE_SHADOWMAP
            #define SHADOWMAP_TYPE_PCF
            uniform mat4 modelMatrix;
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform mat3 normalMatrix;
            uniform vec3 cameraPosition;
            uniform bool isOrthographic;
            #ifdef USE_INSTANCING
                attribute mat4 instanceMatrix;
            #endif
            #ifdef USE_INSTANCING_COLOR
                attribute vec3 instanceColor;
            #endif
            attribute vec3 position;
            attribute vec3 normal;
            attribute vec2 uv;
            #ifdef USE_TANGENT
                attribute vec4 tangent;
            #endif
            #if defined( USE_COLOR_ALPHA )
                attribute vec4 color;
            #elif defined( USE_COLOR )
                attribute vec3 color;
            #endif
            `,

            `#define PHONG
            varying vec3 vViewPosition;`,
            THREE.ShaderChunk.common,
            
            THREE.ShaderChunk.uv_pars_vertex,
            THREE.ShaderChunk.uv2_pars_vertex,
            THREE.ShaderChunk.displacementmap_pars_vertex,
            THREE.ShaderChunk.envmap_pars_vertex,
            THREE.ShaderChunk.color_pars_vertex,
            THREE.ShaderChunk.fog_pars_vertex,
            THREE.ShaderChunk.normal_pars_vertex,
            THREE.ShaderChunk.shadowmap_pars_vertex,
            THREE.ShaderChunk.logdepthbuf_pars_vertex,
            THREE.ShaderChunk.clipping_planes_pars_vertex,
            `void main() {`,
                THREE.ShaderChunk.uv_vertex,
                THREE.ShaderChunk.uv2_vertex,
                THREE.ShaderChunk.color_vertex,
                THREE.ShaderChunk.beginnormal_vertex,
                THREE.ShaderChunk.skinnormal_vertex,
                THREE.ShaderChunk.defaultnormal_vertex,
                THREE.ShaderChunk.normal_vertex,
                THREE.ShaderChunk.begin_vertex,
                THREE.ShaderChunk.displacementmap_vertex,
                THREE.ShaderChunk.project_vertex,
                THREE.ShaderChunk.logdepthbuf_vertex,
                THREE.ShaderChunk.clipping_planes_vertex,
                `vViewPosition = - mvPosition.xyz`,
                THREE.ShaderChunk.worldpos_vertex,
                THREE.ShaderChunk.envmap_vertex,
                THREE.ShaderChunk.shadowmap_vertex,
                THREE.ShaderChunk.fog_vertex,
            `}`
        ].joint("\n");
    },

    getFragmentShaderReduced(){
        return [
            `
            #define PHONG
            uniform vec3 diffuse;
            uniform vec3 emissive;
            uniform vec3 specular;
            uniform float shininess;
            uniform float opacity;`,
            THREE.ShaderChunk.common,
            THREE.ShaderChunk.packing,
            THREE.ShaderChunk.dithering_pars_fragment,
            THREE.ShaderChunk.color_pars_fragment,
            THREE.ShaderChunk.uv_pars_fragment,
            THREE.ShaderChunk.uv2_pars_fragment,
            THREE.ShaderChunk.map_pars_fragment,
            THREE.ShaderChunk.alphamap_pars_fragment,
            THREE.ShaderChunk.alphatest_pars_fragment,
            THREE.ShaderChunk.aomap_pars_fragment,
            THREE.ShaderChunk.lightmap_pars_fragment,
            THREE.ShaderChunk.emissivemap_pars_fragment,
            THREE.ShaderChunk.envmap_common_pars_fragment,
            THREE.ShaderChunk.envmap_pars_fragment,
            THREE.ShaderChunk.cube_uv_reflection_fragment,
            THREE.ShaderChunk.fog_pars_fragment,
            THREE.ShaderChunk.bsdfs,
            THREE.ShaderChunk.lights_pars_begin,
            THREE.ShaderChunk.normal_pars_fragment,
            THREE.ShaderChunk.lights_phong_pars_fragment,
            THREE.ShaderChunk.shadowmap_pars_fragment,
            THREE.ShaderChunk.bumpmap_pars_fragment,
            THREE.ShaderChunk.normalmap_pars_fragment,
            THREE.ShaderChunk.specularmap_pars_fragment,
            THREE.ShaderChunk.logdepthbuf_pars_fragment,
            THREE.ShaderChunk.clipping_planes_pars_fragment,
            `void main() {
                THREE.ShaderChunk.clipping_planes_fragment,
                vec4 diffuseColor = vec4( diffuse, opacity );
                ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
                vec3 totalEmissiveRadiance = emissive;`,
                THREE.ShaderChunk.logdepthbuf_fragment,
                THREE.ShaderChunk.map_fragment,
                THREE.ShaderChunk.color_fragment,
                THREE.ShaderChunk.alphamap_fragment,
                THREE.ShaderChunk.alphatest_fragment,
                THREE.ShaderChunk.specularmap_fragment,
                THREE.ShaderChunk.normal_fragment_begin,
                THREE.ShaderChunk.normal_fragment_maps,
                THREE.ShaderChunk.emissivemap_fragment,
                THREE.ShaderChunk.lights_phong_fragment,
                THREE.ShaderChunk.lights_fragment_begin,
                THREE.ShaderChunk.lights_fragment_maps,
                THREE.ShaderChunk.lights_fragment_end,
                THREE.ShaderChunk.aomap_fragment,
                `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;`,
                THREE.ShaderChunk.envmap_fragment,
                THREE.ShaderChunk.output_fragment,
                THREE.ShaderChunk.tonemapping_fragment,
                THREE.ShaderChunk.encodings_fragment,
                THREE.ShaderChunk.fog_fragment,
                THREE.ShaderChunk.premultiplied_alpha_fragment,
                THREE.ShaderChunk.dithering_fragment,
            `}`
        ].joint("\n");
    },

    getVertexShader(){
        return `
        precision mediump sampler2DArray;
        #define attribute in
        #define varying out
        #define texture2D texture
        precision highp float;
        precision highp int;
        #define HIGH_PRECISION
        #define SHADER_NAME MeshPhongMaterial
        #define VERTEX_TEXTURES
        #define MAX_BONES 0
        #define USE_FOG
        #define BONE_TEXTURE
        #define USE_SHADOWMAP
        #define SHADOWMAP_TYPE_PCF
        uniform mat4 modelMatrix;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform mat4 viewMatrix;
        uniform mat3 normalMatrix;
        uniform vec3 cameraPosition;
        uniform bool isOrthographic;
        #ifdef USE_INSTANCING
            attribute mat4 instanceMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        attribute vec3 position;
        attribute vec3 normal;
        attribute vec2 uv;
        #ifdef USE_TANGENT
            attribute vec4 tangent;
        #endif
        #if defined( USE_COLOR_ALPHA )
            attribute vec4 color;
        #elif defined( USE_COLOR )
            attribute vec3 color;
        #endif
        
        
        #define PHONG
        varying vec3 vViewPosition;
        #define PI 3.141592653589793
        #define PI2 6.283185307179586
        #define PI_HALF 1.5707963267948966
        #define RECIPROCAL_PI 0.3183098861837907
        #define RECIPROCAL_PI2 0.15915494309189535
        #define EPSILON 1e-6
        #ifndef saturate
        #define saturate( a ) clamp( a, 0.0, 1.0 )
        #endif
        #define whiteComplement( a ) ( 1.0 - saturate( a ) )
        float pow2( const in float x ) { return x*x; }
        float pow3( const in float x ) { return x*x*x; }
        float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
        float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
        float average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }
        highp float rand( const in vec2 uv ) {
                const highp float a = 12.9898, b = 78.233, c = 43758.5453;
            highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
            return fract( sin( sn ) * c );
        }
        #ifdef HIGH_PRECISION
            float precisionSafeLength( vec3 v ) { return length( v ); }
        #else
            float precisionSafeLength( vec3 v ) {
                  float maxComponent = max3( abs( v ) );
              return length( v / maxComponent ) * maxComponent;
            }
        #endif
        struct IncidentLight {
                vec3 color;
            vec3 direction;
            bool visible;
        };
        struct ReflectedLight {
                vec3 directDiffuse;
            vec3 directSpecular;
            vec3 indirectDiffuse;
            vec3 indirectSpecular;
        };
        struct GeometricContext {
                vec3 position;
            vec3 normal;
            vec3 viewDir;
        #ifdef USE_CLEARCOAT
            vec3 clearcoatNormal;
        #endif
        };
        vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
                return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
        }
        vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
                return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
        }
        mat3 transposeMat3( const in mat3 m ) {
                mat3 tmp;
            tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
            tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
            tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
            return tmp;
        }
        float linearToRelativeLuminance( const in vec3 color ) {
                vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
            return dot( weights, color.rgb );
        }
        bool isPerspectiveMatrix( mat4 m ) {
                return m[ 2 ][ 3 ] == - 1.0;
        }
        vec2 equirectUv( in vec3 dir ) {
                float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
            float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
            return vec2( u, v );
        }
        #ifdef USE_UV
            #ifdef UVS_VERTEX_ONLY
              vec2 vUv;
            #else
              varying vec2 vUv;
            #endif
            uniform mat3 uvTransform;
        #endif
        #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
            attribute vec2 uv2;
            varying vec2 vUv2;
            uniform mat3 uv2Transform;
        #endif
        #ifdef USE_DISPLACEMENTMAP
            uniform sampler2D displacementMap;
            uniform float displacementScale;
            uniform float displacementBias;
        #endif
        #ifdef USE_ENVMAP
            #if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) ||defined( PHONG )
              #define ENV_WORLDPOS
            #endif
            #ifdef ENV_WORLDPOS
            
              varying vec3 vWorldPosition;
            #else
              varying vec3 vReflect;
              uniform float refractionRatio;
            #endif
        #endif
        #if defined( USE_COLOR_ALPHA )
            varying vec4 vColor;
        #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
            varying vec3 vColor;
        #endif
        #ifdef USE_FOG
            varying float vFogDepth;
        #endif
        #ifndef FLAT_SHADED
            varying vec3 vNormal;
            #ifdef USE_TANGENT
              varying vec3 vTangent;
              varying vec3 vBitangent;
            #endif
        #endif
        
        #ifdef USE_SHADOWMAP
            #if 0 > 0
              uniform mat4 directionalShadowMatrix[ 0 ];
              varying vec4 vDirectionalShadowCoord[ 0 ];
              struct DirectionalLightShadow {
                    float shadowBias;
                float shadowNormalBias;
                float shadowRadius;
                vec2 shadowMapSize;
              };
              uniform DirectionalLightShadow directionalLightShadows[ 0 ];
            #endif
            #if 0 > 0
              uniform mat4 spotShadowMatrix[ 0 ];
              varying vec4 vSpotShadowCoord[ 0 ];
              struct SpotLightShadow {
                    float shadowBias;
                float shadowNormalBias;
                float shadowRadius;
                vec2 shadowMapSize;
              };
              uniform SpotLightShadow spotLightShadows[ 0 ];
            #endif
            #if 1 > 0
              uniform mat4 pointShadowMatrix[ 1 ];
              varying vec4 vPointShadowCoord[ 1 ];
              struct PointLightShadow {
                    float shadowBias;
                float shadowNormalBias;
                float shadowRadius;
                vec2 shadowMapSize;
                float shadowCameraNear;
                float shadowCameraFar;
              };
              uniform PointLightShadow pointLightShadows[ 1 ];
            #endif
        #endif
        #ifdef USE_LOGDEPTHBUF
            #ifdef USE_LOGDEPTHBUF_EXT
              varying float vFragDepth;
              varying float vIsPerspective;
            #else
              uniform float logDepthBufFC;
            #endif
        #endif
        #if 0 > 0
            varying vec3 vClipPosition;
        #endif
        void main() {
            #ifdef USE_UV
            vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
        #endif
        #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
            vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;
        #endif
        #if defined( USE_COLOR_ALPHA )
            vColor = vec4( 1.0 );
        #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
            vColor = vec3( 1.0 );
        #endif
        #ifdef USE_COLOR
            vColor *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
            vColor.xyz *= instanceColor.xyz;
        #endif
        vec3 objectNormal = vec3( normal );
        #ifdef USE_TANGENT
            vec3 objectTangent = vec3( tangent.xyz );
        #endif
        
        vec3 transformedNormal = objectNormal;
        #ifdef USE_INSTANCING
            mat3 m = mat3( instanceMatrix );
            transformedNormal /= vec3( dot( m[ 0 ], m[ 0 ] ), dot( m[ 1 ], m[ 1 ] ), dot( m[ 2 ], m[ 2 ] ) );
            transformedNormal = m * transformedNormal;
        #endif
        transformedNormal = normalMatrix * transformedNormal;
        #ifdef FLIP_SIDED
            transformedNormal = - transformedNormal;
        #endif
        #ifdef USE_TANGENT
            vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;
            #ifdef FLIP_SIDED
              transformedTangent = - transformedTangent;
            #endif
        #endif
        #ifndef FLAT_SHADED
            vNormal = normalize( transformedNormal );
            #ifdef USE_TANGENT
              vTangent = normalize( transformedTangent );
              vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
            #endif
        #endif
        vec3 transformed = vec3( position );
        
        #ifdef USE_DISPLACEMENTMAP
            transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vUv ).x * displacementScale + displacementBias );
        #endif
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        #ifdef USE_LOGDEPTHBUF
            #ifdef USE_LOGDEPTHBUF_EXT
              vFragDepth = 1.0 + gl_Position.w;
              vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
            #else
              if ( isPerspectiveMatrix( projectionMatrix ) ) {
                    gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
                gl_Position.z *= gl_Position.w;
              }
            #endif
        #endif
        #if 0 > 0
            vClipPosition = - mvPosition.xyz;
        #endif
            vViewPosition = - mvPosition.xyz;
        #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION )
            vec4 worldPosition = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
              worldPosition = instanceMatrix * worldPosition;
            #endif
            worldPosition = modelMatrix * worldPosition;
        #endif
        #ifdef USE_ENVMAP
             #ifdef ENV_WORLDPOS
             vWorldPosition = worldPosition.xyz;
            #else
               vec3 cameraToVertex;
               if ( isOrthographic ) {
                        cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
             } else {
                      cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
                 }
               vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
               #ifdef ENVMAP_MODE_REFLECTION
                    vReflect = reflect( cameraToVertex, worldNormal );
               #else
                    vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
                 #endif
           #endif
        #endif
        #ifdef USE_SHADOWMAP
            #if 0 > 0 || 0 > 0 || 1 > 0
               vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
               vec4 shadowWorldPosition;
             #endif
            #if 0 > 0
            
             #endif
            #if 0 > 0
            
             #endif
            #if 1 > 0
            
                 shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ 0 ].shadowNormalBias, 0 );
               vPointShadowCoord[ 0 ] = pointShadowMatrix[ 0 ] * shadowWorldPosition;
          
           #endif
        #endif
        #ifdef USE_FOG
          vFogDepth = - mvPosition.z;
        #endif
        }`
    },

    getFragmentShader(){
        return `
        #define varying in
        layout(location = 0) out highp vec4 pc_fragColor;
        #define gl_FragColor pc_fragColor
        #define gl_FragDepthEXT gl_FragDepth
        #define texture2D texture
        #define textureCube texture
        #define texture2DProj textureProj
        #define texture2DLodEXT textureLod
        #define texture2DProjLodEXT textureProjLod
        #define textureCubeLodEXT textureLod
        #define texture2DGradEXT textureGrad
        #define texture2DProjGradEXT textureProjGrad
        #define textureCubeGradEXT textureGrad
        precision highp float;
        precision highp int;
        #define HIGH_PRECISION
        #define SHADER_NAME MeshPhongMaterial
        #define USE_FOG
        #define USE_SHADOWMAP
        #define SHADOWMAP_TYPE_PCF
        uniform mat4 viewMatrix;
        uniform vec3 cameraPosition;
        uniform bool isOrthographic;
        #define TONE_MAPPING
        #ifndef saturate
        #define saturate( a ) clamp( a, 0.0, 1.0 )
        #endif
        uniform float toneMappingExposure;
        vec3 LinearToneMapping( vec3 color ) {
            return toneMappingExposure * color;
        }
        vec3 ReinhardToneMapping( vec3 color ) {
            color *= toneMappingExposure;
            return saturate( color / ( vec3( 1.0 ) + color ) );
        }
        vec3 OptimizedCineonToneMapping( vec3 color ) {
            color *= toneMappingExposure;
            color = max( vec3( 0.0 ), color - 0.004 );
            return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
        }
        vec3 RRTAndODTFit( vec3 v ) {
            vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
            vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
            return a / b;
        }
        vec3 ACESFilmicToneMapping( vec3 color ) {
            const mat3 ACESInputMat = mat3(
                vec3( 0.59719, 0.07600, 0.02840 ),      vec3( 0.35458, 0.90834, 0.13383 ),
                vec3( 0.04823, 0.01566, 0.83777 )
            );
            const mat3 ACESOutputMat = mat3(
                vec3(  1.60475, -0.10208, -0.00327 ),    vec3( -0.53108,  1.10813, -0.07276 ),
                vec3( -0.07367, -0.00605,  1.07602 )
            );
            color *= toneMappingExposure / 0.6;
            color = ACESInputMat * color;
            color = RRTAndODTFit( color );
            color = ACESOutputMat * color;
            return saturate( color );
        }
        vec3 CustomToneMapping( vec3 color ) { return color; }
        vec3 toneMapping( vec3 color ) { return ACESFilmicToneMapping( color ); }
        vec4 LinearToLinear( in vec4 value ) {
            return value;
        }
        vec4 sRGBToLinear( in vec4 value ) {
            return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
        }
        vec4 LinearTosRGB( in vec4 value ) {
            return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
        }
        vec4 linearToOutputTexel( vec4 value ) { return LinearTosRGB( value ); }
        
        #define PHONG
        uniform vec3 diffuse;
        uniform vec3 emissive;
        uniform vec3 specular;
        uniform float shininess;
        uniform float opacity;
        #define PI 3.141592653589793
        #define PI2 6.283185307179586
        #define PI_HALF 1.5707963267948966
        #define RECIPROCAL_PI 0.3183098861837907
        #define RECIPROCAL_PI2 0.15915494309189535
        #define EPSILON 1e-6
        #ifndef saturate
        #define saturate( a ) clamp( a, 0.0, 1.0 )
        #endif
        #define whiteComplement( a ) ( 1.0 - saturate( a ) )
        float pow2( const in float x ) { return x*x; }
        float pow3( const in float x ) { return x*x*x; }
        float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
        float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
        float average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }
        highp float rand( const in vec2 uv ) {
            const highp float a = 12.9898, b = 78.233, c = 43758.5453;
            highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
            return fract( sin( sn ) * c );
        }
        #ifdef HIGH_PRECISION
            float precisionSafeLength( vec3 v ) { return length( v ); }
        #else
            float precisionSafeLength( vec3 v ) {
                float maxComponent = max3( abs( v ) );
                return length( v / maxComponent ) * maxComponent;
            }
        #endif
        struct IncidentLight {
            vec3 color;
            vec3 direction;
            bool visible;
        };
        struct ReflectedLight {
            vec3 directDiffuse;
            vec3 directSpecular;
            vec3 indirectDiffuse;
            vec3 indirectSpecular;
        };
        struct GeometricContext {
            vec3 position;
            vec3 normal;
            vec3 viewDir;
        #ifdef USE_CLEARCOAT
            vec3 clearcoatNormal;
        #endif
        };
        vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
            return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
        }
        vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
            return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
        }
        mat3 transposeMat3( const in mat3 m ) {
            mat3 tmp;
            tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
            tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
            tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
            return tmp;
        }
        float linearToRelativeLuminance( const in vec3 color ) {
                vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
        return dot( weights, color.rgb );
        }
        bool isPerspectiveMatrix( mat4 m ) {
            return m[ 2 ][ 3 ] == - 1.0;
        }
        vec2 equirectUv( in vec3 dir ) {
            float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
            float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
            return vec2( u, v );
        }
        vec3 packNormalToRGB( const in vec3 normal ) {
            return normalize( normal ) * 0.5 + 0.5;
        }
        vec3 unpackRGBToNormal( const in vec3 rgb ) {
                return 2.0 * rgb.xyz - 1.0;
        }
        const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
        const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
        const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
        const float ShiftRight8 = 1. / 256.;
        vec4 packDepthToRGBA( const in float v ) {
            vec4 r = vec4( fract( v * PackFactors ), v );
            r.yzw -= r.xyz * ShiftRight8; return r * PackUpscale;
        }
        float unpackRGBAToDepth( const in vec4 v ) {
            return dot( v, UnpackFactors );
        }
        vec4 pack2HalfToRGBA( vec2 v ) {
            vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
            return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
        }
        vec2 unpackRGBATo2Half( vec4 v ) {
            return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
        }
        float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
            return ( viewZ + near ) / ( near - far );
        }
        float orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {
            return linearClipZ * ( near - far ) - near;
        }
        float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
            return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
        }
        float perspectiveDepthToViewZ( const in float invClipZ, const in float near, const in float far ) {
            return ( near * far ) / ( ( far - near ) * invClipZ - far );
        }
        #ifdef DITHERING
            vec3 dithering( vec3 color ) {
                float grid_position = rand( gl_FragCoord.xy );
                vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
                dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
                return color + dither_shift_RGB;
            }
        #endif
        #if defined( USE_COLOR_ALPHA )
            varying vec4 vColor;
        #elif defined( USE_COLOR )
            varying vec3 vColor;
        #endif
        #if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
            varying vec2 vUv;
        #endif
        #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
            varying vec2 vUv2;
        #endif
        #ifdef USE_MAP
            uniform sampler2D map;
        #endif
        #ifdef USE_ALPHAMAP
            uniform sampler2D alphaMap;
        #endif
        #ifdef USE_ALPHATEST
            uniform float alphaTest;
        #endif
        #ifdef USE_AOMAP
            uniform sampler2D aoMap;
            uniform float aoMapIntensity;
        #endif
        #ifdef USE_LIGHTMAP
            uniform sampler2D lightMap;
            uniform float lightMapIntensity;
        #endif
        #ifdef USE_EMISSIVEMAP
            uniform sampler2D emissiveMap;
        #endif
        #ifdef USE_ENVMAP
            uniform float envMapIntensity;
            uniform float flipEnvMap;
            #ifdef ENVMAP_TYPE_CUBE
              uniform samplerCube envMap;
            #else
              uniform sampler2D envMap;
            #endif
                
        #endif
        #ifdef USE_ENVMAP
            uniform float reflectivity;
            #if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )
              #define ENV_WORLDPOS
            #endif
            #ifdef ENV_WORLDPOS
              varying vec3 vWorldPosition;
              uniform float refractionRatio;
            #else
              varying vec3 vReflect;
            #endif
        #endif
        #ifdef ENVMAP_TYPE_CUBE_UV
            #define cubeUV_maxMipLevel 8.0
            #define cubeUV_minMipLevel 4.0
            #define cubeUV_maxTileSize 256.0
            #define cubeUV_minTileSize 16.0
            float getFace( vec3 direction ) {
                vec3 absDirection = abs( direction );
                float face = - 1.0;
                if ( absDirection.x > absDirection.z ) {
                        if ( absDirection.x > absDirection.y )
                        face = direction.x > 0.0 ? 0.0 : 3.0;
                    else
                        face = direction.y > 0.0 ? 1.0 : 4.0;
                } else {
                        if ( absDirection.z > absDirection.y )
                        face = direction.z > 0.0 ? 2.0 : 5.0;
                    else
                        face = direction.y > 0.0 ? 1.0 : 4.0;
                }
                return face;
            }
            vec2 getUV( vec3 direction, float face ) {
                vec2 uv;
                if ( face == 0.0 ) {
                        uv = vec2( direction.z, direction.y ) / abs( direction.x );
                } else if ( face == 1.0 ) {
                        uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
                } else if ( face == 2.0 ) {
                        uv = vec2( - direction.x, direction.y ) / abs( direction.z );
                } else if ( face == 3.0 ) {
                        uv = vec2( - direction.z, direction.y ) / abs( direction.x );
                } else if ( face == 4.0 ) {
                        uv = vec2( - direction.x, direction.z ) / abs( direction.y );
                } else {
                        uv = vec2( direction.x, direction.y ) / abs( direction.z );
                }
                return 0.5 * ( uv + 1.0 );
            }
            vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
                float face = getFace( direction );
                float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
                mipInt = max( mipInt, cubeUV_minMipLevel );
                float faceSize = exp2( mipInt );
                float texelSize = 1.0 / ( 3.0 * cubeUV_maxTileSize );
                vec2 uv = getUV( direction, face ) * ( faceSize - 1.0 ) + 0.5;
                if ( face > 2.0 ) {
                        uv.y += faceSize;
                    face -= 3.0;
                }
                uv.x += face * faceSize;
                if ( mipInt < cubeUV_maxMipLevel ) {
                        uv.y += 2.0 * cubeUV_maxTileSize;
                }
                uv.y += filterInt * 2.0 * cubeUV_minTileSize;
                uv.x += 3.0 * max( 0.0, cubeUV_maxTileSize - 2.0 * faceSize );
                uv *= texelSize;
                return texture2D( envMap, uv ).rgb;
            }
            #define r0 1.0
            #define v0 0.339
            #define m0 - 2.0
            #define r1 0.8
            #define v1 0.276
            #define m1 - 1.0
            #define r4 0.4
            #define v4 0.046
            #define m4 2.0
            #define r5 0.305
            #define v5 0.016
            #define m5 3.0
            #define r6 0.21
            #define v6 0.0038
            #define m6 4.0
            float roughnessToMip( float roughness ) {
                float mip = 0.0;
                if ( roughness >= r1 ) {
                        mip = ( r0 - roughness ) * ( m1 - m0 ) / ( r0 - r1 ) + m0;
                } else if ( roughness >= r4 ) {
                        mip = ( r1 - roughness ) * ( m4 - m1 ) / ( r1 - r4 ) + m1;
                } else if ( roughness >= r5 ) {
                        mip = ( r4 - roughness ) * ( m5 - m4 ) / ( r4 - r5 ) + m4;
                } else if ( roughness >= r6 ) {
                        mip = ( r5 - roughness ) * ( m6 - m5 ) / ( r5 - r6 ) + m5;
                } else {
                        mip = - 2.0 * log2( 1.16 * roughness );    }
                return mip;
            }
            vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
                float mip = clamp( roughnessToMip( roughness ), m0, cubeUV_maxMipLevel );
                float mipF = fract( mip );
                float mipInt = floor( mip );
                vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
                if ( mipF == 0.0 ) {
                    return vec4( color0, 1.0 );
                } else {
                    vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
                    return vec4( mix( color0, color1, mipF ), 1.0 );
                }
            }
            #endif
            #ifdef USE_FOG
               uniform vec3 fogColor;
             varying float vFogDepth;
             #ifdef FOG_EXP2
                  uniform float fogDensity;
               #else
                  uniform float fogNear;
                  uniform float fogFar;
               #endif
            #endif
            vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
                return RECIPROCAL_PI * diffuseColor;
            }
            vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
                float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
                return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
            }
            float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
                float a2 = pow2( alpha );
                float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
                float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
                return 0.5 / max( gv + gl, EPSILON );
            }
            float D_GGX( const in float alpha, const in float dotNH ) {
                float a2 = pow2( alpha );
                float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
                return RECIPROCAL_PI * a2 / pow2( denom );
            }
            vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 f0, const in float f90, const in float roughness ) {
                float alpha = pow2( roughness );
                vec3 halfDir = normalize( lightDir + viewDir );
                float dotNL = saturate( dot( normal, lightDir ) );
                float dotNV = saturate( dot( normal, viewDir ) );
                float dotNH = saturate( dot( normal, halfDir ) );
                float dotVH = saturate( dot( viewDir, halfDir ) );
                vec3 F = F_Schlick( f0, f90, dotVH );
                float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
                float D = D_GGX( alpha, dotNH );
                return F * ( V * D );
            }
            vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
                const float LUT_SIZE = 64.0;
                const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
                const float LUT_BIAS = 0.5 / LUT_SIZE;
                float dotNV = saturate( dot( N, V ) );
                vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
                uv = uv * LUT_SCALE + LUT_BIAS;
                return uv;
            }
            float LTC_ClippedSphereFormFactor( const in vec3 f ) {
                float l = length( f );
                return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
            }
            vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
                float x = dot( v1, v2 );
                float y = abs( x );
                float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
                float b = 3.4175940 + ( 4.1616724 + y ) * y;
                float v = a / b;
                float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
                return cross( v1, v2 ) * theta_sintheta;
            }
            vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
                vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
                vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
                vec3 lightNormal = cross( v1, v2 );
                if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
                vec3 T1, T2;
                T1 = normalize( V - N * dot( V, N ) );
                T2 = - cross( N, T1 );
                mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
                vec3 coords[ 4 ];
                coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
                coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
                coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
                coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
                coords[ 0 ] = normalize( coords[ 0 ] );
                coords[ 1 ] = normalize( coords[ 1 ] );
                coords[ 2 ] = normalize( coords[ 2 ] );
                coords[ 3 ] = normalize( coords[ 3 ] );
                vec3 vectorFormFactor = vec3( 0.0 );
                vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
                vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
                vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
                vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
                float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
                return vec3( result );
            }
            float G_BlinnPhong_Implicit( ) {
                return 0.25;
            }
            float D_BlinnPhong( const in float shininess, const in float dotNH ) {
                return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
            }
            vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
                vec3 halfDir = normalize( lightDir + viewDir );
                float dotNH = saturate( dot( normal, halfDir ) );
                float dotVH = saturate( dot( viewDir, halfDir ) );
                vec3 F = F_Schlick( specularColor, 1.0, dotVH );
                float G = G_BlinnPhong_Implicit( );
                float D = D_BlinnPhong( shininess, dotNH );
                return F * ( G * D );
            }
            #if defined( USE_SHEEN )
            float D_Charlie( float roughness, float dotNH ) {
                float alpha = pow2( roughness );
                float invAlpha = 1.0 / alpha;
                float cos2h = dotNH * dotNH;
                float sin2h = max( 1.0 - cos2h, 0.0078125 );
                return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
            }
            float V_Neubelt( float dotNV, float dotNL ) {
                return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
            }
            vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
                vec3 halfDir = normalize( lightDir + viewDir );
                float dotNL = saturate( dot( normal, lightDir ) );
                float dotNV = saturate( dot( normal, viewDir ) );
                float dotNH = saturate( dot( normal, halfDir ) );
                float D = D_Charlie( sheenRoughness, dotNH );
                float V = V_Neubelt( dotNV, dotNL );
                return sheenColor * ( D * V );
            }
            #endif
            uniform bool receiveShadow;
            uniform vec3 ambientLightColor;
            uniform vec3 lightProbe[ 9 ];
            vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
                float x = normal.x, y = normal.y, z = normal.z;
                vec3 result = shCoefficients[ 0 ] * 0.886227;
                result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
                result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
                result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
                result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
                result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
                result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
                result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
                result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
                return result;
            }
            vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
                vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
                vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
                return irradiance;
            }
            vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
                   vec3 irradiance = ambientLightColor;
               return irradiance;
            }
            float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
                 #if defined ( PHYSICALLY_CORRECT_LIGHTS )
                  float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
                if ( cutoffDistance > 0.0 ) {
                    distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
                  }
                return distanceFalloff;
                #else
                if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
                     return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
                }
                  return 1.0;
             #endif
            }
            float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
                return smoothstep( coneCosine, penumbraCosine, angleCosine );
            }
            #if 0 > 0
             struct DirectionalLight {
                vec3 direction;
                vec3 color;
              };
                uniform DirectionalLight directionalLights[ 0 ];
                void getDirectionalLightInfo( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight light ) {
                light.color = directionalLight.color;
                light.direction = directionalLight.direction;
                light.visible = true;
              }
            #endif
            #if 1 > 0
              struct PointLight {
                    vec3 position;
                    vec3 color;
                    float distance;
                    float decay;
               };
             uniform PointLight pointLights[ 1 ];
             void getPointLightInfo( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight light ) {
                    vec3 lVector = pointLight.position - geometry.position;
                    light.direction = normalize( lVector );
                    float lightDistance = length( lVector );
                    light.color = pointLight.color;
                    light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
                    light.visible = ( light.color != vec3( 0.0 ) );
                }
            #endif
            #if 0 > 0
                struct SpotLight {
                    vec3 position;
                    vec3 direction;
                    vec3 color;
                  float distance;
                    float decay;
                    float coneCos;
                    float penumbraCos;
             };
               uniform SpotLight spotLights[ 0 ];
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
            #if 0 > 0
              struct RectAreaLight {
                    vec3 color;
                    vec3 position;
                    vec3 halfWidth;
                    vec3 halfHeight;
                };
              uniform sampler2D ltc_1;    uniform sampler2D ltc_2;
                uniform RectAreaLight rectAreaLights[ 0 ];
            #endif
            #if 0 > 0
               struct HemisphereLight {
                    vec3 direction;
                    vec3 skyColor;
                    vec3 groundColor;
               };
             uniform HemisphereLight hemisphereLights[ 0 ];
               vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
                    float dotNL = dot( normal, hemiLight.direction );
                    float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
                    vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
                    return irradiance;
               }
            #endif
            #ifndef FLAT_SHADED
             varying vec3 vNormal;
                #ifdef USE_TANGENT
                  varying vec3 vTangent;
                  varying vec3 vBitangent;
                #endif
            #endif
            varying vec3 vViewPosition;
            struct BlinnPhongMaterial {
                vec3 diffuseColor;
                vec3 specularColor;
                float specularShininess;
                float specularStrength;
            };
            void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
                float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
                vec3 irradiance = dotNL * directLight.color;
                reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
                reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometry.viewDir, geometry.normal, material.specularColor, material.specularShininess ) * material.specularStrength;
               }
               void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
                    reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
               }
               #define RE_Direct            RE_Direct_BlinnPhong
               #define RE_IndirectDiffuse      RE_IndirectDiffuse_BlinnPhong
               #define Material_LightProbeLOD( material )   (0)
               #ifdef USE_SHADOWMAP
                 #if 0 > 0
                   uniform sampler2D directionalShadowMap[ 0 ];
                   varying vec4 vDirectionalShadowCoord[ 0 ];
                   struct DirectionalLightShadow {
                           float shadowBias;
                    float shadowNormalBias;
                       float shadowRadius;
                      vec2 shadowMapSize;
                     };
                     uniform DirectionalLightShadow directionalLightShadows[ 0 ];
                 #endif
                   #if 0 > 0
                   uniform sampler2D spotShadowMap[ 0 ];
                     varying vec4 vSpotShadowCoord[ 0 ];
                   struct SpotLightShadow {
                        float shadowBias;
                         float shadowNormalBias;
                    float shadowRadius;
                       vec2 shadowMapSize;
                   };
                   uniform SpotLightShadow spotLightShadows[ 0 ];
                #endif
                  #if 1 > 0
                     uniform sampler2D pointShadowMap[ 1 ];
                     varying vec4 vPointShadowCoord[ 1 ];
                     struct PointLightShadow {
                        float shadowBias;
                         float shadowNormalBias;
                    float shadowRadius;
                       vec2 shadowMapSize;
                      float shadowCameraNear;
                         float shadowCameraFar;
                     };
                     uniform PointLightShadow pointLightShadows[ 1 ];
                   #endif
                 float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
                         return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
                  }
                 vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
                       return unpackRGBATo2Half( texture2D( shadow, uv ) );
                  }
                 float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
                         float occlusion = 1.0;
                     vec2 distribution = texture2DDistribution( shadow, uv );
                     float hard_shadow = step( compare , distribution.x );
                   if (hard_shadow != 1.0 ) {
                        float distance = compare - distribution.x ;
                       float variance = max( 0.00000, distribution.y * distribution.y );
                    float softness_probability = variance / (variance + distance * distance );     softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );     occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
                   }
                     return occlusion;
                  }
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
                   float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );      dp += shadowBias;
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
               #endif
               #ifdef USE_BUMPMAP
                   uniform sampler2D bumpMap;
                 uniform float bumpScale;
                 vec2 dHdxy_fwd() {
                         vec2 dSTdx = dFdx( vUv );
                   vec2 dSTdy = dFdy( vUv );
                     float Hll = bumpScale * texture2D( bumpMap, vUv ).x;
                     float dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;
                     float dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;
                     return vec2( dBx, dBy );
                 }
                vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
                         vec3 vSigmaX = vec3( dFdx( surf_pos.x ), dFdx( surf_pos.y ), dFdx( surf_pos.z ) );
                     vec3 vSigmaY = vec3( dFdy( surf_pos.x ), dFdy( surf_pos.y ), dFdy( surf_pos.z ) );
                     vec3 vN = surf_norm;
                     vec3 R1 = cross( vSigmaY, vN );
                   vec3 R2 = cross( vN, vSigmaX );
                     float fDet = dot( vSigmaX, R1 ) * faceDirection;
                     vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
                     return normalize( abs( fDet ) * surf_norm - vGrad );
                 }
               #endif
               #ifdef USE_NORMALMAP
                  uniform sampler2D normalMap;
                  uniform vec2 normalScale;
               #endif
               #ifdef OBJECTSPACE_NORMALMAP
                   uniform mat3 normalMatrix;
               #endif
               #if ! defined ( USE_TANGENT ) && ( defined ( TANGENTSPACE_NORMALMAP ) || defined ( USE_CLEARCOAT_NORMALMAP ) )
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
               #endif
               #ifdef USE_SPECULARMAP
                uniform sampler2D specularMap;
               #endif
               #if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
                uniform float logDepthBufFC;
                varying float vFragDepth;
                varying float vIsPerspective;
               #endif
               #if 0 > 0
                varying vec3 vClipPosition;
                uniform vec4 clippingPlanes[ 0 ];
               #endif
               void main() {
                   #if 0 > 0
                vec4 plane;
                
                #if 0 < 0
                   bool clipped = true;
                   
                   if ( clipped ) discard;
                #endif
               #endif
                vec4 diffuseColor = vec4( diffuse, opacity );
                ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
                vec3 totalEmissiveRadiance = emissive;
               #if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
                gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
               #endif
               #ifdef USE_MAP
                vec4 texelColor = texture2D( map, vUv );
                texelColor = mapTexelToLinear( texelColor );
                diffuseColor *= texelColor;
               #endif
               #if defined( USE_COLOR_ALPHA )
                diffuseColor *= vColor;
               #elif defined( USE_COLOR )
                diffuseColor.rgb *= vColor;
               #endif
               #ifdef USE_ALPHAMAP
                diffuseColor.a *= texture2D( alphaMap, vUv ).g;
               #endif
               #ifdef USE_ALPHATEST
                if ( diffuseColor.a < alphaTest ) discard;
               #endif
               float specularStrength;
               #ifdef USE_SPECULARMAP
                vec4 texelSpecular = texture2D( specularMap, vUv );
                specularStrength = texelSpecular.r;
               #else
                specularStrength = 1.0;
               #endif
               float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
               #ifdef FLAT_SHADED
                vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
                vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
                vec3 normal = normalize( cross( fdx, fdy ) );
               #else
                vec3 normal = normalize( vNormal );
                #ifdef DOUBLE_SIDED
                   normal = normal * faceDirection;
                #endif
                #ifdef USE_TANGENT
                   vec3 tangent = normalize( vTangent );
                   vec3 bitangent = normalize( vBitangent );
                   #ifdef DOUBLE_SIDED
                    tangent = tangent * faceDirection;
                    bitangent = bitangent * faceDirection;
                   #endif
                   #if defined( TANGENTSPACE_NORMALMAP ) || defined( USE_CLEARCOAT_NORMALMAP )
                    mat3 vTBN = mat3( tangent, bitangent, normal );
                   #endif
                #endif
               #endif
               vec3 geometryNormal = normal;
               #ifdef OBJECTSPACE_NORMALMAP
                normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
                #ifdef FLIP_SIDED
                   normal = - normal;
                #endif
                #ifdef DOUBLE_SIDED
                   normal = normal * faceDirection;
                #endif
                normal = normalize( normalMatrix * normal );
               #elif defined( TANGENTSPACE_NORMALMAP )
                vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
                mapN.xy *= normalScale;
                #ifdef USE_TANGENT
                   normal = normalize( vTBN * mapN );
                #else
                   normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
                #endif
               #elif defined( USE_BUMPMAP )
                normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
               #endif
               #ifdef USE_EMISSIVEMAP
                vec4 emissiveColor = texture2D( emissiveMap, vUv );
                emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;
                totalEmissiveRadiance *= emissiveColor.rgb;
               #endif
               BlinnPhongMaterial material;
               material.diffuseColor = diffuseColor.rgb;
               material.specularColor = specular;
               material.specularShininess = shininess;
               material.specularStrength = specularStrength;
               
               GeometricContext geometry;
               geometry.position = - vViewPosition;
               geometry.normal = normal;
               geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
               #ifdef USE_CLEARCOAT
                geometry.clearcoatNormal = clearcoatNormal;
               #endif
               IncidentLight directLight;
               #if ( 1 > 0 ) && defined( RE_Direct )
                PointLight pointLight;
                #if defined( USE_SHADOWMAP ) && 1 > 0
                PointLightShadow pointLightShadow;
                #endif
                
                   pointLight = pointLights[ 0 ];
                   getPointLightInfo( pointLight, geometry, directLight );
                   #if defined( USE_SHADOWMAP ) && ( 0 < 1 )
                   pointLightShadow = pointLightShadows[ 0 ];
                   directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ 0 ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ 0 ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
                   #endif
                   RE_Direct( directLight, geometry, material, reflectedLight );
                
               #endif
               #if ( 0 > 0 ) && defined( RE_Direct )
                SpotLight spotLight;
                #if defined( USE_SHADOWMAP ) && 0 > 0
                SpotLightShadow spotLightShadow;
                #endif
                
               #endif
               #if ( 0 > 0 ) && defined( RE_Direct )
                DirectionalLight directionalLight;
                #if defined( USE_SHADOWMAP ) && 0 > 0
                DirectionalLightShadow directionalLightShadow;
                #endif
                
               #endif
               #if ( 0 > 0 ) && defined( RE_Direct_RectArea )
                RectAreaLight rectAreaLight;
                
               #endif
               #if defined( RE_IndirectDiffuse )
                vec3 iblIrradiance = vec3( 0.0 );
                vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
                irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );
                #if ( 0 > 0 )
                   
                #endif
               #endif
               #if defined( RE_IndirectSpecular )
                vec3 radiance = vec3( 0.0 );
                vec3 clearcoatRadiance = vec3( 0.0 );
               #endif
               #if defined( RE_IndirectDiffuse )
                #ifdef USE_LIGHTMAP
                   vec4 lightMapTexel = texture2D( lightMap, vUv2 );
                   vec3 lightMapIrradiance = lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
                   #ifndef PHYSICALLY_CORRECT_LIGHTS
                    lightMapIrradiance *= PI;
                   #endif
                   irradiance += lightMapIrradiance;
                #endif
                #if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
                   iblIrradiance += getIBLIrradiance( geometry.normal );
                #endif
               #endif
               #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
                radiance += getIBLRadiance( geometry.viewDir, geometry.normal, material.roughness );
                #ifdef USE_CLEARCOAT
                   clearcoatRadiance += getIBLRadiance( geometry.viewDir, geometry.clearcoatNormal, material.clearcoatRoughness );
                #endif
               #endif
               #if defined( RE_IndirectDiffuse )
                RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );
               #endif
               #if defined( RE_IndirectSpecular )
                RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometry, material, reflectedLight );
               #endif
               #ifdef USE_AOMAP
                float ambientOcclusion = ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;
                reflectedLight.indirectDiffuse *= ambientOcclusion;
                #if defined( USE_ENVMAP ) && defined( STANDARD )
                   float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
                   reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
                #endif
               #endif
                vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
               #ifdef USE_ENVMAP
                #ifdef ENV_WORLDPOS
                   vec3 cameraToFrag;
                   if ( isOrthographic ) {
                        cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
                   } else {
                        cameraToFrag = normalize( vWorldPosition - cameraPosition );
                   }
                   vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
                   #ifdef ENVMAP_MODE_REFLECTION
                    vec3 reflectVec = reflect( cameraToFrag, worldNormal );
                   #else
                    vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
                   #endif
                #else
                   vec3 reflectVec = vReflect;
                #endif
                #ifdef ENVMAP_TYPE_CUBE
                   vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
                   envColor = envMapTexelToLinear( envColor );
                #elif defined( ENVMAP_TYPE_CUBE_UV )
                   vec4 envColor = textureCubeUV( envMap, reflectVec, 0.0 );
                #else
                   vec4 envColor = vec4( 0.0 );
                #endif
                #ifdef ENVMAP_BLENDING_MULTIPLY
                   outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
                #elif defined( ENVMAP_BLENDING_MIX )
                   outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
                #elif defined( ENVMAP_BLENDING_ADD )
                   outgoingLight += envColor.xyz * specularStrength * reflectivity;
                #endif
               #endif
               #ifdef OPAQUE
               diffuseColor.a = 1.0;
               #endif
               #ifdef USE_TRANSMISSION
               diffuseColor.a *= transmissionAlpha + 0.1;
               #endif
               gl_FragColor = vec4( outgoingLight, diffuseColor.a );
               #if defined( TONE_MAPPING )
                gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
               #endif
               gl_FragColor = linearToOutputTexel( gl_FragColor );
               #ifdef USE_FOG
                #ifdef FOG_EXP2
                   float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
                #else
                   float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
                #endif
                gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
               #endif
               #ifdef PREMULTIPLIED_ALPHA
                gl_FragColor.rgb *= gl_FragColor.a;
               #endif
               #ifdef DITHERING
                gl_FragColor.rgb = dithering( gl_FragColor.rgb );
               #endif
               }`
    }

}
export { ShaderChunk }