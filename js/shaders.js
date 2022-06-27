import * as THREE from 'three';

const ShaderChunk = {

    gbufferVert: `
        out vec3 vNormal;
        out vec2 vUv;

        void main() {

            vUv = uv;

            // get smooth normals
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

            vec3 transformedNormal = normalMatrix * normal;
            vNormal = normalize( transformedNormal );

            gl_Position = projectionMatrix * mvPosition;

        }
    `,

    gbufferFrag: `
        precision highp float;
        precision highp int;

        layout(location = 0) out vec4 gColor;

        uniform sampler2D tDiffuse;

        in vec3 vNormal;
        in vec2 vUv;

        void main() {

            // write color to G-Buffer
            gColor = texture( tDiffuse, vUv );
        }
    `,

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
        return `           

            out vec2 vUv;
            out vec3 vViewPosition;
            out vec3 vNormal;

            #define USE_SHADOWMAP

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
            void main() {
                vNormal = vec3( normal );
                vUv = uv;
                vec4 mvPosition = vec4( position, 1.0 );
                mvPosition = modelViewMatrix * mvPosition;
                vViewPosition = - mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }

        `
    },

    fragmentShaderQuad() {

        return `
        #define RE_Direct RE_Direct_BlinnPhong
        precision highp float;
        precision highp int;

        layout(location = 0) out vec4 pc_FragColor;

        in vec2 vUv;
        #include <common>
        #include <packing>
        #include <normal_pars_fragment>
        #include <lights_pars_begin>
        #include <bsdfs>
        #include <lights_phong_pars_fragment>

        uniform sampler2D color_texture;
        uniform sampler2D normal_texture;
        uniform sampler2D depth_texture;
        uniform sampler2D detailed_normal_texture;
        
        uniform sampler2D specular_texture;
        uniform float specularIntensity;

        uniform float u_ambientIntensity;
        uniform float u_shadowShrinking;
        uniform float u_translucencyScale;
        
        uniform mat4 projectionMatrix;
        
        mat4 u_invvp;

        
        #if NUM_DIR_LIGHT_SHADOWS > 0
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
        #if NUM_DIR_LIGHTS > 0 
        struct DirectionalLight {
            vec3 direction;
            vec3 color;
        };
        // uniform DirectionalLight directionalLights[ 0 ];
        // void getDirectionalLightInfo( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight light ) {
        //     light.color = directionalLight.color;
        //     light.direction = directionalLight.direction;
        //     light.visible = true;
        // }
        #endif
        vec3 getPositionWSFromDepth(float depth){
            //build pixel info
            depth = depth * 2.0 - 1.0;
            vec2 pos2D = vUv * 2.0 - vec2(1.0);
            vec4 pos = vec4( pos2D, depth, 1.0 );
            pos = u_invvp * pos;
            pos.xyz = pos.xyz / pos.w;
            return pos.xyz;
        }
        
        float linearDepthNormalized(float z, float near, float far){
            float z_n = 2.0 * z - 1.0;
            return 2.0 * near * far / (far + near - z_n * (far - near));
        }
        
        void main() {
            
            
            vec3 normal = normalize( vNormal );
            ReflectedLight reflectedLight;
            
            #include <lights_fragment_begin>
            
            u_invvp = inverse( projectionMatrix * viewMatrix );
            
            vec3 albedo = texture( color_texture, vUv ).rgb;
            float sss = texture( color_texture, vUv ).a;
            float mask = texture( normal_texture, vUv ).a;
            vec3 specular = texture( specular_texture, vUv ).rgb;

            BlinnPhongMaterial material;
            material.diffuseColor = albedo;
            material.specularColor = specular;
            material.specularShininess = specularIntensity;
            material.specularStrength = u_shadowShrinking;

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
                    L += directLight.direction;
                    RE_Direct( directLight, geometry, material, reflectedLight );
                }
                #pragma unroll_loop_end
                #endif
                
               

            // vec3 N = normalize(texture( normal_texture, vUv ).rgb * 2.0 - 1.0);
            // vec3 hN = normalize(texture2D( detailed_normal_texture, vUv ).xyz * 2.0 - 1.0);
            // float light_distance = length(L);
            // L /= light_distance;


            vec3 ambient = albedo * u_ambientIntensity;
            vec3 diffuse = albedo * reflectedLight.directDiffuse;
            pc_FragColor.rgb = reflectedLight.directDiffuse;
            pc_FragColor.a = mask;
           

        }

        `
    },

    getVertexShaderReduced() {

        return [
            `   
            precision mediump sampler2DArray;
            #define attribute in
            #define varying out
            #define texture2D texture
            precision highp float;
            precision highp int;
            #define HIGH_PRECISION
            #define SHADER_NAME MeshStandardMaterial
            #define STANDARD 
            #define VERTEX_TEXTURES
            #define MAX_BONES 1024
            #define USE_FOG
            #define USE_MAP
            #define USE_NORMALMAP
            #define TANGENTSPACE_NORMALMAP
            #define USE_ROUGHNESSMAP
            #define USE_METALNESSMAP
            #define USE_UV
            #define USE_SKINNING
            #define BONE_TEXTURE
            #define USE_MORPHTARGETS
            #define USE_MORPHNORMALS
            #define MORPHTARGETS_TEXTURE
            #define MORPHTARGETS_COUNT 50
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
            #ifdef USE_SKINNING
                attribute vec4 skinIndex;
                attribute vec4 skinWeight;
            #endif
         
            #define STANDARD
            varying vec3 vViewPosition;
            #ifdef USE_TRANSMISSION
                varying vec3 vWorldPosition;
            #endif`,
            THREE.ShaderChunk.common,
            THREE.ShaderChunk.uv_pars_vertex,
            THREE.ShaderChunk.uv2_pars_vertex,
            THREE.ShaderChunk.displacementmap_pars_vertex,
            THREE.ShaderChunk.color_pars_vertex,
            THREE.ShaderChunk.fog_pars_vertex,
            THREE.ShaderChunk.normal_pars_vertex,
            THREE.ShaderChunk.morphtarget_pars_vertex,
            THREE.ShaderChunk.skinning_pars_vertex,
            THREE.ShaderChunk.shadowmap_pars_vertex,
            THREE.ShaderChunk.logdepthbuf_pars_vertex,
            THREE.ShaderChunk.clipping_planes_pars_vertex,
            `void main() {`,
                THREE.ShaderChunk.uv_vertex,
                THREE.ShaderChunk.uv2_vertex,
                THREE.ShaderChunk.color_vertex,
                THREE.ShaderChunk.beginnormal_vertex,
                THREE.ShaderChunk.morphnormal_vertex,
                THREE.ShaderChunk.skinbase_vertex,
                THREE.ShaderChunk.skinnormal_vertex,
                THREE.ShaderChunk.defaultnormal_vertex,
                THREE.ShaderChunk.normal_vertex,
                THREE.ShaderChunk.begin_vertex,
                THREE.ShaderChunk.morphtarget_vertex,
                THREE.ShaderChunk.skinning_vertex,
                THREE.ShaderChunk.displacementmap_vertex,
                THREE.ShaderChunk.project_vertex,
                THREE.ShaderChunk.logdepthbuf_vertex,
                THREE.ShaderChunk.clipping_planes_vertex,
                `vViewPosition = - mvPosition.xyz;`,
                THREE.ShaderChunk.worldpos_vertex,
                THREE.ShaderChunk.shadowmap_vertex,
                THREE.ShaderChunk.fog_vertex,
            `#ifdef USE_TRANSMISSION
                vWorldPosition = worldPosition.xyz;
            #endif
            }`
        ].joint("\n");
    },

    getFragmentShaderReduced() {

        return [
            `
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
            #define SHADER_NAME MeshStandardMaterial
            #define STANDARD 
            #define USE_FOG
            #define USE_MAP
            #define USE_NORMALMAP
            #define TANGENTSPACE_NORMALMAP
            #define USE_ROUGHNESSMAP
            #define USE_METALNESSMAP
            #define USE_UV
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
                    vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
                    vec3( 0.04823, 0.01566, 0.83777 )
                );
                const mat3 ACESOutputMat = mat3(
                    vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
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
            #define OPAQUE
            vec4 LinearToLinear( in vec4 value ) {
                return value;
            }
            vec4 sRGBToLinear( in vec4 value ) {
                return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
            }
            vec4 LinearTosRGB( in vec4 value ) {
                return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
            }
            vec4 mapTexelToLinear( vec4 value ) { return LinearToLinear( value ); }
            vec4 linearToOutputTexel( vec4 value ) { return LinearToLinear( value ); }
            #define STANDARD
            
            #ifdef PHYSICAL
                #define IOR
                #define SPECULAR
            #endif
            uniform vec3 diffuse;
            uniform vec3 emissive;
            uniform float roughness;
            uniform float metalness;
            uniform float opacity;
            #ifdef IOR
                uniform float ior;
            #endif
            #ifdef SPECULAR
                uniform float specularIntensity;
                uniform vec3 specularColor;
                #ifdef USE_SPECULARINTENSITYMAP
                    uniform sampler2D specularIntensityMap;
                #endif
                #ifdef USE_SPECULARCOLORMAP
                    uniform sampler2D specularColorMap;
                #endif
            #endif
            #ifdef USE_CLEARCOAT
                uniform float clearcoat;
                uniform float clearcoatRoughness;
            #endif
            #ifdef USE_SHEEN
                uniform vec3 sheenColor;
                uniform float sheenRoughness;
                #ifdef USE_SHEENCOLORMAP
                    uniform sampler2D sheenColorMap;
                #endif
                #ifdef USE_SHEENROUGHNESSMAP
                    uniform sampler2D sheenRoughnessMap;
                #endif
            #endif
            varying vec3 vViewPosition;
            #include <common>
            #include <packing>
            #include <dithering_pars_fragment>
            #include <color_pars_fragment>
            #include <uv_pars_fragment>
            #include <uv2_pars_fragment>
            #include <map_pars_fragment>
            #include <alphamap_pars_fragment>
            #include <alphatest_pars_fragment>
            #include <aomap_pars_fragment>
            #include <lightmap_pars_fragment>
            #include <emissivemap_pars_fragment>
            #include <bsdfs>
            #include <cube_uv_reflection_fragment>
            #include <envmap_common_pars_fragment>
            #include <envmap_physical_pars_fragment>
            #include <fog_pars_fragment>
            #include <lights_pars_begin>
            #include <normal_pars_fragment>
            #include <lights_physical_pars_fragment>
            #include <transmission_pars_fragment>
            #include <shadowmap_pars_fragment>
            #include <bumpmap_pars_fragment>
            #include <normalmap_pars_fragment>
            #include <clearcoat_pars_fragment>
            #include <roughnessmap_pars_fragment>
            #include <metalnessmap_pars_fragment>
            #include <logdepthbuf_pars_fragment>
            #include <clipping_planes_pars_fragment>
            void main() {
                #include <clipping_planes_fragment>
                vec4 diffuseColor = vec4( diffuse, opacity );
                ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
                vec3 totalEmissiveRadiance = emissive;
                #include <logdepthbuf_fragment>
                #include <map_fragment>
                #include <color_fragment>
                #include <alphamap_fragment>
                #include <alphatest_fragment>
                #include <roughnessmap_fragment>
                #include <metalnessmap_fragment>
                #include <normal_fragment_begin>
                #include <normal_fragment_maps>
                #include <clearcoat_normal_fragment_begin>
                #include <clearcoat_normal_fragment_maps>
                #include <emissivemap_fragment>
                #include <lights_physical_fragment>
                #include <lights_fragment_begin>
                #include <lights_fragment_maps>
                #include <lights_fragment_end>
                #include <aomap_fragment>
                vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
                vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
                #include <transmission_fragment>
                vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
                #ifdef USE_SHEEN
                    float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
                    outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecular;
                #endif
                #ifdef USE_CLEARCOAT
                    float dotNVcc = saturate( dot( geometry.clearcoatNormal, geometry.viewDir ) );
                    vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
                    outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + clearcoatSpecular * material.clearcoat;
                #endif
                #include <output_fragment>
                #include <tonemapping_fragment>
                #include <encodings_fragment>
                #include <fog_fragment>
                #include <premultiplied_alpha_fragment>
                #include <dithering_fragment>
            }
            `
        ].joint("\n");
    },

    getVertexShader() {

        return `
        precision mediump sampler2DArray;
        #define attribute in
        #define varying out
        #define texture2D texture
        precision highp float;
        precision highp int;
        #define HIGH_PRECISION
        //#define SHADER_NAME MeshStandardMaterial
        #define STANDARD 
        #define VERTEX_TEXTURES
        #define MAX_BONES 1024
        #define USE_FOG
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
        #if defined( USE_COLOR_ALPHA )
            attribute vec4 color;
        #elif defined( USE_COLOR )
            attribute vec3 color;
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
        // #ifdef USE_SKINNING
        //     attribute vec4 skinIndex;
        //     attribute vec4 skinWeight;
        // #endif
        
        #define STANDARD
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
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
        #if defined( USE_COLOR_ALPHA )
            varying vec4 vColor;
        #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
            varying vec3 vColor;
        #endif
        #ifdef USE_FOG
            varying float vFogDepth;
        #endif
        varying vec3 vWorldNormal;
        #ifndef FLAT_SHADED
            varying vec3 vNormal;
            #ifdef USE_TANGENT
             varying vec3 vTangent;
             varying vec3 vBitangent;
            #endif
        #endif
        #ifdef USE_MORPHTARGETS
            uniform float morphTargetBaseInfluence;
            #ifdef MORPHTARGETS_TEXTURE
             uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
             uniform sampler2DArray morphTargetsTexture;
             uniform vec2 morphTargetsTextureSize;
             vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {
                  float texelIndex = float( vertexIndex * stride + offset );
                  float y = floor( texelIndex / morphTargetsTextureSize.x );
              float x = texelIndex - y * morphTargetsTextureSize.x;
              vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );
              return texture( morphTargetsTexture, morphUV ).xyz;
             }
            #else
             #ifndef USE_MORPHNORMALS
              uniform float morphTargetInfluences[ 8 ];
             #else
              uniform float morphTargetInfluences[ 4 ];
             #endif
            #endif
        #endif
        #ifdef USE_SKINNING
            uniform mat4 bindMatrix;
            uniform mat4 bindMatrixInverse;
            #ifdef BONE_TEXTURE
             uniform highp sampler2D boneTexture;
             uniform int boneTextureSize;
             mat4 getBoneMatrix( const in float i ) {
                  float j = i * 4.0;
                  float x = mod( j, float( boneTextureSize ) );
                  float y = floor( j / float( boneTextureSize ) );
              float dx = 1.0 / float( boneTextureSize );
              float dy = 1.0 / float( boneTextureSize );
              y = dy * ( y + 0.5 );
              vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );
              vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );
              vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );
              vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );
              mat4 bone = mat4( v1, v2, v3, v4 );
              return bone;
             }
            #else
             uniform mat4 boneMatrices[ MAX_BONES ];
             mat4 getBoneMatrix( const in float i ) {
                  mat4 bone = boneMatrices[ int(i) ];
                  return bone;
                 }
            #endif
        #endif
        #ifdef USE_SHADOWMAP
            #if NUM_DIR_LIGHT_SHADOWS > 0
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
            #if NUM_SPOT_LIGHT_SHADOWS > 0
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
            #if NUM_POINT_LIGHT_SHADOWS > 0
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
            #ifdef USE_MORPHNORMALS
                objectNormal *= morphTargetBaseInfluence;
                #ifdef MORPHTARGETS_TEXTURE
                 for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
                    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];
                 }
            #else
             objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
             objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
             objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
             objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
            #endif
        #endif
        #ifdef USE_SKINNING
            mat4 boneMatX = getBoneMatrix( skinIndex.x );
            mat4 boneMatY = getBoneMatrix( skinIndex.y );
            mat4 boneMatZ = getBoneMatrix( skinIndex.z );
            mat4 boneMatW = getBoneMatrix( skinIndex.w );
        #endif
        #ifdef USE_SKINNING
            mat4 skinMatrix = mat4( 0.0 );
            skinMatrix += skinWeight.x * boneMatX;
            skinMatrix += skinWeight.y * boneMatY;
            skinMatrix += skinWeight.z * boneMatZ;
            skinMatrix += skinWeight.w * boneMatW;
            skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
            objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
            #ifdef USE_TANGENT
                objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
              #endif
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
            #ifdef USE_MORPHTARGETS
               transformed *= morphTargetBaseInfluence;
             #ifdef MORPHTARGETS_TEXTURE
                for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
                 #ifndef USE_MORPHNORMALS
                   transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];
                    #else
                 transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];
                  #endif
              }
               #else
                transformed += morphTarget0 * morphTargetInfluences[ 0 ];
             transformed += morphTarget1 * morphTargetInfluences[ 1 ];
              transformed += morphTarget2 * morphTargetInfluences[ 2 ];
               transformed += morphTarget3 * morphTargetInfluences[ 3 ];
                #ifndef USE_MORPHNORMALS
              transformed += morphTarget4 * morphTargetInfluences[ 4 ];
               transformed += morphTarget5 * morphTargetInfluences[ 5 ];
                transformed += morphTarget6 * morphTargetInfluences[ 6 ];
             transformed += morphTarget7 * morphTargetInfluences[ 7 ];
              #endif
              #endif
            #endif
            #ifdef USE_SKINNING
             vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
               vec4 skinned = vec4( 0.0 );
              skinned += boneMatX * skinVertex * skinWeight.x;
                skinned += boneMatY * skinVertex * skinWeight.y;
              skinned += boneMatZ * skinVertex * skinWeight.z;
                skinned += boneMatW * skinVertex * skinWeight.w;
              transformed = ( bindMatrixInverse * skinned ).xyz;
            #endif
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
               vViewPosition =  - mvPosition.xyz;
            #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION )
             vec4 worldPosition = vec4( transformed, 1.0 );
             #ifdef USE_INSTANCING
              worldPosition = instanceMatrix * worldPosition;
             #endif
             worldPosition = modelMatrix * worldPosition;
            #endif
            #ifdef USE_SHADOWMAP
            #if NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0
                vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
              vec4 shadowWorldPosition;
               #endif
               #if NUM_DIR_LIGHT_SHADOWS > 0
                
              #endif
              #if 0 > 0
               
             #endif
             #if NUM_POINT_LIGHT_SHADOWS > 0
              
                shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ 0 ].shadowNormalBias, 0 );
                vPointShadowCoord[ 0 ] = pointShadowMatrix[ 0 ] * shadowWorldPosition;
             
               #endif
            #endif
            #ifdef USE_FOG
               vFogDepth = - mvPosition.z;
            #endif
            vWorldNormal = (inverse(viewMatrix) * vec4(transformedNormal, 0.0)).xyz;
            vWorldPosition = worldPosition.xyz;
        }
        `
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
        // #define SHADER_NAME MeshStandardMaterial
        #define STANDARD 
        #define USE_FOG
        #define USE_MAP
        #define USE_NORMALMAP
        #define TANGENTSPACE_NORMALMAP
        #define USE_ROUGHNESSMAP
        #define USE_METALNESSMAP
        #define USE_UV
        #define USE_SHADOWMAP
        #define SHADOWMAP_TYPE_PCF
        // uniform mat4 viewMatrix;
        // uniform vec3 cameraPosition;
        // uniform bool isOrthographic;
        #define TONE_MAPPING
        #ifndef saturate
        #define saturate( a ) clamp( a, 0.0, 1.0 )
        #endif
        // uniform float toneMappingExposure;
    //     vec3 LinearToneMapping( vec3 color ) {
    //             return toneMappingExposure * color;
    //     }
    //     vec3 ReinhardToneMapping( vec3 color ) {
    //             color *= toneMappingExposure;
    //             return saturate( color / ( vec3( 1.0 ) + color ) );
    // }
    //     vec3 OptimizedCineonToneMapping( vec3 color ) {
    //             color *= toneMappingExposure;
    //             color = max( vec3( 0.0 ), color - 0.004 );
    //             return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
    // }
    //     vec3 RRTAndODTFit( vec3 v ) {
    //             vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
    //             vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
    //             return a / b;
    // }
    //     vec3 ACESFilmicToneMapping( vec3 color ) {
    //             const mat3 ACESInputMat = mat3(
    //               vec3( 0.59719, 0.07600, 0.02840 ),      vec3( 0.35458, 0.90834, 0.13383 ),
    //               vec3( 0.04823, 0.01566, 0.83777 )
    //             );
    //             const mat3 ACESOutputMat = mat3(
    //               vec3(  1.60475, -0.10208, -0.00327 ),    vec3( -0.53108,  1.10813, -0.07276 ),
    //               vec3( -0.07367, -0.00605,  1.07602 )
    //             );
    //             color *= toneMappingExposure / 0.6;
    //         color = ACESInputMat * color;
    //         color = RRTAndODTFit( color );
    //         color = ACESOutputMat * color;
    //         return saturate( color );
    // }
        // vec3 CustomToneMapping( vec3 color ) { return color; }
        // vec3 toneMapping( vec3 color ) { return ACESFilmicToneMapping( color ); }
        #define OPAQUE
        // vec4 LinearToLinear( in vec4 value ) {
        //         return value;
        // }
        // vec4 sRGBToLinear( in vec4 value ) {
        //         return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
        // }
        // vec4 LinearTosRGB( in vec4 value ) {
        //         return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
        // }
        vec4 mapTexelToLinear( vec4 value ) { return LinearToLinear( value ); }
        //vec4 linearToOutputTexel( vec4 value ) { return LinearToLinear( value ); }
        
        #define STANDARD
        #ifdef PHYSICAL
            #define IOR
            #define SPECULAR
        #endif
        uniform vec3 diffuse;
        uniform vec3 emissive;
        uniform float roughness;
        uniform float metalness;
        uniform float opacity;
        #ifdef IOR
            uniform float ior;
        #endif
        #ifdef SPECULAR
            uniform float specularIntensity;
            uniform vec3 specularColor;
            #ifdef USE_SPECULARINTENSITYMAP
              uniform sampler2D specularIntensityMap;
            #endif
            #ifdef USE_SPECULARCOLORMAP
              uniform sampler2D specularColorMap;
            #endif
        #endif
        #ifdef USE_CLEARCOAT
            uniform float clearcoat;
            uniform float clearcoatRoughness;
        #endif
        #ifdef USE_SHEEN
            uniform vec3 sheenColor;
            uniform float sheenRoughness;
            #ifdef USE_SHEENCOLORMAP
              uniform sampler2D sheenColorMap;
            #endif
            #ifdef USE_SHEENROUGHNESSMAP
              uniform sampler2D sheenRoughnessMap;
            #endif
        #endif
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
        vec3 packNormalToRGB( const in vec3 normal ) {
                return normalize( normal ) * 0.5 + 0.5;
        }
        vec3 unpackRGBToNormal( const in vec3 rgb ) {
                return 2.0 * rgb.xyz - 1.0;
        }
        const float PackUpscale = 256. / 255.;
        const float UnpackDownscale = 255. / 256.;
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
            #ifdef USE_ENVMAP
                uniform float envMapIntensity;
                uniform float flipEnvMap;
                #ifdef ENVMAP_TYPE_CUBE
                  uniform samplerCube envMap;
                #else
                  uniform sampler2D envMap;
                #endif
                
            #endif
            #if defined( USE_ENVMAP )
                #ifdef ENVMAP_MODE_REFRACTION
                  uniform float refractionRatio;
                #endif
                vec3 getIBLIrradiance( const in vec3 normal ) {
                      #if defined( ENVMAP_TYPE_CUBE_UV )
                          vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
                          vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
                          return PI * envMapColor.rgb * envMapIntensity;
                      #else
                          return vec3( 0.0 );
                      #endif
                    }
                vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
                      #if defined( ENVMAP_TYPE_CUBE_UV )
                          vec3 reflectVec;
                          #ifdef ENVMAP_MODE_REFLECTION
                            reflectVec = reflect( - viewDir, normal );
                            reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
                          #else
                            reflectVec = refract( - viewDir, normal, refractionRatio );
                          #endif
                          reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
                          vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
                          return envMapColor.rgb * envMapIntensity;
                      #else
                          return vec3( 0.0 );
                      #endif
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
                    uniform sampler2D ltc_1;  uniform sampler2D ltc_2;
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
                struct PhysicalMaterial {
                        vec3 diffuseColor;
                        float roughness;
                        vec3 specularColor;
                        float specularF90;
                        #ifdef USE_CLEARCOAT
                          float clearcoat;
                          float clearcoatRoughness;
                          vec3 clearcoatF0;
                          float clearcoatF90;
                        #endif
                        #ifdef USE_SHEEN
                          vec3 sheenColor;
                          float sheenRoughness;
                        #endif
                };
                vec3 clearcoatSpecular = vec3( 0.0 );
                vec3 sheenSpecular = vec3( 0.0 );
                float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness) {
                        float dotNV = saturate( dot( normal, viewDir ) );
                        float r2 = roughness * roughness;
                        float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
                        float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
                        float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
                        return saturate( DG * RECIPROCAL_PI );
                }
                vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
                        float dotNV = saturate( dot( normal, viewDir ) );
                        const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
                        const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
                        vec4 r = roughness * c0 + c1;
                        float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
                        vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
                        return fab;
                }
                vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
                        vec2 fab = DFGApprox( normal, viewDir, roughness );
                        return specularColor * fab.x + specularF90 * fab.y;
                }
                void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
                        vec2 fab = DFGApprox( normal, viewDir, roughness );
                        vec3 FssEss = specularColor * fab.x + specularF90 * fab.y;
                        float Ess = fab.x + fab.y;
                        float Ems = 1.0 - Ess;
                        vec3 Favg = specularColor + ( 1.0 - specularColor ) * 0.047619;   vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
                    singleScatter += FssEss;
                    multiScatter += Fms * Ems;
            }
                #if 0 > 0
                    void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
                          vec3 normal = geometry.normal;
                          vec3 viewDir = geometry.viewDir;
                          vec3 position = geometry.position;
                          vec3 lightPos = rectAreaLight.position;
                          vec3 halfWidth = rectAreaLight.halfWidth;
                          vec3 halfHeight = rectAreaLight.halfHeight;
                          vec3 lightColor = rectAreaLight.color;
                          float roughness = material.roughness;
                          vec3 rectCoords[ 4 ];
                          rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;      rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
                          rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
                          rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
                          vec2 uv = LTC_Uv( normal, viewDir, roughness );
                          vec4 t1 = texture2D( ltc_1, uv );
                          vec4 t2 = texture2D( ltc_2, uv );
                          mat3 mInv = mat3(
                              vec3( t1.x, 0, t1.y ),
                              vec3(    0, 1,    0 ),
                              vec3( t1.z, 0, t1.w )
                          );
                          vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
                          reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
                          reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
                        }
                #endif
                void RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
                        float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
                        vec3 irradiance = dotNL * directLight.color;
                        #ifdef USE_CLEARCOAT
                          float dotNLcc = saturate( dot( geometry.clearcoatNormal, directLight.direction ) );
                          vec3 ccIrradiance = dotNLcc * directLight.color;
                          clearcoatSpecular += ccIrradiance * BRDF_GGX( directLight.direction, geometry.viewDir, geometry.clearcoatNormal, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
                        #endif
                        #ifdef USE_SHEEN
                          sheenSpecular += irradiance * BRDF_Sheen( directLight.direction, geometry.viewDir, geometry.normal, material.sheenColor, material.sheenRoughness );
                        #endif
                        reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometry.viewDir, geometry.normal, material.specularColor, material.specularF90, material.roughness );
                        reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
                }
                void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
                        reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
                }
                void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
                        #ifdef USE_CLEARCOAT
                          clearcoatSpecular += clearcoatRadiance * EnvironmentBRDF( geometry.clearcoatNormal, geometry.viewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
                        #endif
                        #ifdef USE_SHEEN
                          sheenSpecular += irradiance * material.sheenColor * IBLSheenBRDF( geometry.normal, geometry.viewDir, material.sheenRoughness );
                        #endif
                        vec3 singleScattering = vec3( 0.0 );
                        vec3 multiScattering = vec3( 0.0 );
                        vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
                        computeMultiscattering( geometry.normal, geometry.viewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
                        vec3 diffuse = material.diffuseColor * ( 1.0 - ( singleScattering + multiScattering ) );
                        reflectedLight.indirectSpecular += radiance * singleScattering;
                        reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
                        reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
                }
                    #define RE_Direct        RE_Direct_Physical
                    #define RE_Direct_RectArea      RE_Direct_RectArea_Physical
                    #define RE_IndirectDiffuse      RE_IndirectDiffuse_Physical
                    #define RE_IndirectSpecular    RE_IndirectSpecular_Physical
                    float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
                            return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
                    }
                    #ifdef USE_TRANSMISSION
                        uniform float transmission;
                        uniform float thickness;
                        uniform float attenuationDistance;
                        uniform vec3 attenuationColor;
                        #ifdef USE_TRANSMISSIONMAP
                          uniform sampler2D transmissionMap;
                        #endif
                        #ifdef USE_THICKNESSMAP
                          uniform sampler2D thicknessMap;
                        #endif
                        uniform vec2 transmissionSamplerSize;
                        uniform sampler2D transmissionSamplerMap;
                        uniform mat4 modelMatrix;
                        uniform mat4 projectionMatrix;
                        varying vec3 vWorldPosition;
                        vec3 getVolumeTransmissionRay( vec3 n, vec3 v, float thickness, float ior, mat4 modelMatrix ) {
                              vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
                          vec3 modelScale;
                          modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
                          modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
                          modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
                          return normalize( refractionVector ) * thickness * modelScale;
                        }
                        float applyIorToRoughness( float roughness, float ior ) {
                              return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
                            }
                        vec4 getTransmissionSample( vec2 fragCoord, float roughness, float ior ) {
                              float framebufferLod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
                              #ifdef TEXTURE_LOD_EXT
                                  return texture2DLodEXT( transmissionSamplerMap, fragCoord.xy, framebufferLod );
                              #else
                                  return texture2D( transmissionSamplerMap, fragCoord.xy, framebufferLod );
                              #endif
                            }
                        vec3 applyVolumeAttenuation( vec3 radiance, float transmissionDistance, vec3 attenuationColor, float attenuationDistance ) {
                              if ( attenuationDistance == 0.0 ) {
                                  return radiance;
                              } else {
                                  vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
                              vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );        return transmittance * radiance;
                          }
                        }
                        vec4 getIBLVolumeRefraction( vec3 n, vec3 v, float roughness, vec3 diffuseColor, vec3 specularColor, float specularF90,
                              vec3 position, mat4 modelMatrix, mat4 viewMatrix, mat4 projMatrix, float ior, float thickness,
                              vec3 attenuationColor, float attenuationDistance ) {
                              vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
                              vec3 refractedRayExit = position + transmissionRay;
                              vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
                              vec2 refractionCoords = ndcPos.xy / ndcPos.w;
                          refractionCoords += 1.0;
                          refractionCoords /= 2.0;
                          vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
                          vec3 attenuatedColor = applyVolumeAttenuation( transmittedLight.rgb, length( transmissionRay ), attenuationColor, attenuationDistance );
                          vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
                          return vec4( ( 1.0 - F ) * attenuatedColor * diffuseColor, transmittedLight.a );
                        }
                    #endif
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
                                  float softness_probability = variance / (variance + distance * distance );          softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );          occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
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
                    #ifdef USE_CLEARCOATMAP
                        uniform sampler2D clearcoatMap;
                    #endif
                    #ifdef USE_CLEARCOAT_ROUGHNESSMAP
                        uniform sampler2D clearcoatRoughnessMap;
                    #endif
                    #ifdef USE_CLEARCOAT_NORMALMAP
                        uniform sampler2D clearcoatNormalMap;
                        uniform vec2 clearcoatNormalScale;
                    #endif
                    #ifdef USE_ROUGHNESSMAP
                        uniform sampler2D roughnessMap;
                    #endif
                    #ifdef USE_METALNESSMAP
                        uniform sampler2D metalnessMap;
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
                        float roughnessFactor = roughness;
                        #ifdef USE_ROUGHNESSMAP
                            vec4 texelRoughness = texture2D( roughnessMap, vUv );
                            roughnessFactor *= texelRoughness.g;
                        #endif
                        float metalnessFactor = metalness;
                        #ifdef USE_METALNESSMAP
                            vec4 texelMetalness = texture2D( metalnessMap, vUv );
                            metalnessFactor *= texelMetalness.b;
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
                        #ifdef USE_CLEARCOAT
                            vec3 clearcoatNormal = geometryNormal;
                        #endif
                        #ifdef USE_CLEARCOAT_NORMALMAP
                            vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vUv ).xyz * 2.0 - 1.0;
                            clearcoatMapN.xy *= clearcoatNormalScale;
                            #ifdef USE_TANGENT
                              clearcoatNormal = normalize( vTBN * clearcoatMapN );
                            #else
                              clearcoatNormal = perturbNormal2Arb( - vViewPosition, clearcoatNormal, clearcoatMapN, faceDirection );
                            #endif
                        #endif
                        #ifdef USE_EMISSIVEMAP
                            vec4 emissiveColor = texture2D( emissiveMap, vUv );
                            emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;
                            totalEmissiveRadiance *= emissiveColor.rgb;
                        #endif
                        PhysicalMaterial material;
                        material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
                        vec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );
                        float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
                        material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
                        material.roughness = min( material.roughness, 1.0 );
                        #ifdef IOR
                            #ifdef SPECULAR
                              float specularIntensityFactor = specularIntensity;
                              vec3 specularColorFactor = specularColor;
                              #ifdef USE_SPECULARINTENSITYMAP
                                  specularIntensityFactor *= texture2D( specularIntensityMap, vUv ).a;
                              #endif
                              #ifdef USE_SPECULARCOLORMAP
                                  specularColorFactor *= specularColorMapTexelToLinear( texture2D( specularColorMap, vUv ) ).rgb;
                              #endif
                              material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
                            #else
                              float specularIntensityFactor = 1.0;,
                              vec3 specularColorFactor = vec3( 1.0 );
                              material.specularF90 = 1.0;
                            #endif
                            material.specularColor = mix( min( pow2( ( ior - 1.0 ) / ( ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
                        #else
                            material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
                            material.specularF90 = 1.0;
                        #endif
                        #ifdef USE_CLEARCOAT
                            material.clearcoat = clearcoat;
                            material.clearcoatRoughness = clearcoatRoughness;
                            material.clearcoatF0 = vec3( 0.04 );
                            material.clearcoatF90 = 1.0;
                            #ifdef USE_CLEARCOATMAP
                              material.clearcoat *= texture2D( clearcoatMap, vUv ).x;
                            #endif
                            #ifdef USE_CLEARCOAT_ROUGHNESSMAP
                              material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vUv ).y;
                            #endif
                            material.clearcoat = saturate( material.clearcoat );  material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
                            material.clearcoatRoughness += geometryRoughness;
                            material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
                        #endif
                        #ifdef USE_SHEEN
                            material.sheenColor = sheenColor;
                            #ifdef USE_SHEENCOLORMAP
                              material.sheenColor *= sheenColorMapTexelToLinear( texture2D( sheenColorMap, vUv ) ).rgb;
                            #endif
                            material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
                            #ifdef USE_SHEENROUGHNESSMAP
                              material.sheenRoughness *= texture2D( sheenRoughnessMap, vUv ).a;
                            #endif
                        #endif
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
                            vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
                            vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
                        #ifdef USE_TRANSMISSION
                            float transmissionAlpha = 1.0;
                            float transmissionFactor = transmission;
                            float thicknessFactor = thickness;
                            #ifdef USE_TRANSMISSIONMAP
                              transmissionFactor *= texture2D( transmissionMap, vUv ).r;
                            #endif
                            #ifdef USE_THICKNESSMAP
                              thicknessFactor *= texture2D( thicknessMap, vUv ).g;
                            #endif
                            vec3 pos = vWorldPosition;
                            vec3 v = normalize( cameraPosition - pos );
                            vec3 n = inverseTransformDirection( normal, viewMatrix );
                            vec4 transmission = getIBLVolumeRefraction(
                                  n, v, roughnessFactor, material.diffuseColor, material.specularColor, material.specularF90,
                                  pos, modelMatrix, viewMatrix, projectionMatrix, ior, thicknessFactor,
                                  attenuationColor, attenuationDistance );
                            totalDiffuse = mix( totalDiffuse, transmission.rgb, transmissionFactor );
                            transmissionAlpha = mix( transmissionAlpha, transmission.a, transmissionFactor );
                        #endif
                            vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
                            #ifdef USE_SHEEN
                              float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
                              outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecular;
                            #endif
                            #ifdef USE_CLEARCOAT
                              float dotNVcc = saturate( dot( geometry.clearcoatNormal, geometry.viewDir ) );
                              vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
                              outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + clearcoatSpecular * material.clearcoat;
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
                        reflectedLight.directSpecular = irradiance * BRDF_GGX( directLight.direction, geometry.viewDir, geometry.normal, material.specularColor, material.specularF90, material.roughness );
                        
                        float alpha = pow2( roughness );
                        vec3 halfDir = normalize( directLight.direction + geometry.viewDir );
                        float dotNL = saturate( dot( normal, directLight.direction ) );
                        float dotNV = saturate( dot( normal, geometry.viewDir ) );
                        float dotNH = saturate( dot( normal, halfDir ) );
                        float dotVH = saturate( dot( geometry.viewDir, halfDir ) );
                        vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
                        float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
                        float D = D_GGX( alpha, dotNH );
                        float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
                        F = material.specularColor * ( 1.0 - fresnel ) + ( material.specularF90 * fresnel );

                         gl_FragColor.rgb =   ambientLightColor;
                    }`
    }

}
export { ShaderChunk }