import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import Stats from './libs/stats.module.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.16/+esm';


import { ShaderChunk } from './shaders.js'
import { SSS_ShaderChunk } from './sss_shaders.js'

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

const TextureChunk = {
    
    get( matWType ) {
        return "data/textures/" + this[ matWType ];
    },

    'Hairmat.004@opacity': 'Woman_Hair_Opacity.png'
}

const V = [0.0064, 0.0516, 0.2719, 2.0062];
const RGB = [
        new THREE.Vector3(0.2405, 0.4474, 0.6157), 
        new THREE.Vector3(0.1158, 0.3661, 0.3439), 
        new THREE.Vector3(0.1836, 0.1864, 0.0), 
        new THREE.Vector3(0.46, 0.0, 0.0402)
];

class Player {

    constructor() {
        
        this.gui = new GUI();
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
        this.scene.background = new THREE.Color( 0xffffff );

        // PostProcessing setup

        this.postScene = new THREE.Scene();
        this.postCamera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

        let pointLight = new THREE.PointLight( 0x5600ff, 1 );
        pointLight.position.set( 8, 2.5, 8);
        pointLight.castShadow = true;
        this.pointLight = pointLight;
        this.pointLightForward = this.pointLight.clone();
        // this.scene.add( this.pointLightForward );
        // this.postScene.add( this.pointLight );

        let spotLight = new THREE.SpotLight( 0xffa95c, 1 );
        spotLight.position.set( -15, 15, 15);
        spotLight.castShadow = true;
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.1;
        spotLight.decay = 2;
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;
        spotLight.shadow.camera.near = 0.1;
        spotLight.shadow.camera.far = 10000;
        spotLight.shadow.focus = 1;
        this.spotLight = spotLight;
        this.spotLightForward = this.spotLight.clone();
        this.scene.add( this.spotLightForward );
        this.postScene.add( this.spotLight );
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
       
        this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild( this.renderer.domElement );

        // Camera
        let AR =  window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, AR, 0.1, 1000);
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
            this.spotLight.target = this.model;
            
            this.model.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    if (object.name == "Eyelashes" || object.name == "Hair") {
                        object.material.side = THREE.DoubleSide;
                        object.castShadow = false;
                    }
                    if(object.material.map) object.material.map.anisotropy = 16; 
                    
                } else if (object.isBone) {
                    object.scale.set(1.0, 1.0, 1.0);
                }
            } );

            this.prepareRenderTargets();

            // Store useful textures
            this.black_texture = this.loadTexture( './data/textures/black.png' );

            const specular_texture = this.loadTexture( './data/textures/Woman_Body_Specular.png' );
            const sss_texture = this.loadTexture( './data/textures/woman_body_sss.png' );
            // const transmitance_lut_texture = this.loadTexture( './data/textures/transmitance_lut.png' );
            // const specular_lut_texture = this.loadTexture( './data/textures/beckmann_lut.png' );

            let mat = this.model.getObjectByName("Body").material.clone();

            const uniforms = Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), {
                map:  { type: 't', value: mat.map },
                normalMap:  { type: "t", value: mat.normalMap },
                specularMap:  { type: "t", value: specular_texture },
                sssMap:  { value: sss_texture },
                uvTransform: { type: "matrix4", value: mat.map.matrix }
            } );

            const gBufferConfig = {
                name: "gBuffer",
                uniforms: uniforms,
                vertexShader: ShaderChunk.getVertexShader(),
                fragmentShader: SSS_ShaderChunk.deferredFS(),
                lights: true,
                colorWrite: true,
                glslVersion: THREE.GLSL3
            };

            let gBufferMaterial = new THREE.ShaderMaterial( gBufferConfig );
            let gBufferTransparentMaterial =  new THREE.ShaderMaterial( Object.assign( gBufferConfig, { 
                name: "gBufferTransparent",
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
            this.model.name = "Model";
            this.scene.add(this.model);

            for( const obj of this.scene.getObjectByName("Armature").children ) {
                if(!obj.material)
                continue; 
                
                if(obj.material.name.includes( "Bodymat" ))
                    obj.material = obj.name === "Eyelashes" ? gBufferTransparentMaterial : gBufferMaterial;
                else {
                    obj.material = this.createGBufferMaterialFromSrc( obj.material );
                }
            }

            // Create POST FX Materials

            this.deferredLightingMaterial = new THREE.ShaderMaterial( {
                name: "deferredLighting",
                vertexShader: ShaderChunk.vertexShaderQuad(),
                fragmentShader: SSS_ShaderChunk.deferredFinalFS(true),
                uniforms: Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), {
                    map: { type: "t", value: this.renderTargetDef.texture[ 0 ] },
                    positionMap: { value: this.renderTargetDef.texture[ 1 ] },
                    normalMap: { value: this.renderTargetDef.texture[ 2 ] },
                    depthMap: { value: this.renderTargetDef.depthTexture },
                    shadowMap: { value: null },
                    detailed_normal_texture: { value: this.renderTargetDef.texture[ 3 ] },
                    specularIntensity: { type: "number", value: 0.5 },
                    ambientIntensity: { type: "number", value: 0.5 },
                    shadowShrinking: { type: "number", value: 0.1 },
                    translucencyScale: { type: "number", value: 1100 },
                    ambientLightColor:  {type: "vec3", value: new THREE.Vector3(256.0,256.0,256.0) },
                    cameraNear: { value : this.camera.near },
                    cameraFar: { value : this.camera.far },
                    cameraEye: { value : this.camera.position }
                } ),
                depthTest: false,
                lights: true,
                glslVersion: THREE.GLSL3
            });

            let quad = new THREE.Mesh(
                new THREE.PlaneGeometry( 2,2 ),
                this.deferredLightingMaterial
            );

            quad.name = "quad";
            quad.receiveShadow = true;
            this.postScene.add( quad );
            this.quad = quad;

            this.hBlurMaterial = new THREE.ShaderMaterial( {
                vertexShader: ShaderChunk.vertexShaderQuad(),
                fragmentShader: SSS_ShaderChunk.horizontalBlurFS(),
                uniforms: {
                    irradianceMap: { value: this.renderTargetLights.texture[ 0 ] },
                    depthMap: { value: this.renderTargetLights.texture[ 2 ] },
                    sssLevel: { value: 200 },
                    correction: { value: 800 },
                    maxdd: { value: 0.001 },
                    invPixelSize: { value: [1/this.renderTargetLights.texture[ 0 ].image.width, 1/this.renderTargetLights.texture[ 0 ].image.height] },
                    width: { value: 0.0 },
                    cameraNear: { value : this.camera.near },
                    cameraFar: { value : this.camera.far }
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

        this.createUI();

        this.textureScene = new THREE.Scene();
        this.textureScene.add( new THREE.Mesh(
            new THREE.PlaneGeometry( 2,2 ),
            new THREE.MeshBasicMaterial({
                map: this.black_texture
            })
        ) );
    }

    textureToViewport( texture ) {

        this.showTexture = !this.showTexture;
        this.textureScene.children[ 0 ].material.map = texture;
    }

    animate() {
        
        requestAnimationFrame( this.animate.bind(this) );

        this.render();
        this.controls.update();
        this.stats.update();
    }

    render() {

        if( this.showTexture ) {
            this.toScreen();
            this.renderer.render( this.textureScene, this.postCamera );
            return;
        }

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

        for(let i = 0; i < 1; i++) {
            
            // Blur steps
            var width = Math.sqrt(V[i] - pv);
            pv = V[i];

            //---- Horizontal
            this.horizontalStep( width );
            
            //---- Vertical
            // this.verticalStep(this.renderTargetHblur.texture[0], depth_aux_texture, width);

            //Accumulative
            // this.accStep(this.renderTargetVblur.texture[0], depth_aux_texture, RGB[i], THREE.SrcAlphaFactor)
        }

        //Accumulative
        // this.accStep(this.renderTargetLights.texture[ 0 ], depth_aux_texture, new THREE.Vector3(1.0,1.0,1.0), THREE.OneMinusSrcAlphaFactor);
        // this.accStep(this.renderTargetLights.texture[ 1 ], depth_aux_texture, new THREE.Vector3(1.0,1.0,1.0), THREE.OneFactor);
        // this.renderer.clearColor(); 
        
        //Final FX
        this.quad.material = this.gammaMaterial;
        this.quad.material.needsUpdate = true;
        this.quad.material.uniforms.u_texture.value = this.renderTargetHblur.texture[ 0 ];

        this.toScreen()
        // this.renderer.clearColor();
        this.renderer.render( this.postScene, this.postCamera );
    }

    applyDeferred(){

        this.quad.material = this.deferredLightingMaterial;
        // this.setRenderTarget( this.renderTargetLights );
        this.toScreen();
        this.renderer.render( this.postScene, this.postCamera );
    }

    horizontalStep( width ) {
        this.quad.material = this.hBlurMaterial;
        this.quad.material.uniforms.width.value = width;
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

        this.renderTargetDef.depthTexture = new THREE.DepthTexture(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio,
            THREE.FloatType
        );

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

    createUI() {

        const gui = this.gui;
        gui.title("Scene")

        const pointLight = {
            pointLightX: this.pointLight.position.x,
            pointLightY: this.pointLight.position.y,
            pointLightZ: this.pointLight.position.z,
            pointColor: this.pointLight.color,
            pointIntensity: this.pointLight.intensity
        };
        
        const pointFolder = gui.addFolder( 'Point Light' );
        pointFolder.close();

        pointFolder.add( pointLight, 'pointLightX', -50, 50).name( 'X' ).onChange( v => {
            this.pointLight.position.set( v, this.pointLight.position.y, this.pointLight.position.z );
            this.pointLightForward.position.set( v, this.pointLightForward.position.y, this.pointLightForward.position.z );
        } );
        pointFolder.add( pointLight, 'pointLightY', -50, 50 ).name( 'Y' ).onChange( v => {
            this.pointLight.position.set( this.pointLight.position.x, v, this.pointLight.position.z );
            this.pointLightForward.position.set( this.pointLightForward.position.x, v, this.pointLightForward.position.z );
        } );
        pointFolder.add( pointLight, 'pointLightZ', -50, 50 ).name( 'Z' ).onChange( v => {
            this.pointLight.position.set( this.pointLight.position.x, this.pointLight.position.y, v );
            this.pointLightForward.position.set( this.pointLightForward.position.x, this.pointLightForward.position.y, v );
        } );

        pointFolder.addColor( pointLight, 'pointColor' ).name( 'Color' );
        pointFolder.add( pointLight, 'pointIntensity', 0, 10 ).name( 'Intensity' ).onChange( v => {
            this.pointLight.intensity = v;
            this.pointLightForward.intensity = v;
        } );

        const spotLight = {
            spotLightX: this.spotLight.position.x,
            spotLightY: this.spotLight.position.y,
            spotLightZ: this.spotLight.position.z,
            spotColor: this.spotLight.color,
            spotIntensity: this.spotLight.intensity
        };
        
        const spotFolder = gui.addFolder( 'Spot Light' );
        spotFolder.close();

        spotFolder.add( spotLight, 'spotLightX', -50, 50).name( 'X' ).onChange( v => {
            this.spotLight.position.set( v, this.spotLight.position.y, this.spotLight.position.z );
            this.spotLightForward.position.set( v, this.spotLightForward.position.y, this.spotLightForward.position.z );
        } );
        spotFolder.add( spotLight, 'spotLightY', -50, 50 ).name( 'Y' ).onChange( v => {
            this.spotLight.position.set( this.spotLight.position.x, v, this.spotLight.position.z );
            this.spotLightForward.position.set( this.spotLightForward.position.x, v, this.spotLightForward.position.z );
        } );
        spotFolder.add( spotLight, 'spotLightZ', -50, 50 ).name( 'Z' ).onChange( v => {
            this.spotLight.position.set( this.spotLight.position.x, this.spotLight.position.y, v );
            this.spotLightForward.position.set( this.spotLightForward.position.x, this.spotLightForward.position.y, v );
        } );

        spotFolder.addColor( spotLight, 'spotColor' ).name( 'Color' );
        spotFolder.add( spotLight, 'spotIntensity', 0, 10 ).name( 'Intensity' ).onChange( v => {
            this.spotLight.intensity = v;
            this.spotLightForward.intensity = v;
        } );
    }

    createGBufferMaterialFromSrc( mat ) {

        const materialConfig = {
            uniforms: Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), {
                map:  { type: 't', value: mat.map },
                normalMap:  { type: "t", value: mat.normalMap },
                sssMap: { type: 't', value: this.black_texture },
                specularMap: { type: 't', value: mat.metalnessMap },
                uvTransform: { type: "matrix4", value: mat.map.matrix }
            } ),
            vertexShader: ShaderChunk.getVertexShader(),
            fragmentShader: SSS_ShaderChunk.deferredFS(),
            lights: true,
            colorWrite: true,
            glslVersion: THREE.GLSL3,
            side: mat.side,
            // transparent: mat.transparent,
            defines: {}
        };

        if(materialConfig.transparent) {
            // const textureName = TextureChunk.get( mat.name + "@opacity" );
            // materialConfig.uniforms[ "alphaMap" ] = { type: 't', value: this.loadTexture( textureName ) };
            // materialConfig.defines[ 'ALPHA_TEST' ] = 1;
        }

        return new THREE.ShaderMaterial( materialConfig );
    }

    loadTexture( path, flip, onload ) {
        const texture = this.textureLoader.load( path, onload );
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = flip;
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
