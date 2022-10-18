import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { CharacterController } from './controllers/CharacterController.js'
import { GUI } from 'https://cdn.skypack.dev/lil-gui'

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class App {

    constructor() {
        
        this.clock = new THREE.Clock();
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

        this.msg = {};
        this.ECAcontroller = null;
        this.eyesTarget = null;
        this.headTarget = null;
        this.neckTarget = null;

        this.body = null;
        this.eyelashes = null;
    }
    createPanel() {
        let that = this;

        let gui = new GUI();
        
        let params = {
            colorChroma: 0x141455,
            colorClothes: 0xFFFFFF,
        } 

        gui.addColor(params, 'colorChroma').onChange( (e) => {
            that.scene.getObjectByName("Chroma").material.color.set(e);
        });
        gui.addColor(params, 'colorClothes').onChange( (e) => {
            that.model.getObjectByName("Tops").material.color.set(e);
        });

		let folder = gui.addFolder( 'Animations' );
        
        let folderAnims = {
            bslThanks() { 
                that.loadGLB('https://webglstudio.org/projects/signon/repository/files/signon/animations/Signs.glb', 'BSL - Thank You', () => {
                    that.msg = {
                        type: "behaviours",
                        data: [
                            {
                                type: "faceLexeme",
                                start: 0.5,
                                end: 4.5,
                                amount: 0.8,
                                lexeme: 'LOWER_BROWS'
                            },
                            {
                                type: "faceLexeme",
                                start: 0.3,
                                attackPeak: 0.8,
                                relax: 1.5,
                                end: 2.0,
                                amount: 0.4,
                                lexeme: 'LIP_CORNER_PULLER'
                            },
                            {
                                type: "speech",
                                start: 2.0,
                                end: 2.6,
                                text: "zenk iu",
                                speed: 7/0.6
                            },
                            {
                                type: "speech",
                                start: 3.0,
                                end: 4.2,
                                text: "dhats greit",
                                speed: 11/1.2
                            },
                        ]
                    };
                    that.ECAcontroller.processMsg(JSON.stringify(that.msg));
                });
            },
            bslApp() { that.loadGLB('https://webglstudio.org/projects/signon/repository/files/signon/animations/Signs.glb', 'BSL - Communicate via App'); },
			vgtThanks() { that.loadBVH('https://webglstudio.org/projects/signon/repository/files/signon/animations/VGT Thanks.bvh'); },
            vgtApp() { that.loadGLB('https://webglstudio.org/projects/signon/repository/files/signon/animations/Signs.glb', 'VGT - Communicate via App'); },
			islThanks() { that.loadBVH('https://webglstudio.org/projects/signon/repository/files/signon/animations/ISL Thanks.bvh'); },
            islApp() { that.loadGLB('https://webglstudio.org/projects/signon/repository/files/signon/animations/Signs.glb', 'ISL - Communicate via App'); },
			ngtThanks() { that.loadBVH('https://webglstudio.org/projects/signon/repository/files/signon/animations/NGT Thanks.bvh'); },
			sleThanks() { that.loadGLB('https://webglstudio.org/projects/signon/repository/files/signon/animations/Signs.glb', 'SLE - Thank You'); },
		};

        folder.add(folderAnims, 'bslThanks').name('BSL Thanks')
        folder.add(folderAnims, 'bslApp').name('BSL App')
        folder.add(folderAnims, 'vgtThanks').name('VGT Thanks (w/o NMFs)')
        folder.add(folderAnims, 'vgtApp').name('VGT App (w/o NMFs)')
        folder.add(folderAnims, 'islThanks').name('ISL Thanks (w/o NMFs)')
        folder.add(folderAnims, 'islApp').name('ISL App (w/o NMFs)')
        folder.add(folderAnims, 'ngtThanks').name('NGT Thanks (w/o NMFs)')
        folder.add(folderAnims, 'sleThanks').name('SLE Thanks (w/o NMFs)')
    
        folder = gui.addFolder( 'NMFs' );
        let folderNMFs = {
            blink: false,
        }
        folder.add(folderNMFs, 'blink').name('Blink')
    }

    init() {
        
        this.createPanel();
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xa0a0a0 );
        
        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshPhongMaterial( { color: 0x141414, depthWrite: true } ) );
        ground.position.y = -7; // it is moved because of the mesh scale
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );

        let backPlane = new THREE.Mesh( new THREE.PlaneGeometry( 50, 50 ), new THREE.MeshPhongMaterial( {color: 0x141455, side: THREE.DoubleSide} ) );
        backPlane.name = 'Chroma';
        backPlane.position.z = -7;
        backPlane.receiveShadow = true;
        this.scene.add( backPlane );
        
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
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.01, 1000);
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
                    if(object.material.map) 
                        object.material.map.anisotropy = 16;
                } else if (object.isBone) {
                    object.scale.set(1.0, 1.0, 1.0);
                }
            } );

            // correct "errors" regarding the avatar
            this.model.getObjectByName("Tops").material.color;
            this.model.getObjectByName("mixamorig_RightHand").scale.set( 0.85, 0.85, 0.85 );
            this.model.getObjectByName("mixamorig_LeftHand").scale.set( 0.85, 0.85, 0.85 );

            this.skeletonHelper = new THREE.SkeletonHelper( this.model );
            this.skeletonHelper.visible = false;
            this.scene.add(this.skeletonHelper);
            this.scene.add(this.model);

            this.model.eyesTarget = this.eyesTarget;
            this.model.headTarget = this.headTarget;
            this.model.neckTarget = this.neckTarget;

            this.body = this.model.getObjectByName( 'Body' );
            this.eyelashes = this.model.getObjectByName( 'Eyelashes' );
            
            this.ECAcontroller = new CharacterController( {character: this.model} );
            this.ECAcontroller.start();

            // load the actual animation to play
            this.mixer = new THREE.AnimationMixer( this.model );
            this.mixer.addEventListener('loop', () => this.ECAcontroller.processMsg(JSON.stringify(this.msg)));

            this.animate();
            $('#loading').fadeOut(); //hide();
        } );
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
    }


    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        let delta = this.clock.getDelta();
        let et = this.clock.getElapsedTime();

        if (this.mixer) {
            this.mixer.update(delta);
        }

        this.ECAcontroller.update(delta, et);
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

    loadBVH( filename, callback=null ) {

        this.loaderBVH.load( filename , (result) => {
            
            for (let i = 0; i < result.clip.tracks.length; i++) {
                result.clip.tracks[i].name = result.clip.tracks[i].name.replaceAll(/[\]\[]/g,"").replaceAll(".bones","");
            }

            this.mixer.stopAllAction();
            this.mixer._actions.length = 0;

            let anim = this.mixer.clipAction( result.clip );
            anim.setEffectiveWeight( 1.0 ).play();
            this.mixer.update(0);

            if (callback) {
                callback();
            }
        } );
    }

    loadGLB( filename, anim, callback=null ) {

        this.loaderGLB.load( filename , (result) => {
            
            result.animations.forEach(( clip ) => {
                if (clip.name == anim) {

                    for (let i = 0; i < clip.tracks.length; i++) {
                        clip.tracks[i].name = clip.tracks[i].name.replaceAll(/[\]\[]/g,"").replaceAll(".bones","");
                    }

                    this.mixer.stopAllAction();
                    this.mixer._actions.length = 0;

                    let anim = this.mixer.clipAction( clip );
                    anim.setEffectiveWeight( 1.0 ).play();
                    this.mixer.update(0);

                    if (callback) {
                        callback();
                    }
                }
            });
        } );
    }
}

let app = new App();
app.init();

export { app };
