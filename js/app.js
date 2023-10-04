import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { ShaderManager } from './shaderManager.js'
// import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/EffectComposer.js';
// import { SSAOPass } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/SSAOPass.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.16/+esm';
import { DisplayUI } from './ui.js'

let firstframe;

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class App {

    constructor() {
        
        this.clock = new THREE.Clock(false);
        this.loaderGLB = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        this.shaderManager = null

        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;

        this.mixer = null;
        this.skeletonHelper = null;
        this.boneContainer = null;

        this.skeleton = null;
        this.model = null;
        this.model2 = null;
        this.srcModel = null;
        this.animSkeleton = null;
        this.srcBindPose = null;
        this.tgtBindPose = null;

        this.ECAcontroller = null;
        this.eyesTarget = null;
        this.headTarget = null;
        this.neckTarget = null;

        this.body = null;
        this.eyelashes = null;

        this.gui = new GUI();
    }
    
    async init() {

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xbfbebd );
        this.scene.fog = new THREE.Fog( 0xbfbebd, 100, 150 );
        
        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.position.y = -7; // it is moved because of the mesh scale
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        // this.scene.add( ground );

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        //this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild( this.renderer.domElement );

        // camera
        this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 0.01, 1000 );
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        // this.controls.object.position.set(0.0, 3.4, 8);
        this.camera.position.set(0.0, 10.6, 8)
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 100;
        this.controls.target.set(0.0, 10.0, 0);
        this.controls.update();
        
        var that = this

        let hairUniforms = Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), 
            {
                alphaMap: { value: this.loadTexture('./data/textures/Base_baseTexBaked.bmp') },
                normalMap: { value: this.loadTexture('./data/textures/Texture_normals.bmp') },
                envMapIntensity: { type: 'number', value: 0.5 },
                //envMap: { value: this.scene.environment },
                u_hairColorMap: { value: this.loadTexture('./data/textures/Hair_Albedo.png') },
                u_diffuseColor: { type: 'vec3', value: new THREE.Vector3(0.19,0.14,0.04) }, // this can help refine the hair color
                u_constantDiffuseFactor: { type: 'number', value: 0.03 }, // simulates multiple scattering in hair
                u_specularExp1: { type: 'number', value: 100.0 },
                u_specularExp2: { type: 'number', value: 60.0 },
                u_primaryShift: { type: 'number', value: 0.1},
                u_secondaryShift: { type: 'number', value: -0.1 },
                u_specularStrength: { type: 'number', value: 0.035 },
            });

        let eyeUniforms = Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), 
            {
                u_irisAlbedo: { value: this.loadTexture('./data/textures/Eye/IrisAlbedo.png') },
                u_irisColor: { type: 'vec3', value: new THREE.Vector3(1.0, 1.0, 1.0)},
                u_diffuseFactor: { type: 'number', value: 2.0 },
                u_irisRoughness: { type: 'number', value: 0.05 },
                u_scleraAlbedo: { value: this.loadTexture('./data/textures/Eye/ScleraAlbedo.png') },
                u_scleraNormal: { value: this.loadTexture('./data/textures/Eye/sclera-normal.jpg') },
                u_scleraNormalScale: { type: 'number', value: 0.15, min: 0.0, max: 2.0 },
                u_scleraRoughness: { type: 'number', value: 0.07 },
                u_limbusSize: { type: 'number', value: 0.04 },
                u_limbusDarkening: { type: 'number', value: 0.55 },
                u_specularF90: { type: 'number', value: 0.2 },
                u_corneaIOR: { type: 'number', value: 1.336 },
                envMapIntensity: { type: 'number', value: 0.4 },
            });


        //let tex = this.loadTexture('./data/imgs/Hair_Diffuse-Hair_Opacity.png');
        let tex = this.loadTexture('./data/imgs/Hair_Diffuse-Hair_Opacity.png');
        // tex.magFilter = THREE.NearestFilter;
        // tex.minFilter = THREE.NearestFilter;
        // tex.needsUpdate = true;


        let hairKevinUniforms = Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), 
            {
                alphaMap: { value: this.loadTexture('./data/imgs/Hair_Opacity.bmp') },
                // normalMap: { value: this.loadTexture('./data/textures/Texture_normals.bmp') },
                envMapIntensity: { type: 'number', value: 0.5 },
                //envMap: { value: this.scene.environment },
                // u_hairColorMap: { value: this.loadTexture('./data/imgs/Hair_Diffuse.png') },
                u_hairColorMap: { value: tex },
                u_diffuseColor: { type: 'vec3', value: new THREE.Vector3(0.1, 0.08, 0.05) }, // this can help refine the hair color
                u_constantDiffuseFactor: { type: 'number', value: 0.03 }, // simulates multiple scattering in hair
                u_specularExp1: { type: 'number', value: 100.0 },
                u_specularExp2: { type: 'number', value: 60.0 },
                u_primaryShift: { type: 'number', value: 0.1},
                u_secondaryShift: { type: 'number', value: -0.1 },
                u_specularStrength: { type: 'number', value: 0.035 },
            });

        let eyelashesKevinUniforms = Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), 
            {
                alphaMap: { value: this.loadTexture('./data/imgs/Std_Eyelash_Opacity.jpg') },
                normalMap: { value: this.loadTexture('./data/imgs/Std_Eyelash_Normal.png') },
                envMapIntensity: { type: 'number', value: 0.5 },
                //envMap: { value: this.scene.environment },
                u_hairColorMap: { value: this.loadTexture('./data/imgs/Std_Eyelash_Diffuse.jpg') },
                u_diffuseColor: { type: 'vec3', value: new THREE.Vector3(0.19,0.14,0.04) }, // this can help refine the hair color
                u_constantDiffuseFactor: { type: 'number', value: 0.03 }, // simulates multiple scattering in hair
                u_specularExp1: { type: 'number', value: 100.0 },
                u_specularExp2: { type: 'number', value: 60.0 },
                u_primaryShift: { type: 'number', value: 0.1},
                u_secondaryShift: { type: 'number', value: -0.1 },
                u_specularStrength: { type: 'number', value: 0.035 }
            });

        let envPromise = new RGBELoader()
            .setPath( 'data/hdrs/' )
            .load( 'cafe.hdr', function ( texture ) {

                texture.mapping = THREE.EquirectangularReflectionMapping;

                //that.scene.background = texture;
                that.scene.environment = texture;

                // if environment gets removed, set this to value: null !!!
                hairUniforms["envMap"] = { value: texture };
                eyeUniforms["envMap"] = { value: texture };

                that.renderer.render( that.scene, that.camera );
        } );

        // so the screen is not black while loading
        this.renderer.render( this.scene, this.camera );

        // ---------- Scene lights ----------
        this.initLights(); // necessary for the eyes renders (burns the skin) (TODO: correct at some point, ask Santi)

        // ---------- Load shaders ----------
        this.shaderManager = new ShaderManager("data/shaders/");
        let promise = this.shaderManager.loadFromFile("HairKajiya.vs");
        promise = await promise;
        promise = this.shaderManager.loadFromFile("HairKajiya.fs");
        promise = await promise;
        promise = this.shaderManager.loadFromFile("Eye.vs");
        promise = await promise;
        promise = this.shaderManager.loadFromFile("Eye.fs");
        promise = await promise;

        // ---------- Create Hair Material ----------         
        this.hairMaterial = new THREE.ShaderMaterial( {
            name: 'HairKajiya',
            vertexShader: this.shaderManager.get( 'HairKajiya.vs' ),
            fragmentShader: this.shaderManager.get( 'HairKajiya.fs' ),
            uniforms: hairUniforms,
            lights: true,
            side: THREE.DoubleSide,
            transparent: true,
            // blending: THREE.NoBlending,
            alphaToCoverage: true,
            //alphaHash: true,
            //depthWrite: false,
            glslVersion: THREE.GLSL3,
        });

        this.eye = new THREE.ShaderMaterial( {
            name: 'Eye',
            vertexShader: this.shaderManager.get( 'Eye.vs' ),
            fragmentShader: this.shaderManager.get( 'Eye.fs' ),
            uniforms: eyeUniforms,
            lights: true,
            side: THREE.FrontSide,
            blending: THREE.NoBlending,
            glslVersion: THREE.GLSL3,
        });

        this.hairKevinMaterial = new THREE.ShaderMaterial( {
            name: 'HairKajiya',
            vertexShader: this.shaderManager.get( 'HairKajiya.vs' ),
            fragmentShader: this.shaderManager.get( 'HairKajiya.fs' ),
            uniforms: hairKevinUniforms,
            lights: true,
            side: THREE.DoubleSide,
            transparent: true,
            // blending: THREE.NoBlending,
            alphaToCoverage: true,
            //alphaHash: true,
            //depthWrite: false,
            glslVersion: THREE.GLSL3,
        });

        this.eyelashesKevinMaterial = new THREE.ShaderMaterial( {
            name: 'HairKajiya',
            vertexShader: this.shaderManager.get( 'HairKajiya.vs' ),
            fragmentShader: this.shaderManager.get( 'HairKajiya.fs' ),
            uniforms: eyelashesKevinUniforms,
            lights: true,
            side: THREE.DoubleSide,
            transparent: true,
            // blending: THREE.NoBlending,
            alphaToCoverage: true,
            //alphaHash: true,
            //depthWrite: false,
            glslVersion: THREE.GLSL3,
        });

        // Load the model
        this.loaderGLB.load( 'data/kevin_finished_first_test_5_5.glb', (glb) => {

            window.kevin = this.model2 = glb.scene;
            //this.model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            this.model2.position.set(2, -1.1, 0);
            this.model2.scale.set(8.0, 8.0, 8.0);
            this.model2.castShadow = true;
           
            this.model2.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    
                    if (object.name == "Classic_short") {
                        object.geometry.computeTangents();
                        object.castShadow = false;
                        object.material = this.hairKevinMaterial;
                        
                        // object.material.transparent = true;
                        // object.material.alphaTest = 0.001;
                        // object.material.alphaMap = null;
                        // object.material.shininess = 6;
                        // object.material.depthTest = true;
                        // object.material.depthWrite = true;
                        // object.material.skinning = true;
                        // object.material.needsUpdate = true;
                    }

                    // if (object.name == "Classic_short") {
                    //     object.material.side = THREE.DoubleSide;
                    //     //object.material.depthWrite = false;
                    //     object.material.depthFunc = THREE.LessEqualDepth; // NeverDepth AlwaysDepth EqualDepth LessDepth LessEqualDepth GreaterEqualDepth GreaterDepth NotEqualDepth
                    //     //object.material.blending = THREE.NoBlending;
                    //     object.material.alphaHash = true;
                    //     //object.material.alphaToCoverage = true;
                    //     //object.material.alphaTest = 0.01;
                    //     object.material.transparent = false;
                    // }

                    if (object.name == "Eyelashes") {
                        object.geometry.computeTangents();
                        object.castShadow = false;
                        object.material = this.eyelashesKevinMaterial;
                    }
                    // if(object.material.map) object.material.map.anisotropy = 16;
                    object.material.metalness = 0;
                    
                } else if (object.isBone) {
                    object.scale.set(1.0, 1.0, 1.0);
                }
            } );

            this.skeletonHelper2 = new THREE.SkeletonHelper(this.model2);
            this.skeletonHelper2.visible = false;
            this.scene.add(this.skeletonHelper2);
            this.scene.add(this.model2);
        } );

        this.loaderGLB.load( 'data/EvaCorrectedEyes.glb', (glb) => {

            this.model = glb.scene;
            //this.model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            this.model.position.set(-2, 0, 0);
            this.model.scale.set(8.0, 8.0, 8.0);
            this.model.castShadow = true;
           
            this.model.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    
                    if (object.name.includes("Hair") || object.name.includes("Eyelash"))
                    {
                        object.geometry.computeTangents();
                        object.castShadow = false;
                        object.material = this.hairMaterial;
                    }
                    else if(object.name.includes("Cornea"))
                    {
                        object.castShadow = false;
                        //object.material = this.eye;
                    }
                    // if(object.material.map) object.material.map.anisotropy = 16;
                    object.material.metalness = 0;
                    
                } else if (object.isBone) {
                    object.scale.set(1.0, 1.0, 1.0);
                }
            } );

            this.skeletonHelper = new THREE.SkeletonHelper(this.model);
            this.skeletonHelper.visible = false;
            this.scene.add(this.skeletonHelper);
            this.scene.add(this.model);
            
            this.initUI();
            this.animate();

            $('#loading').fadeOut();
        } );


        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        document.addEventListener( 'keydown', this.onKeyDown.bind(this) );
    }
    initLights(){
      
        // Scene lights 
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        hemiLight.position.set( 0, 20, 0 );
        //this.scene.add( hemiLight );
  
        const spotLight = new THREE.SpotLight(0xffa95c,0.2);
        spotLight.position.set(-50,50,50);
        spotLight.castShadow = true;
        spotLight.shadow.bias = -0.0001;
        spotLight.shadow.mapSize.width = 1024*4;
        spotLight.shadow.mapSize.height = 1024*4;
        this.scene.add( spotLight );
  
        const dirLight = new THREE.DirectionalLight( 0xffffff ,0.5);
        dirLight.position.set( 3, 10, 50 );
        dirLight.castShadow = false;
        dirLight.shadow.camera.top = 2;
        dirLight.shadow.camera.bottom = - 2;
        dirLight.shadow.camera.left = - 2;
        dirLight.shadow.camera.right = 2;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 200;
        this.scene.add( dirLight );
    }

    initUI() {

        const gui = this.gui;
        gui.title("Scene")

        const errorFunc = console.error;
        console.error = () => {};


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
                if( !dataObject._ui_tmp ) dataObject._ui_tmp = {}; 

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

                        if( isUniform ) continue;

                        if( !dataObject._ui_tmp[ p ] ) {
                            dataObject._ui_tmp[ p ] = {
                                x:  dataObject[ p ].x,
                                y:  dataObject[ p ].y,
                                z:  dataObject[ p ].z,
                                f: folder.addFolder( p )
                            };
                        }
                        
                        const dataFolder = dataObject._ui_tmp[ p ].f;
                        dataFolder.add( dataObject._ui_tmp[ p ], 'x' ).onChange( v => { dataObject[ p ].set( v, dataObject[ p ].y, dataObject[ p ].z ); } );
                        dataFolder.add( dataObject._ui_tmp[ p ], 'y' ).onChange( v => { dataObject[ p ].set( dataObject[ p ].x, v, dataObject[ p ].z ); } );
                        dataFolder.add( dataObject._ui_tmp[ p ], 'z' ).onChange( v => { dataObject[ p ].set( dataObject[ p ].x, dataObject[ p ].z, v ); } );
                        dataFolder.close();
                        continue;
                }

                folder.add( dataObject, p );
            }

            return folder;
        }

        CreateObjectUI( gui.addFolder( 'Camera' ), this.camera ).close();

        // const spotLight = gui.addFolder( 'SpotLight' )
        // CreateObjectUI( spotLight, this.spotLight ).close();
        // CreateObjectUI( spotLight.addFolder( 'Shadow' ), this.spotLight.shadow );
        // CreateObjectUI( spotLight.addFolder( 'Camera' ), this.spotLight.shadow.camera );

        CreateObjectUI( gui.addFolder( 'Eyes Material' ), this.eye.uniforms, true ).close();
        CreateObjectUI( gui.addFolder( 'Hair Material' ), this.hairMaterial.uniforms, true ).close();
        CreateObjectUI( gui.addFolder( 'HairKevin Material' ), this.hairKevinMaterial.uniforms, true ).close();
        CreateObjectUI( gui.addFolder( 'EyelashesKevin Material' ), this.eyelashesKevinMaterial.uniforms, true ).close();

        console.error = errorFunc;
    }

    animate() {

        requestAnimationFrame( this.animate.bind(this) );
        
        let delta = this.clock.getDelta();
        let et = this.clock.getElapsedTime();

        if (firstframe) {
            this.clock.start();
            firstframe = false;
        }

        if (delta > 0.02) {
            this.clock.stop();
            this.clock.start();
            return;
        }

        if (et == 0) {
            et = 0.001;
        }
            
        this.renderer.render( this.scene, this.camera );
    }
    
    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

    onKeyDown( e ) {
        // basic movement
        switch(e.key) {
            default: break; // skip
        }
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
}

let app = new App();
app.init();

export { app };
