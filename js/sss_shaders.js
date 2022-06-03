import * as THREE from 'three'

const SSS_ShaderChunk = {

    deferredFS(){

        return [`
       
        precision mediump float;
        #define varying in
        layout(location = 0) out highp vec4 pc_fragColor0;
        layout(location = 1) out highp vec4 pc_fragColor1;
        layout(location = 2) out highp vec4 pc_fragColor2;
        //#define gl_FragColor pc_fragColor
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
        #define texture2D texture
        #define HIGH_PRECISION
        #define STANDARD 
        #define USE_MAP
        #define USE_NORMALMAP
        #define TANGENTSPACE_NORMALMAP
        #define USE_ROUGHNESSMAP
        #define USE_METALNESSMAP
        #define USE_UV
        #define USE_SHADOWMAP
        #define SHADOWMAP_TYPE_PCF

        precision highp float;
        precision highp int;
        
        `,
        THREE.ShaderChunk.common,
        THREE.ShaderChunk.packing,
        THREE.ShaderChunk.uv_pars_fragment,
        
        `
        //varyings
        varying vec3 vNormal;
        varying vec3 vViewPosition;


        // varying vec3 v_pos; //vViewPosition
        // varying vec3 v_normal; //vNormal
        // varying vec2 v_uvs; //vUv
        //lights
        `,

        THREE.ShaderChunk.lights_pars_begin,
        THREE.ShaderChunk.shadowmap_pars_fragment,
        `
        //globals
        uniform vec2 normalScale;

        uniform vec4 u_clipping_plane;
        uniform float u_time;
        uniform vec3 u_background_color;
        //uniform vec3 u_ambient_light;// ambientLightColor

        uniform vec3 u_camera_eye;

        //material
        uniform sampler2D map;
        uniform sampler2D normalMap;
        uniform sampler2D u_opacity_texture;
        uniform sampler2D u_sss_texture;
        uniform sampler2D u_noise_texture;

        uniform vec4 u_material_color; //color and alpha
        // uniform sampler2D u_color_texture; //map
        // uniform sampler2D u_normal_texture; //normalMap

        mat3 cotangent_frame(vec3 N, vec3 p, vec2 uv){
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
        vec4 mapTexelToLinear( vec4 value ) { return LinearToLinear( value ); }    

        void main() {
            vec3 normal = vNormal;
            `,
            THREE.ShaderChunk.lights_fragment_begin,
            THREE.ShaderChunk.lights_fragment_end,
            `
            float t = texture2D(u_opacity_texture, vUv).x;
            float n = 0.6;//texture2D(u_noise_texture, 0.1*(vec2(0.5)*gl_FragCoord.xy + vec2(0.5))).x;
            //if(n > t) discard;

            vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
            mapN.xy *= normalScale;
            vec3 N = normalize( vNormal );
            float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
            vec3 detailedN  = perturbNormal2Arb( - vViewPosition, N, mapN, faceDirection );
            
            
            pc_fragColor0 = vec4(mapTexelToLinear(texture2D( map, vUv)).rgb, texture2D( u_sss_texture, vUv ).r);

            pc_fragColor1 = vec4(N*0.5 + vec3(0.5),1.0);
            pc_fragColor2 = vec4(detailedN*0.5 + vec3(0.5), 1.0);
        }
        `].join("\n");
    }
}
export { SSS_ShaderChunk }