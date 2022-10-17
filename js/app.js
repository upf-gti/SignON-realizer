import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { CharacterController } from './controllers/CharacterController.js'
import { GUI } from '../libs/lil-gui.module.min.js'

let firstframe = true;

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class App {

    constructor() {
        
        this.clock = new THREE.Clock(false);
        this.loaderBVH = new BVHLoader();
        this.loaderGLB = new GLTFLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.spotLight = null;

        this.capturer = null;
        this.recorded = true; // set to true if you don't want to create a video (webm)
        this.recording = false;

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
    createPanel() {
        let gui = new GUI();
        let button = {add: () =>{ 
            // send the facial actions to do
            let msg = {
                type: "behaviours",
                data: [
                    {
                        type: "faceLexeme",
                        start: 0.1,
                        attackPeak: 0.6,
                        relax: 1.5,
                        end: 1.8,
                        amount: 0.7,
                        lexeme: "RAISE_BROWS"
                    },
                    {
                        type: "faceLexeme",
                        start: 1.9,
                        ready: 2.1,
                        relax: 3.1,
                        end: 3.4,
                        amount: 0.5,
                        lexeme: 'LOWER_BROWS'
                    },
                    {
                        type: "faceLexeme",
                        start: 1,
                        attackPeak: 1.4,
                        relax: 2.1,
                        end: 2.5,
                        amount: 0.5,
                        lexeme: "LIP_STRECHER"
                    },
                    {
                        type: "speech",
                        start: 5,
                        end: 6,
                        text: "thanks",
                        textToLipInfo : { text: "thanks", phT: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] }
                    },
                    {
                        type: "gaze",
                        start: 0.5,
                        end: 5,
                        influence: "HEAD",
                        target: "DOWN",
                        offsetDirection: "CAMERA",
                        offsetAngle: 0.5,
                        shift: false
                    },
                ]
            };
            this.ECAcontroller.processMsg(JSON.stringify(msg));
         }};
        gui.add(button, 'add');

        let blink = {blink: () =>{ 
            // send the facial actions to do
            let msg = {
                type: "behaviours",
                data: [
                    {
                        type: "blink",
                        start: 0,
                        ready: 0.5,
                        relax: 0.8,
                        end: 1
                    }
                ]
            };
            this.ECAcontroller.processMsg(JSON.stringify(msg));
         }};
        gui.add(blink, 'blink');
    }

    init() {
        //this.createPanel();
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xa0a0a0 );
        this.scene.fog = new THREE.Fog( 0xa0a0a0, 100, 150 );
        
        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.position.y = -7; // it is moved because of the mesh scale
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );
        
        // lights
        let hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        hemiLight.position.set( 0, 20, 0 );
        this.scene.add( hemiLight );

        let spotLight = new THREE.SpotLight( 0xffa95c, 1 );
        spotLight.position.set( -50, 50, 50);
        spotLight.castShadow = true;
        spotLight.shadow.bias = -0.00001;
        spotLight.shadow.mapSize.width = 1024 * 8;
        spotLight.shadow.mapSize.height = 1024 * 8;
        this.scene.add( spotLight );
        this.spotLight = spotLight;

        let dirLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        dirLight.position.set( 3, 10, 50 );
        dirLight.castShadow = false;
        this.scene.add( dirLight );
        
        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.7;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild( this.renderer.domElement );

        // camera
        let W = 540, H = 960;
        let AR = this.recorded ? window.innerWidth/window.innerHeight : W/H;
        this.camera = new THREE.PerspectiveCamera(60, AR, 0.01, 1000);
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.object.position.set(0.0, 3.4, 8);
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 50;
        this.controls.target.set(0.0, 2.6, 0);
        this.controls.update();

        // so the screen is not black while loading
        this.renderer.render( this.scene, this.camera );
        
        // Behaviour Planner
        this.eyesTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthWrite: false }) );
        this.eyesTarget.name = "eyesTarget";
        this.eyesTarget.position.set(0, 2.5, 15); 
        this.headTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0xff0000 , depthWrite: false }) );
        this.headTarget.name = "headTarget";
        this.headTarget.position.set(0, 2.5, 15); 
        this.neckTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0x00fff0 , depthWrite: false }) );
        this.neckTarget.name = "neckTarget";
        this.neckTarget.position.set(0, 2.5, 15); 

        this.scene.add(this.eyesTarget);
        this.scene.add(this.headTarget);
        this.scene.add(this.neckTarget);

        // Load the model
        this.loaderGLB.load( './data/anim/Signs.glb', (glb) => {

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
                    if (object.name == "Eyelashes")
                        object.castShadow = false;
                    if(object.material.map) object.material.map.anisotropy = 16; 
                    
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

            this.body = this.model.getObjectByName( 'BodyMesh' );
            this.eyelashes = this.model.getObjectByName( 'Eyelashes' );
            
            this.ECAcontroller = new CharacterController({character: this.model});
            this.ECAcontroller.start();

            // load the actual animation to play
            this.mixer = new THREE.AnimationMixer( this.model );

            glb.animations.forEach(( clip ) => {
                if (clip.name == "BSL - Communicate via App") {
                    this.mixer.clipAction(clip).setEffectiveWeight( 1.0 ).play();
                }
            });

            this.loadBVH('./data/anim/VGT Thanks.bvh');
            
            $('#loading').fadeOut(); //hide();
        } );
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
    }


    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        let delta = this.clock.getDelta();
        let et = this.clock.getElapsedTime();

        // if (firstframe) {
        //     this.clock.start();
        //     firstframe = false;
        //     requestAnimationFrame( this.animate.bind(this) );
        //     return;
        // }

        if (delta > 0.1) {
            this.clock.stop();
            this.clock.start();
            return;
        } else if (firstframe) {
            this.clock.stop();
            this.clock.start();
            firstframe = false;
        }

        //console.log("a: " + delta + ", b: " + et);

        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Update the animation mixer, the stats panel, and render this frame
        this.ECAcontroller.update(delta, et);
        let BSw = this.ECAcontroller.facialController._morphDeformers;
        this.body.morphTargetInfluences = BSw["Body"].morphTargetInfluences;
        this.eyelashes.morphTargetInfluences = BSw["Eyelashes"].morphTargetInfluences;
        
        let [x, y, z] = [... this.camera.position];
        this.spotLight.position.set( x + 10, y + 10, z + 10);
            
        this.renderer.render( this.scene, this.camera );
    }
    
    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

    loadBVH( filename ) {

        this.loaderBVH.load( filename , (result) => {
            
            let msg = {
                type: "behaviours",
                data: [
                    {
                        type: "faceLexeme",
                        start: 0.1,
                        attackPeak: 0.3,
                        relax: 4.1,
                        end: 4.4,
                        amount: 0.6,
                        lexeme: 'RAISE_BROWS'
                    },
                    {
                        type: "speech",
                        start: 0.1,
                        end: 0.4 ,
                        text: "mit",
                        speed: 5
                    },
                    {
                        type: "faceLexeme",
                        start: 0.5,
                        end: 1.0,
                        amount: 0.4,
                        lexeme: 'LIP_PUCKERER'
                    },
                    {
                        type: "speech",
                        start: 0.5,
                        end: 1.0,
                        text: "mmmmmm",
                        speed: 5
                    },
                    {
                        type: "speech",
                        start: 1.0,
                        end: 2.0,
                        text: "aaaa",
                        speed: 5
                    },
                    {
                        type: "faceLexeme",
                        start: 2.0,
                        end: 2.6,
                        amount: 0.4,
                        lexeme: 'LIP_PUCKERER'
                    },
                    {
                        type: "speech",
                        start: 2.0,
                        end: 2.6,
                        text: "mmmmmm",
                        speed: 5
                    },
                    {
                        type: "faceLexeme",
                        start: 2.6,
                        end: 3.0,
                        amount: 0.4,
                        lexeme: 'LIP_PUCKERER'
                    },
                    {
                        type: "speech",
                        start: 3.0,
                        end: 3.4,
                        text: "aaaa",
                        speed: 5
                    },
                    {
                        type: "speech",
                        start: 3.4,
                        end: 4.4,
                        text: "mmmmmm",
                        speed: 5
                    },
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
