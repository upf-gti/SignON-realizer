import * as THREE from 'three';
import Stats from './libs/stats.module.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.16/+esm';

import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { ShadowMapViewer } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/utils/ShadowMapViewer.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { DisplayUI } from './ui.js'
import { ShaderManager } from './shaderManager.js'
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

const Vector3One = new THREE.Vector3( 1.0, 1.0, 1.0 );
const V = [ 0.0064, 0.0516, 0.2719, 2.0062 ];
const RGB = [
        new THREE.Vector3( 0.2405, 0.4474, 0.6157 ), 
        new THREE.Vector3( 0.1158, 0.3661, 0.3439 ), 
        new THREE.Vector3( 0.1836, 0.1864, 0.0 ), 
        new THREE.Vector3( 0.46, 0.0, 0.0402 )
];

let SM = null;

class Player {

    constructor() {
        
        this.gui                = new GUI();
        this.loaderGLB          = new GLTFLoader();
        this.shaderManager      = new ShaderManager("data/shaders/");
        this.clock              = new THREE.Clock(false);
        this.textureLoader      = new THREE.TextureLoader();

        this.debugShadowmaps    = false;

        // Shorter access
        SM = this.shaderManager;
    }
    
    async init() {

        this.initScene();
        this.initLights();
        this.initMisc();

        await SM.loadFromFile( "shaderChunk.a.glsl" );

        // Load the model

        this.loaderGLB.load( './data/models/Eva_Y.glb', (glb) => {

            this.model = glb.scene;
            this.model.rotateOnAxis( new THREE.Vector3(1, 0, 0), -Math.PI / 2 );
            this.model.position.set(0, -8, 0);
            this.model.scale.set(8, 8, 8);
            this.model.castShadow = true;
            this.spotLight.target = this.model;
            
            this.model.traverse( object => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = object.receiveShadow = true;
                    if (object.name == "Eyelashes" || object.name == "Hair") {
                        object.material.side = THREE.DoubleSide;
                        object.castShadow = false;
                    }
                    if(object.material.map) object.material.map.anisotropy = 16; 
                    
                } else if (object.isBone) object.scale.set(1.0, 1.0, 1.0);
            } );

            this.prepareMaterials.bind(this)();

            this.initUI();

            $('#loading').fadeOut();
            this.clock.start();
            this.animate();
        } );
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
    }

    initScene() {

        // Scene to render

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

        // To render textures to screen        

        this.quad = new THREE.Mesh( new THREE.PlaneGeometry( 2,2 ) );
        this.quad.name = "quad";
        this.quad.receiveShadow = true;
        this.scene.add( this.quad );

        // To render screen quad

        this.postCamera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
    }

    initLights() {

        // Scene lights

        let dirLight = new THREE.DirectionalLight( 0xffffff, 1.2 );
        dirLight.name = 'Directional';
        dirLight.position.set( -8, 6, 3);
        dirLight.castShadow = true;
        dirLight.shadow.radius = 3.5;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.right = 15;
        dirLight.shadow.camera.left = - 15;
        dirLight.shadow.camera.top	= 15;
        dirLight.shadow.camera.bottom = - 15;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add( dirLight );
        this.directionalLight = dirLight;

        let pointLight = new THREE.PointLight( 0xee44dd, 0.8 );
        pointLight.name = 'Point';
        pointLight.position.set( 8, 2.5, 8);
        pointLight.castShadow = true;
        pointLight.shadow.mapSize.width = 2048;
        pointLight.shadow.mapSize.height = 2048;
        pointLight.shadow.camera.near = 1;
        pointLight.shadow.camera.far = 100;
        pointLight.shadow.radius = 3.5;
        this.pointLight = pointLight;
        this.scene.add( this.pointLight );

        let spotLight = new THREE.SpotLight( 0xffa95c, 1 );
        spotLight.name = 'Spot';
        spotLight.position.set( -8, 6, 3);
        spotLight.castShadow = true;
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.3;
        spotLight.shadow.mapSize.width = 2048;
        spotLight.shadow.mapSize.height = 2048;
        spotLight.shadow.camera.near = 1;
        spotLight.shadow.camera.far = 200;
        this.spotLight = spotLight;
        this.scene.add( this.spotLight );

        // To render shadowmap helpers in screen

        this.shadowMapViewers = [
            new ShadowMapViewer( this.directionalLight ),
            new ShadowMapViewer( this.pointLight ),
            new ShadowMapViewer( this.spotLight ),
        ];
        this.resizeShadowMapViewers();
    }

    initMisc() {

        // Render stats
        
        this.stats = new Stats();
        document.body.appendChild( this.stats.dom );

        // Renderer

        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.setClearColor( new THREE.Color( 0x222222 ) ) ;
        this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.enableShadowmaps = () => { this.renderer.shadowMap.enabled = true; }
        this.disableShadowmaps = () => { this.renderer.shadowMap.enabled = false; }

        document.body.appendChild( this.renderer.domElement );

        this.renderer.domElement.tabIndex = '1';
        this.renderer.domElement.onkeydown = (e) => {

            if( e.key === 'r' ) {
                e.preventDefault();
                this.updateMaterials();
            }
        }

        // Load some assets

        this.blackTexture = this.loadTexture( './data/textures/black.png' );
        
        // Camera orbit controls

        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.object.position.set(0.0, 3.4, 8);
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 50;
        this.controls.target.set(0.0, 2.6, 0);

        // Deferred targets

        this.prepareRenderTargets();
    }

    initUI() {

        const gui = this.gui;
        gui.title("Scene")

        const errorFunc = console.error;
        console.error = () => {};

        gui.add( this, 'debugShadowmaps' );

        function CreateObjectUI( folder, object, isUniform ) {
            for( const p in object ) {
                const value = isUniform ? object[ p ].value : object[ p ];
                if( value === undefined 
                    || value === null
                    || value.constructor === Function 
                    || value.constructor === Array 
                    || value.constructor === THREE.Matrix3 
                    || value.constructor === THREE.Matrix4
                    || value.constructor === THREE.Quaternion 
                    || value.constructor === THREE.Vector4 ) continue;

                let dataObject = isUniform ? object[ p ] : object;

                const r = DisplayUI[ p ];
                if( r ) {
                    if( isUniform )
                        folder.add( dataObject, 'value', r.min, r.max, r.step ).name( p );       
                    else
                        folder.add( dataObject, p, r.min, r.max, r.step );
                    continue;
                } else if( DisplayUI.Off( p ) ) continue;
                else if ( DisplayUI.IsCombo( p ) ) {
                    folder.add( object, p, DisplayUI.combos[ p ] ).onChange( v => { object[ p ] = v; });
                    continue;
                }

                switch( value.constructor ) {

                    case Object:
                        if( Object.keys( value ).length )
                            CreateObjectUI( folder.addFolder( p ), value, p === 'uniforms' )
                        continue;
                    case Number: // default number, add it to display ui if necessary
                        if( isUniform )
                            folder.add( dataObject, 'value', 0, 1, 0.01 ).name( p );        
                        else
                            folder.add( dataObject, p, 0, 1, 0.01 );        
                        continue;
                    case THREE.Color: // default number, add it to display ui if necessary
                        folder.addColor( dataObject, p );        
                        continue;
                    case THREE.Euler:
                    case THREE.Vector3:
                        // folder.add( dataObject, p+"x").name('X').onChange( v => { dataObject[ p ].set( v, dataObject[ p ].y, dataObject[ p ].z ); } );
                        // folder.add( dataObject, p+"y").name('Y').onChange( v => { dataObject[ p ].set( dataObject[ p ].x, v, dataObject[ p ].z ); } );
                        // folder.add( dataObject, p+"z").name('Z').onChange( v => { dataObject[ p ].set( dataObject[ p ].x, dataObject[ p ].z, v ); } );
                        continue;
                }

                folder.add( dataObject, p );
            }

            return folder;
        }

        const directionalLight = gui.addFolder( 'DirectionalLight' )
        CreateObjectUI( directionalLight, this.directionalLight ).close();
        CreateObjectUI( directionalLight.addFolder( 'Shadow' ), this.directionalLight.shadow );
        CreateObjectUI( directionalLight.addFolder( 'Camera' ), this.directionalLight.shadow.camera );

        const spotLight = gui.addFolder( 'SpotLight' )
        CreateObjectUI( spotLight, this.spotLight ).close();
        CreateObjectUI( spotLight.addFolder( 'Shadow' ), this.spotLight.shadow );
        CreateObjectUI( spotLight.addFolder( 'Camera' ), this.spotLight.shadow.camera );

        const pointLight = gui.addFolder( 'PointLight' )
        CreateObjectUI( pointLight, this.pointLight ).close();
        CreateObjectUI( pointLight.addFolder( 'Shadow' ), this.pointLight.shadow );
        CreateObjectUI( pointLight.addFolder( 'Camera' ), this.pointLight.shadow.camera );

        CreateObjectUI( gui.addFolder( 'Deferred Material' ), this.deferredLightingMaterial ).close();
        CreateObjectUI( gui.addFolder( 'Acc Material' ), this.accMaterial ).close();

        console.error = errorFunc;
    }

    animate() {
        
        requestAnimationFrame( this.animate.bind(this) );

        this.render();
        this.controls.update();
        this.stats.update();
    }

    render() {

        // Render model
        
        this.enableShadowmaps();
        this.applyLayer( this.quad, 0 );
        this.applyLayer( this.model, 1 );

        this.renderer.setRenderTarget( this.renderTargetDef );
        this.renderer.render( this.scene, this.camera );
        
        // Render screen quad

        this.disableShadowmaps();
        this.applyLayer( this.quad, 1 );
        this.applyLayer( this.model, 0 );

        // Apply lighting

        this.useQuadMaterial( this.deferredLightingMaterial );
        this.setRenderTarget( this.renderTargetLights );

        if( this.debugShadowmaps ) 
            this.toScreen();

        this.renderer.render( this.scene, this.postCamera );

        // Debug: Show Lights Shadowmap

        if( this.debugShadowmaps ) {
            for( const viewer of this.shadowMapViewers )
                viewer.render( this.renderer );
            return;
        }
        
        this.renderer.autoClear = false;

        let irradianceMap = this.renderTargetLights.texture[ 0 ];

        for(let i = 0, pv = 0; i < V.length; i++) {
            
            var width = Math.sqrt( V[i] - pv );
            pv = V[ i ];

            this.blurStep( 'h', width, irradianceMap );

            irradianceMap = this.renderTargetHblur.texture[ 0 ];

            this.blurStep( 'v', width, irradianceMap );

            irradianceMap = this.renderTargetVblur.texture[ 0 ];

            this.accumulateStep( irradianceMap, RGB[ i ], THREE.OneMinusSrcAlphaFactor );
        }

        this.accumulateStep( this.renderTargetLights.texture[ 0 ], Vector3One, THREE.SrcAlphaFactor );
        this.accumulateStep( this.renderTargetLights.texture[ 1 ], Vector3One, THREE.OneFactor);

        // Final FX
        this.renderer.autoClear = true;
        this.useQuadMaterial( this.gammaMaterial );
        this.toScreen()
        this.renderer.render( this.scene, this.postCamera );
    }

    blurStep( type, width, map ) {
        this.useQuadMaterial( type === 'h' ? this.hBlurMaterial : this.vBlurMaterial );
        this.quad.material.uniforms.width.value = width;
        if( map ) this.quad.material.uniforms.irradianceMap.value = map;
        this.setRenderTarget( type === 'h' ? this.renderTargetHblur : this.renderTargetVblur );
        this.renderer.render( this.scene, this.postCamera );
    }

    accumulateStep( colorMap, weight, blendDst ) {

        this.accMaterial.blendDst = blendDst;
        this.useQuadMaterial( this.accMaterial );
        this.quad.material.uniforms.colorMap.value = colorMap;
        this.quad.material.uniforms.weight.value = weight;
        this.setRenderTarget( this.renderTargetAcc );
        this.renderer.render( this.scene, this.postCamera );
    }

    useQuadMaterial( material ) {
        this.quad.material = material;
    }

    prepareMaterials() {

        // Create Deferred and SSS Materials

        let bodyMaterial = this.model.getObjectByName("Body").material.clone();

        const uniforms = Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), {
            map:  { type: 't', value: bodyMaterial.map },
            normalMap:  { type: "t", value: bodyMaterial.normalMap },
            specularMap:  { type: "t", value: this.loadTexture( './data/textures/Woman_Body_Specular.png' ) },
            sssMap:  { value: this.loadTexture( './data/textures/woman_body_sss.png' ) },
            uvTransform: { type: "matrix4", value: bodyMaterial.map.matrix }
        } );

        const gBufferConfig = {
            name: "gBuffer",
            uniforms: uniforms,
            vertexShader: ShaderChunk.getVertexShader(),
            fragmentShader: SM.get('gBufferFrag'),
            lights: true,
            colorWrite: true,
            glslVersion: THREE.GLSL3,
            defines: { IS_BODY: 1 }
        };

        let gBufferMaterial = new THREE.ShaderMaterial( gBufferConfig );
        let gBufferTransparentMaterial =  new THREE.ShaderMaterial( Object.assign( gBufferConfig, { 
            name: 'gBufferTransparent',
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
        
        this.model.name = 'Model';
        this.scene.add(this.model);

        for( const obj of this.scene.getObjectByName('Armature').children ) {
            if(!obj.material)
            continue; 
            if(obj.name !== 'Eyes' && obj.material.name.includes( 'Bodymat' ))
                obj.material = obj.name === 'Eyelashes' ? gBufferTransparentMaterial : gBufferMaterial;
            else {
                obj.material = this.createGBufferMaterialFromSrc( obj.material );
            }
        }

        this.deferredLightingMaterial = new THREE.ShaderMaterial( {
            name: 'deferredLighting',
            vertexShader: ShaderChunk.vertexShaderQuad(),
            fragmentShader: SSS_ShaderChunk.deferredFinalFS(),
            uniforms: Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), {
                map: { type: 't', value: this.renderTargetDef.texture[ 0 ] },
                positionMap: { value: this.renderTargetDef.texture[ 1 ] },
                normalMap: { value: this.renderTargetDef.texture[ 2 ] },
                detailedNormalMap: { value: this.renderTargetDef.texture[ 3 ] },
                depthMap: { value: this.renderTargetDef.depthTexture },
                transmitanceLut: { value: this.loadTexture( './data/textures/transmitance_lut.png' , {
                    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping
                })},
                specularIntensity: { type: 'number', value: 0.5 },
                ambientIntensity: { type: 'number', value: 0.5 },
                shadowShrinking: { type: 'number', value: 0.1 },
                translucencyScale: { type: 'number', value: 1.4 },
                ambientLightColor:  {type: 'vec3', value: Vector3One },
                cameraNear: { value : this.camera.near },
                cameraFar: { value : this.camera.far },
                cameraEye: { value : this.camera.position }
            } ),
            depthTest: false,
            lights: true,
            glslVersion: THREE.GLSL3
        });

        this.hBlurMaterial = new THREE.ShaderMaterial( {
            vertexShader: ShaderChunk.vertexShaderQuad(),
            fragmentShader: SSS_ShaderChunk.horizontalBlurFS(),
            uniforms: {
                irradianceMap: { value: this.renderTargetLights.texture[ 0 ] },
                depthMap: { value: this.renderTargetLights.texture[ 2 ] },
                sssLevel: { value: 200 },
                correction: { value: 800 },
                maxdd: { value: 0.001 },
                invPixelSize: { value: [1 / this.renderTargetLights.texture[ 0 ].image.width, 1 / this.renderTargetLights.texture[ 0 ].image.height] },
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
                irradianceMap: { value: this.renderTargetHblur.texture[ 0 ] },
                depthMap: { value: this.renderTargetLights.texture[ 2 ] },
                sssLevel: { value: 200 },
                correction: { value: 800 },
                maxdd: { value: 0.001 },
                invPixelSize: { value: [1 / this.renderTargetLights.texture[ 0 ].image.width, 1 / this.renderTargetLights.texture[ 0 ].image.height] },
                width: { value: 0.0 },
                cameraNear: { value : this.camera.near },
                cameraFar: { value : this.camera.far },
            },
            depthTest: false,
            blending: THREE.NoBlending,
            glslVersion: THREE.GLSL3
        });

        this.accMaterial = new THREE.ShaderMaterial( {
            vertexShader: ShaderChunk.vertexShaderQuad(),
            fragmentShader: SSS_ShaderChunk.accumulativeFS(),
            uniforms: {
                colorMap: { value: this.renderTargetLights.texture[ 0 ] },
                depthMap: { value: this.renderTargetLights.texture[ 2 ] },
                normalMap: { value: this.renderTargetDef.texture[ 2 ] },
                weight: { value: Vector3One },
            },
            depthTest: false,
            blending: THREE.CustomBlending,
            blendSrc: THREE.OneFactor,
            glslVersion: THREE.GLSL3
        });

        this.gammaMaterial = new THREE.ShaderMaterial( {
            vertexShader: ShaderChunk.vertexShaderQuad(),
            fragmentShader: SSS_ShaderChunk.gammaCorrection(),
            uniforms: { colorMap: { value: this.renderTargetAcc.texture[ 0 ] } },
            depthTest: false,
            blending: THREE.NoBlending,
            glslVersion: THREE.GLSL3
        });
    }

    async updateMaterials() {

        await this.shaderManager.reload();

        // GBuffer materials

        for( const obj of this.scene.getObjectByName('Armature').children ) {
            if(!obj.material)
            continue; 
            obj.material.fragmentShader = SM.get( 'gBufferFrag' );
        }
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
            THREE.FloatType // Keep in sync with RT textures
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

    createGBufferMaterialFromSrc( mat ) {

        // Create THREE Shader Material from original GLB material

        const materialConfig = {
            uniforms: Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), {
                map:  { type: 't', value: mat.map },
                normalMap:  { type: "t", value: mat.normalMap },
                sssMap: { type: 't', value: this.blackTexture },
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

    applyLayer( object, mask ) {

        // Hide or show object

        object.layers.mask = mask;
        object.traverse( child => {
            child.layers.mask = mask;
        } );
    }

    loadTexture( path, parameters = {} ) {
        const texture = this.textureLoader.load( path, parameters.onload );
        texture.wrapS = parameters.wrapS || THREE.RepeatWrapping;
        texture.wrapT = parameters.wrapT || THREE.RepeatWrapping;
        texture.minFilter = parameters.minFilter || THREE.LinearMipmapLinearFilter;
        texture.magFilter = parameters.magFilter || THREE.LinearFilter;
        texture.flipY = parameters.flip;
        return texture;
    }

    setRenderTarget( rt ) {
        this.renderer.setRenderTarget( rt );
    }

    toScreen() {
        this.renderer.setRenderTarget( null );
    }

    resizeShadowMapViewers( width ) {

        const uWidth = width || window.innerWidth;
        const size = uWidth * 0.1;

        for( const viewer of this.shadowMapViewers ) {
            viewer.size.set( size, size );
            viewer.position.set( 10, 60 + this.shadowMapViewers.indexOf( viewer ) * size * 1.1 );
        }
    }

    onWindowResize() {

        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( width, height );
        this.resizeShadowMapViewers( width );

        for( const viewer of this.shadowMapViewers )
            viewer.updateForWindowResize();
    }

}

let player = new Player();
player.init();
window.player = player;

export { Player };
