import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/RGBELoader.js';
import { CharacterController } from './controllers/CharacterController.js'
import { ShaderManager } from './shaderManager.js'
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/EffectComposer.js';
import { SSAOPass } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/SSAOPass.js';
import { BufferGeometry } from 'three';

let firstframe = true;

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

let SM = null;
class App {

    constructor() {
        
        this.clock = new THREE.Clock(false);
        this.loaderBVH = new BVHLoader();
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
        this.renderer.outputEncoding = THREE.sRGBEncoding;
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
                u_hairColorMap: { value: this.loadTexture('./data/textures/Color.png') },
                u_diffuseColor: { type: 'vec3', value: new THREE.Vector3(0.19,0.14,0.04) }, // this can help refine the hair color
                u_constantDiffuseFactor: { type: 'number', value: 0.03 }, // simulates multiple scattering in hair
                u_specularExp1: { type: 'number', value: 100.0 },
                u_specularExp2: { type: 'number', value: 100.0 },
                u_primaryShift: { type: 'number', value: 0.2},
                u_secondaryShift: { type: 'number', value: -0.2 },
                u_specularStrength: { type: 'number', value: 0.035 }
            });

        let eyeUniforms = Object.assign( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), 
            {
                u_irisAlbedo: { value: this.loadTexture('./data/textures/Eye/Iris_Albedo_Extended.png') },
                u_irisColor: { type: 'vec3', value: new THREE.Vector3(1.0, 1.0, 1.0)},
                u_diffuseFactor: { type: 'number', value: 2.0 },
                u_irisRoughness: { type: 'number', value: 0.05 },
                u_scleraAlbedo: { value: this.loadTexture('./data/textures/Eye/Esclera_Albedo.png') },
                u_scleraNormal: { value: this.loadTexture('./data/textures/Eye/sclera-normal.jpg') },
                u_scleraNormalScale: { type: 'number', value: 0.15 },
                u_scleraRoughness: { type: 'number', value: 0.07 },
                u_limbusSize: { type: 'number', value: 0.035 },
                u_limbusDarkening: { type: 'number', value: 0.5 },
                u_specularF90: { type: 'number', value: 0.2 },
                u_corneaIOR: { type: 'number', value: 1.3 },
                envMapIntensity: { type: 'number', value: 0.4 },
            });

        let envPromise = new RGBELoader()
            .setPath( 'data/hdrs/' )
            .load( 'ballroom.hdr', function ( texture ) {

                texture.mapping = THREE.EquirectangularReflectionMapping;

                that.scene.background = texture;
                that.scene.environment = texture;

                // if environment gets removed, set this to value: null !!!
                hairUniforms["envMap"] = { value: texture };
                eyeUniforms["envMap"] = { value: texture };

                that.renderer.render( that.scene, that.camera );
        } );

        // so the screen is not black while loading
        this.renderer.render( this.scene, this.camera );
        
        // Behaviour Planner
        // this.eyesTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthWrite: true }) );
        // this.eyesTarget.name = "eyesTarget";
        // this.eyesTarget.position.set(0, 2.5, 15); 
        // this.headTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0xff0000 , depthWrite: true }) );
        // this.headTarget.name = "headTarget";
        // this.headTarget.position.set(0, 2.5, 15); 
        // this.neckTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0x00fff0 , depthWrite: true }) );
        // this.neckTarget.name = "neckTarget";
        // this.neckTarget.position.set(0, 2.5, 15); 

        // this.scene.add(this.eyesTarget);
        // this.scene.add(this.headTarget);
        // this.scene.add(this.neckTarget);

        // ---------- Scene lights ----------
        this.initLights()
        // const light1 = new THREE.PointLight( 0xffffff, 1.0, 100 );
        // light1.position.set( 0, 10, -18 );
        // this.scene.add( light1 );

        const light2 = new THREE.DirectionalLight( 0xffffff, 1.0 );
        light2.position.set( -10, 0, 20 );
        light2.lookAt(new THREE.Vector3(0,10,0));
        light2.castShadow = true;
        //this.scene.add( light2 );

        // ---------- Load shaders ----------
        this.shaderManager = new ShaderManager("data/shaders/");
        SM = this.shaderManager;
        let promise = SM.loadFromFile("HairKajiya.vs");
        promise = await promise;
        promise = SM.loadFromFile("HairKajiya.fs");
        promise = await promise;
        promise = SM.loadFromFile("Eye.vs");
        promise = await promise;
        promise = SM.loadFromFile("Eye.fs");
        promise = await promise;

        // ---------- Create Hair Material ----------         
        this.hairMaterial = new THREE.ShaderMaterial( {
            name: 'HairKajiya',
            vertexShader: SM.get( 'HairKajiya.vs' ),
            fragmentShader: SM.get( 'HairKajiya.fs' ),
            uniforms: hairUniforms,
            lights: true,
            side: THREE.DoubleSide,
            blending: THREE.NoBlending,
            alphaToCoverage: true,
            glslVersion: THREE.GLSL3,
        });

        this.eye = new THREE.ShaderMaterial( {
            name: 'Eye',
            vertexShader: SM.get( 'Eye.vs' ),
            fragmentShader: SM.get( 'Eye.fs' ),
            uniforms: eyeUniforms,
            lights: true,
            side: THREE.FrontSide,
            blending: THREE.NoBlending,
            glslVersion: THREE.GLSL3,
        });

        // Load the model
        this.loaderGLB.load( 'data/EvaCorrectedEyes.glb', (glb) => {

            this.model = glb.scene;
            //this.model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            //this.model.position.set(0, 0.75, 0);
            this.model.scale.set(8.0, 8.0, 8.0);
            this.model.castShadow = true;
           
            this.model.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    if (object.name == "Eyelashes")
                        object.castShadow = false;
                    if (object.name.includes("Object"))
                    {
                        object.geometry.computeTangents();
                        object.castShadow = false;
                        object.material = this.hairMaterial;
                    }
                    if(object.name.includes("Eye"))
                    {
                        object.castShadow = false;
                        object.material = this.eye;
                    }
                    // if(object.material.map) object.material.map.anisotropy = 16;
                    // object.material.metalness = 0;
                    
                } else if (object.isBone) {
                    object.scale.set(1.0, 1.0, 1.0);
                }
            } );

            this.skeletonHelper = new THREE.SkeletonHelper(this.model);
            this.skeletonHelper.visible = false;
            this.scene.add(this.skeletonHelper);
            this.scene.add(this.model);

            this.model.eyesTarget = this.eyesTarget;
            this.model.headTarget = this.headTarget;
            this.model.neckTarget = this.neckTarget;

            // this.body = this.model.getObjectByName( 'Body' );
            // if(!this.body)
            //     this.body = this.model.getObjectByName( 'BodyMesh' );
            // this.eyelashes = this.model.getObjectByName( 'Eyelashes' );

            // let additiveActions = {};
            // const expressions = Object.keys( this.body.morphTargetDictionary );
            // for ( let i = 0; i < expressions.length; i++ ) {
            //     additiveActions[expressions[i]] = {weight: this.body.morphTargetInfluences[i]}
            // }
            
            // this.ECAcontroller = new CharacterController({character: this.model});
            // var morphTargets = { 
            //     'Body': {dictionary: this.body.morphTargetDictionary, weights: this.body.morphTargetInfluences, map: additiveActions},
            //     'Eyelashes': {dictionary: this.eyelashes.morphTargetDictionary, weights: this.eyelashes.morphTargetInfluences, map: additiveActions}
            // }
            // this.ECAcontroller.onStart();
            
            // // load the actual animation to play
            // this.mixer = new THREE.AnimationMixer( this.model );
            // this.loadBVH('data/anim/NGT Thanks.bvh');
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

        // if (this.mixer) {
        //     this.mixer.update(delta);
        // }

        // this.ECAcontroller.time = et;
        // // Update the animation mixer, the stats panel, and render this frame
        // this.ECAcontroller.facialController.onUpdate(delta, et, this.ECAcontroller.onUpdate.bind(this.ECAcontroller) );
        // //this.ECAcontroller.onUpdate(dt, et);
        // let BSw = this.ECAcontroller.facialController._morphDeformers;
        // this.body.morphTargetInfluences = BSw["Body"].morphTargetInfluences;
        // this.eyelashes.morphTargetInfluences = BSw["Eyelashes"].morphTargetInfluences;
            
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

    loadBVH( filename ) {

        this.loaderBVH.load( filename , (result) => {
            for (let i = 0; i < result.clip.tracks.length; i++) {
                result.clip.tracks[i].name = result.clip.tracks[i].name.replaceAll(/[\]\[]/g,"").replaceAll(".bones","");
            }
            this.mixer.clipAction( result.clip ).setEffectiveWeight( 1.0 ).play();
            this.mixer.update(0);

            let msg = {
                type: "behaviours",
                data: [
                    {
                        type: "faceLexeme",
                        start: 0.5,
                        attackPeak: 0.8,
                        relax: 2.5,
                        end: 3,
                        amount: 0.6,
                        lexeme: "LIP_CORNER_PULLER"
                    },
                    {
                        type: "faceLexeme",
                        start: 1,
                        attackPeak: 1.4,
                        relax: 3.5,
                        end: 4,
                        amount: 1,
                        lexeme: "LOWER_BROWS"
                    }
                ]
            };
            this.ECAcontroller.processMsg(JSON.stringify(msg));

            this.animate();
        } );
    }
}

let app = new App();
app.init();

export { app };
