import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { CharacterController } from './controllers/CharacterController.js'

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
    
    init() {

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xa0a0a0 );
        this.scene.fog = new THREE.Fog( 0xa0a0a0, 100, 150 );
        
        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.position.y = -7; // it is moved because of the mesh scale
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );
        
        // lights
        let aLight = new THREE.AmbientLight( 0x404040, 0.4 ); // soft white light
        this.scene.add( aLight );

        let hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444, 0.4 );
        hemiLight.position.set(0, 10, 0);
        this.scene.add( hemiLight );

        let keyLight = new THREE.SpotLight( 0xffffff, 0.9, 100,  );
        keyLight.position.set( 7, 15, 11 ); //.set( 8, 10, 15 );
        keyLight.castShadow = true;
        keyLight.shadow.bias = -0.000001;
        keyLight.shadow.mapSize.width = 1024 * 8;
        keyLight.shadow.mapSize.height = 1024 * 8;
        this.scene.add( keyLight );

        let targetKey = new THREE.Object3D();
        targetKey.position.set( -0, 0, -0 );
        keyLight.target = targetKey;
        this.scene.add( keyLight.target );

        let fillLight = new THREE.SpotLight( 0xffffff, 0.5, 100 );
        fillLight.position.set( -7, 15, -11 );
        fillLight.castShadow = true;
        fillLight.shadow.bias = -0.0001;
        fillLight.shadow.mapSize.width = 1024 * 2;
        fillLight.shadow.mapSize.height = 1024 * 2;
        this.scene.add( fillLight );

        let targetFill = new THREE.Object3D();
        targetFill.position.set( 0, 0, 0 );
        fillLight.target = targetFill;
        this.scene.add( fillLight.target );
        
        let rimLight = new THREE.SpotLight( 0xffffff, 0.2, 100 );
        rimLight.position.set( 0, 12, -4 );
        rimLight.castShadow = true;
        rimLight.shadow.bias = -0.0001;
        rimLight.shadow.mapSize.width = 1024 * 2;
        rimLight.shadow.mapSize.height = 1024 * 2;
        this.scene.add( rimLight );

        let targetRim = new THREE.Object3D();
        targetRim.position.set( 0, 3, 0 );
        rimLight.target = targetRim;
        this.scene.add( rimLight.target );

        let sideLight = new THREE.SpotLight( 0xffffff, 0.3, 100 );
        sideLight.position.set( -4, 12, 6 );
        sideLight.castShadow = true;
        sideLight.shadow.bias = -0.0001;
        sideLight.shadow.mapSize.width = 1024 * 2;
        sideLight.shadow.mapSize.height = 1024 * 2;
        this.scene.add( sideLight );

        let targetSide = new THREE.Object3D();
        targetSide.position.set( 0, 3, 0 );
        sideLight.target = targetSide;
        this.scene.add( sideLight.target );

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
        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth/window.innerHeight, 0.01, 1000 );
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.object.position.set(0.0, 3.4, 8);
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 100;
        this.controls.target.set(0.0, 2.6, 0);
        this.controls.update();

        // so the screen is not black while loading
        this.renderer.render( this.scene, this.camera );
        
        // Behaviour Planner
        this.eyesTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthWrite: true }) );
        this.eyesTarget.name = "eyesTarget";
        this.eyesTarget.position.set(0, 2.5, 15); 
        this.headTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0xff0000 , depthWrite: true }) );
        this.headTarget.name = "headTarget";
        this.headTarget.position.set(0, 2.5, 15); 
        this.neckTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0x00fff0 , depthWrite: true }) );
        this.neckTarget.name = "neckTarget";
        this.neckTarget.position.set(0, 2.5, 15); 

        this.scene.add(this.eyesTarget);
        this.scene.add(this.headTarget);
        this.scene.add(this.neckTarget);

        // Load the model
        this.loaderGLB.load( 'data/Eva_Y.glb', (glb) => {

            this.model = glb.scene;
            this.model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            this.model.position.set(0, 0.75, 0);
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

            this.body = this.model.getObjectByName( 'Body' );
            if(!this.body)
                this.body = this.model.getObjectByName( 'BodyMesh' );
            this.eyelashes = this.model.getObjectByName( 'Eyelashes' );

            let additiveActions = {};
            const expressions = Object.keys( this.body.morphTargetDictionary );
            for ( let i = 0; i < expressions.length; i++ ) {
                additiveActions[expressions[i]] = {weight: this.body.morphTargetInfluences[i]}
            }
            
            this.ECAcontroller = new CharacterController({character: this.model});
            var morphTargets = { 
                'Body': {dictionary: this.body.morphTargetDictionary, weights: this.body.morphTargetInfluences, map: additiveActions},
                'Eyelashes': {dictionary: this.eyelashes.morphTargetDictionary, weights: this.eyelashes.morphTargetInfluences, map: additiveActions}
            }
            this.ECAcontroller.onStart();
            
            // load the actual animation to play
            this.mixer = new THREE.AnimationMixer( this.model );
            this.loadBVH('data/anim/NGT Thanks.bvh');
            
            $('#loading').fadeOut();
        } );            
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        document.addEventListener( 'keydown', this.onKeyDown.bind(this) );
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

        if (this.mixer) {
            this.mixer.update(delta);
        }

        this.ECAcontroller.time = et;
        // Update the animation mixer, the stats panel, and render this frame
        this.ECAcontroller.facialController.onUpdate(delta, et, this.ECAcontroller.onUpdate.bind(this.ECAcontroller) );
        //this.ECAcontroller.onUpdate(dt, et);
        let BSw = this.ECAcontroller.facialController._morphDeformers;
        this.body.morphTargetInfluences = BSw["Body"].morphTargetInfluences;
        this.eyelashes.morphTargetInfluences = BSw["Eyelashes"].morphTargetInfluences;
            
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
