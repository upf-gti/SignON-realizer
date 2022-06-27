import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import Stats from './stats.module.js';

import { ShaderChunk } from './shaders.js'
import { SSS_ShaderChunk } from './sss_shaders.js'

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class Player {

    constructor() {
        
        this.clock = new THREE.Clock(false);
        this.loaderGLB = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.spotLight = null;
        this.dirLight = null;
 
        this.model = null;

        this.multiRT = true;
        this.renderTargetDef = null;
        this.renderTargetHblur = null;
        this.renderTargetVblur = null;
        this.renderTargetAcc = null;

        this.postScene = null;
        this.postCamera = null;

        this.deferredLightingMaterial = null;
        this.hBlurMaterial = null;
        this.accMaterial = null;

        this.stats = new Stats();
        document.body.appendChild( this.stats.dom )
    }
    
    init() {

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0x252525 );
        // this.scene.fog = new THREE.Fog( 0x2A2928, 100, 150 );
        
        // let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshPhongMaterial( { color: 0x151414, depthWrite: false } ) );
        // ground.position.y = 0; // it is moved because of the mesh scale
        // ground.rotation.x = -Math.PI / 2;
        // ground.receiveShadow = true;
        // this.scene.add( ground );
        
        // let spotLight = new THREE.SpotLight( 0xffa95c, 1 );
        // spotLight.position.set( -50, 50, 50);
        // spotLight.castShadow = true;
        // spotLight.shadow.bias = -0.00001;
        // spotLight.shadow.mapSize.width = 1024 * 8;
        // spotLight.shadow.mapSize.height = 1024 * 8;
        // this.scene.add( spotLight );
        // this.spotLight = spotLight;

        // PostProcessing setup

        this.postScene = new THREE.Scene();
        this.postCamera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

        this.dirLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        this.dirLight.position.set( 3, 10, 50 );
        this.dirLight.castShadow = false;
        this.scene.add( this.dirLight );

        let pointLight = new THREE.PointLight( 0xffa95c, 1 );
        pointLight.position.set( 0, 2.5, 8);
        pointLight.castShadow = true;
        pointLight.shadow.bias = -0.00001;
        pointLight.shadow.mapSize.width = 1024 * 8;
        pointLight.shadow.mapSize.height = 1024 * 8;
        this.postScene.add( pointLight );
        this.pointLight = pointLight;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.7;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild( this.renderer.domElement );

        // Camera
        let AR =  window.innerWidth/window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, AR, 0.01, 1000);
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.object.position.set(0.0, 3.4, 8);
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 50;
        this.controls.target.set(0.0, 2.6, 0);

        // Load the model
        this.loaderGLB.load( './data/models/Eva_Y.glb', (glb) => {

            this.model = glb.scene;
            this.model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            this.model.position.set(0, -8.0, 0);
            this.model.scale.set(8.0, 8.0, 8.0);
            this.model.castShadow = true;
            
            this.model.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    if (object.name == "Eyelashes") {
                        object.material.side = THREE.DoubleSide;
                        object.castShadow = false;
                    }
                    if(object.material.map) object.material.map.anisotropy = 16; 
                    
                } else if (object.isBone) {
                    object.scale.set(1.0, 1.0, 1.0);
                }
            } );

            this.prepareRenderTargets();
            
            const sss_texture = this.loadTexture( './data/textures/woman_body_sss.png' );
            const color_texture = this.loadTexture( './data/textures/Woman_Body_Diffuse.png' );
            const specular_texture = this.loadTexture( './data/textures/Woman_Body_Specular.png' );
            // const transmitance_lut_texture = this.loadTexture( './data/textures/transmitance_lut.png' );
            // const specular_lut_texture = this.loadTexture( './data/textures/beckmann_lut.png' );

            let mat = this.model.getObjectByName("Body").material.clone();

            const uniforms = Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), {
                map:  { type: 't', value: color_texture },
                normalMap:  { type: "t", value: mat.normalMap },
                specularMap:  { type: "t", specular_texture },
                sssMap:  { value: sss_texture },
                uvTransform: { type: "matrix4", value: mat.map.matrix }
            } );

            const gBufferConfig = {
                uniforms: uniforms,
                vertexShader: ShaderChunk.getVertexShader(),
                fragmentShader: SSS_ShaderChunk.deferredFS(),
                lights: true,
                colorWrite: true,
                glslVersion: THREE.GLSL3,
                defines: this.multiRT ? { MULTI_RT: 1 } : {}
            };

            let gBufferMaterial = new THREE.ShaderMaterial( gBufferConfig );
            let gBufferTransparentMaterial =  new THREE.ShaderMaterial( Object.assign( gBufferConfig, { 
                transparent: true, 
                depthWrite: false, 
                blending: THREE.NormalBlending,
                side: THREE.DoubleSide,
                defines: { SKIP_NORMALS: 1 }
            } ));

            gBufferMaterial.extensions.drawBuffers = true;
            gBufferMaterial.extensions.derivatives = true;
            
            gBufferTransparentMaterial.extensions.drawBuffers = true;
            gBufferTransparentMaterial.extensions.derivatives = true;
            
            this.model.receiveShadow = true;
            this.scene.add(this.model);

            for( const obj of this.scene.getObjectByName("Armature").children ) {
                if(!obj.material)
                continue; 
                
                if(obj.material.name.includes( "Bodymat" ))
                    obj.material = obj.name === "Eyelashes" ? gBufferTransparentMaterial : gBufferMaterial;
                else {
                    obj.material = new THREE.ShaderMaterial( {
                        uniforms: Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), {
                            map:  { type: 't', value: obj.material.map },
                            normalMap:  { type: "t", value: obj.material.map.normalMap },
                            uvTransform: { type: "matrix4", value: obj.material.map.matrix }
                        } ),
                        vertexShader: ShaderChunk.getVertexShader(),
                        fragmentShader: SSS_ShaderChunk.deferredFS(),
                        lights: true,
                        colorWrite: true,
                        glslVersion: THREE.GLSL3,
                        defines: this.multiRT ? { MULTI_RT: 1 } : {}
                    } );
                }
            }

            // Create POST FX Materials

            this.deferredLightingMaterial = new THREE.ShaderMaterial( {
                vertexShader: ShaderChunk.vertexShaderQuad(),
                fragmentShader: SSS_ShaderChunk.deferredFinalFS(true),
                uniforms: {
                    lightProbe: { value : [] },
                    directionalLights: { value : []} ,
                    directionalLightShadows : { value : []} ,
                    spotLights : { value : []} ,
                    spotLightShadows: { value : [] },
                    rectAreaLights: { value : [] },
                    ltc_1: { value : [] },
                    ltc_2: { value : [] },
                    pointLights: { value : [] },
                    pointLightShadows: { value : [] },
                    hemisphereLights: { value : [] },
                    directionalShadowMap: { value : [] },
                    directionalShadowMatrix: { value : [] },
                    spotShadowMap: { value : [] },
                    spotShadowMatrix: { value : [] },
                    pointShadowMap: { value : [] },
                    pointShadowMatrix: { value : [] },
                    map: { type: "t", value: this.renderTargetDef.texture[ 0 ] },
                    positionMap: { value: this.renderTargetDef.texture[ 1 ] },
                    normalMap: { value: this.renderTargetDef.texture[ 2 ] },
                    detailed_normal_texture: { value: this.renderTargetDef.texture[ 3 ] },
                    depth_texture: { value: this.renderTargetDef.depthTexture },
                    u_specularIntensity: { type: "number", value: 0.4852941176470588 },
                    u_ambientIntensity: { type: "number", value: 0.4852941176470588 },
                    u_shadowShrinking: { type: "number", value: 0.1 },
                    u_translucencyScale: { type: "number", value: 1100 },
                    ambientLightColor:  {type: "vec3", value: new THREE.Vector3(256.0,256.0,256.0)},
                    camera_near: { value : this.camera.near},
                    camera_far: { value : this.camera.far},
                    camera_eye: {value: this.camera.position}
                },
                // blending: THREE.CustomBlending,
                // blendSrc: THREE.OneFactor,
                depthTest: false,
                lights: true,
                glslVersion: THREE.GLSL3
            });

            let quad = new THREE.Mesh(
                new THREE.PlaneGeometry( 2,2 ),
                this.deferredLightingMaterial
            );

            quad.name = "quad";
            this.postScene.add( quad );
            this.quad = quad;

            this.hBlurMaterial = new THREE.ShaderMaterial( {
                vertexShader: ShaderChunk.vertexShaderQuad(),
                fragmentShader: SSS_ShaderChunk.horizontalBlurFS(),
                uniforms: {
                    irradiance_texture: { value: this.renderTargetLights.texture[ 0 ] },
                    depth_aux_texture: { value: this.renderTargetLights.texture[ 2 ] },
                    u_sssLevel: { value: 200 },
                    u_correction: { value: 800 },
                    u_maxdd: { value: 0.001 },
                    u_invPixelSize: { value: [1/this.renderTargetLights.texture[ 0 ].image.width, 1/this.renderTargetLights.texture[ 0 ].image.height] },
                    u_width: { value: 0.0 },
                    camera_near: { value : this.camera.near },
                    camera_far: { value : this.camera.far },
                
                },
                depthTest: false,
                blending: THREE.NoBlending,
                glslVersion: THREE.GLSL3
            });

            this.vBlurMaterial = new THREE.ShaderMaterial( {
                vertexShader: ShaderChunk.vertexShaderQuad(),
                fragmentShader: SSS_ShaderChunk.verticalBlurFS(),
                uniforms: {
                    irradiance_texture: { value: this.renderTargetHblur.texture[ 0 ] },
                    depth_aux_texture: { value: this.renderTargetLights.texture[ 2 ] },
                    u_sssLevel: { value: 200 },
                    u_correction: { value: 800 },
                    u_maxdd: { value: 0.001 },
                    u_invPixelSize: { value: [1/this.renderTargetLights.texture[ 0 ].image.width, 1 / this.renderTargetLights.texture[ 0 ].image.height] },
                    u_width: { value: 0.0 },
                    camera_near: { value : this.camera.near },
                    camera_far: { value : this.camera.far },
                },
                depthTest: false,
                blending: THREE.NoBlending,
                glslVersion: THREE.GLSL3
            });

            this.accMaterial = new THREE.ShaderMaterial( {
                vertexShader: ShaderChunk.vertexShaderQuad(),
                fragmentShader: SSS_ShaderChunk.accumulativeFS(),
                uniforms: {
                    u_color_texture: { value: this.renderTargetLights.texture[ 0 ] },
                    u_depth_aux_tex: { value: this.renderTargetLights.texture[ 2 ] },
                    u_weight: { value: new THREE.Vector3(1,1,1) },
                },
                depthTest: false,
                blending: THREE.CustomBlending,
                blendDst: THREE.OneFactor,
                glslVersion: THREE.GLSL3
            });

            this.gammaMaterial = new THREE.ShaderMaterial( {
                vertexShader: ShaderChunk.vertexShaderQuad(),
                fragmentShader: SSS_ShaderChunk.finalGammaFS(),
                uniforms: {
                    u_texture: { value:  this.renderTargetAcc.texture[ 0 ] },
                },
                depthTest: false,
                blending: THREE.NoBlending,
                glslVersion: THREE.GLSL3
            });

            $('#loading').fadeOut();
            this.clock.start();
            this.animate();
        } );
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
    }
    
    animate() {
        
        requestAnimationFrame( this.animate.bind(this) );

        this.render();
        this.controls.update();
        this.stats.update();
    }

    render() {

        this.renderer.clear();
        if( this.multiRT ) {
            // Fill GBuffers
            this.renderer.setRenderTarget( this.renderTargetDef );
        }
        this.renderer.clear();
        this.renderer.render( this.scene, this.camera );
        
        if( !this.multiRT ) 
        return;
        
        // Lights
        this.applyDeferred();
        return;
        
        // SSS
        const V = [0.0064, 0.0516, 0.2719, 2.0062];
        const RGB = [new THREE.Vector3(0.2405, 0.4474, 0.6157), new THREE.Vector3(0.1158, 0.3661, 0.3439), new THREE.Vector3(0.1836, 0.1864, 0.0), new THREE.Vector3(0.46, 0.0, 0.0402)];
        let pv = 0;
        let irrad_sss_texture = this.renderTargetLights.texture[ 0 ];
        let depth_aux_texture = this.renderTargetLights.texture[ 2 ];
        
        this.setRenderTarget( this.renderTargetAcc );
        this.renderer.clearColor();
        this.setRenderTarget( this.renderTargetHblur );
        this.renderer.clearColor();
        this.setRenderTarget( this.renderTargetVblur );
        this.renderer.clearColor();

        this.renderer.autoClear = false;

        for(let i = 0; i < 4; i++) {
            
            // Blur steps
            var width = Math.sqrt(V[i]-pv);
            pv = V[i];

            //---- Horizontal
            this.horizontalStep(irrad_sss_texture, depth_aux_texture, width); //fills renderTargetHblur
            
            //---- Vertical
            this.verticalStep(this.renderTargetHblur.texture[0], depth_aux_texture, width); //fills renderTargetVblur

            //Accumulative
            this.accStep(this.renderTargetVblur.texture[0], depth_aux_texture, RGB[i], THREE.SrcAlphaFactor)
        }

        //Accumulative
        this.accStep(this.renderTargetLights.texture[ 0 ], depth_aux_texture, new THREE.Vector3(1.0,1.0,1.0), THREE.OneMinusSrcAlphaFactor); ////fills renderTargetAcc
        this.accStep(this.renderTargetLights.texture[ 1 ], depth_aux_texture, new THREE.Vector3(1.0,1.0,1.0), THREE.OneFactor); ////fills renderTargetAcc
        this.renderer.clearColor(); 
        
        //Final FX
        this.quad.material = this.gammaMaterial;
        this.quad.material.needsUpdate = true;
        this.quad.material.uniforms.u_texture.value = this.renderTargetAcc.texture[ 0 ];

        this.toScreen()
        this.renderer.clearColor();
        this.renderer.render( this.postScene, this.postCamera );
    }

    applyDeferred(){

        this.quad.material = this.deferredLightingMaterial;
        this.toScreen(); //this.setRenderTarget( this.renderTargetLights );
        this.renderer.render( this.postScene, this.postCamera );
    }

    horizontalStep(irrad_sss_texture, depth_aux_texture, width){

        this.quad.material = this.hBlurMaterial;
        this.quad.material.uniforms.u_width.value = width;
        this.quad.material.uniforms.irradiance_texture.value = irrad_sss_texture;
        this.quad.material.uniforms.depth_aux_texture.value = depth_aux_texture;

        this.setRenderTarget( this.renderTargetHblur );
        this.renderer.render( this.postScene, this.postCamera );
    }

    verticalStep(irrad_sss_texture, depth_aux_texture, width){
        
        this.quad.material = this.vBlurMaterial;
        this.quad.material.uniforms.u_width.value = width;
        this.quad.material.uniforms.irradiance_texture.value = irrad_sss_texture;
        this.quad.material.uniforms.depth_aux_texture.value = depth_aux_texture;

        this.setRenderTarget( this.renderTargetVblur );
        this.renderer.render( this.postScene, this.postCamera );
    }

    accStep(color_texture, depth_aux_tex, weight, srcBlend){
        
        this.accMaterial.blendSrc = srcBlend;
        this.quad.material = this.accMaterial;
        this.quad.material.uniforms.u_color_texture = color_texture;
        this.quad.material.uniforms.u_depth_aux_tex = depth_aux_tex;
        this.quad.material.uniforms.u_weight.value = weight;
        
        this.setRenderTarget( this.renderTargetAcc );
        this.renderer.render( this.postScene, this.postCamera );
    }

    prepareRenderTargets() {

        // Deferred: First pass
        this.renderTargetDef = new THREE.WebGLMultipleRenderTargets(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio,
            4
        );

        for ( let i = 0, il = this.renderTargetDef.texture.length; i < il; i ++ ) {
            this.renderTargetDef.texture[ i ].minFilter = THREE.NearestFilter;
            this.renderTargetDef.texture[ i ].magFilter = THREE.NearestFilter;
            this.renderTargetDef.texture[ i ].type = THREE.FloatType;
        }

        this.renderTargetDef.texture[ 0 ].name = 'pc_fragColor0';
        this.renderTargetDef.texture[ 1 ].name = 'pc_fragColor1';
        this.renderTargetDef.texture[ 2 ].name = 'pc_fragColor2';
        this.renderTargetDef.texture[ 3 ].name = 'pc_fragColor3';

        // Deferred: Light pass
        this.renderTargetLights = new THREE.WebGLMultipleRenderTargets(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio,
            3
        );

        for ( let i = 0, il = this.renderTargetLights.texture.length; i < il; i ++ ) {

            this.renderTargetLights.texture[ i ].minFilter = THREE.NearestFilter;
            this.renderTargetLights.texture[ i ].magFilter = THREE.NearestFilter;
            this.renderTargetLights.texture[ i ].type = THREE.FloatType;
        }

        this.renderTargetLights.texture[ 0 ].name = 'pc_fragLight';
        this.renderTargetLights.texture[ 1 ].name = 'pc_fragTransmitance';
        this.renderTargetLights.texture[ 2 ].name = 'pc_fragDepth';

        // Blur passes: Horizontal

        this.renderTargetHblur = new THREE.WebGLMultipleRenderTargets(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio,
            1
        );

        for ( let i = 0, il = this.renderTargetHblur.texture.length; i < il; i ++ ) {

            this.renderTargetHblur.texture[ i ].minFilter = THREE.NearestFilter;
            this.renderTargetHblur.texture[ i ].magFilter = THREE.NearestFilter;
            this.renderTargetHblur.texture[ i ].type = THREE.FloatType;
        }

        this.renderTargetHblur.texture[ 0 ].name = 'pc_fragDataH';

        // Blur passes: Vertical

        this.renderTargetVblur = new THREE.WebGLMultipleRenderTargets(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio,
            1
        );

        for ( let i = 0, il = this.renderTargetVblur.texture.length; i < il; i ++ ) {

            this.renderTargetVblur.texture[ i ].minFilter = THREE.NearestFilter;
            this.renderTargetVblur.texture[ i ].magFilter = THREE.NearestFilter;
            this.renderTargetVblur.texture[ i ].type = THREE.FloatType;
        }

        this.renderTargetVblur.texture[ 0 ].name = 'pc_fragDataV';

        // SSS: Accumulate passes

        this.renderTargetAcc = new THREE.WebGLMultipleRenderTargets(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio,
            1
        );

        for ( let i = 0, il = this.renderTargetAcc.texture.length; i < il; i ++ ) {

            this.renderTargetAcc.texture[ i ].minFilter = THREE.NearestFilter;
            this.renderTargetAcc.texture[ i ].magFilter = THREE.NearestFilter;
            this.renderTargetAcc.texture[ i ].type = THREE.FloatType;
        }

        this.renderTargetAcc.texture[ 0 ].name = 'pc_finalColor';
    }

    loadTexture( path, onload) {
        const texture = this.textureLoader.load( path, onload );
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false;
        return texture;
    }

    setRenderTarget( rt ) {
        this.renderer.setRenderTarget( rt );
    }

    toScreen() {
        this.renderer.setRenderTarget( null );
    }

    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

}

let player = new Player();
player.init();
window.player = player;

export { Player };
