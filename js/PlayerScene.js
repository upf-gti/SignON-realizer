import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { CharacterController } from './controllers/CharacterController.js'
import { GUI } from '../libs/lil-gui.module.min.js'
import { ShaderChunk } from './shaders.js'
let firstframe = true;

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class Player {

    constructor() {
        
        this.clock = new THREE.Clock(false);
        this.loaderBVH = new BVHLoader();
        this.loaderGLB = new GLTFLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.spotLight = null;
        this.pointLight = null;

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

        this.renderTarget = null;
        this.postScene = null;
        this.postCamera = null;
    }
    createPanel() {
        let gui = new GUI();
        let button = {add: () =>{ 
            // send the facial actions to do
            let msg = {
                type: "behaviours",
                data: [
                    // {
                    //     type: "gaze",
                    //     start: 0,
                    //     ready: 0.2,
                    //     relax: 3.3,
                    //     end: 3.5,
                    //     influence: "EYES",
                    //     target: "CAMERA"
                    // },
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

    drawBlocks( BehaviorManager , time) {

        // Stacks (should concide with BMLManager.BMLStacks order)
        var stacks = ["blink", "gaze", "face", "head", "headDir",
                    "speech", "lg"]; //gesture, poiting

        // Colors
        var colors = ["(0,255,0,", "(255,132,0,", "(0,0,255,",
                    "(255,255,0, 0.5)", "(255,0,0,0.5)", "(0,255,255,",
                    "(0,133,0,", "(255,0,255,","(255,63,0,",
                    "(255, 255, 127"];

        // Time scale
        var timescale = 20;

        let canvas = document.getElementById("blocks");
        // Viewport
        let gl = canvas.getContext("2d");

        canvas.width = canvas.parentElement.clientWidth;//canvas.width;
        var w = canvas.width 
        var h = canvas.height =  250;// canvas.height;
        
    	// ---------------- BML REALIZER----------------------------------
        // Blocks
        var blockStack = null;
        var bmlStacks = null;
        if (BehaviorManager){
            blockStack = BehaviorManager.stack;
            bmlStacks = BehaviorManager.BMLStacks;
        }
        
        
        // Base rectangle
        var psize = 0.3;
        var r={x:0,y:0,w:w,h:h};
        gl.fillStyle = "rgba(255,255,255,0.5)";
        gl.clearRect(r.x,r.y,r.w,r.h);
        gl.fillRect(r.x,r.y,r.w,r.h);
        
        // Row lines
        var maxTextWidth = 0;
        var numRows = stacks.length +1;
        gl.font= 14 * Math.max(h/600, 0.5) + "px Arial"; // Compensated
        for (var i = 0; i < numRows; i++){
            // Lines
            gl.strokeStyle = "rgba(0,0,0,0.3)";
            var height = i/numRows * (h - r.y) + r.y;
            gl.beginPath(); gl.moveTo(0, height); gl.lineTo(w, height); gl.stroke();
            height = (i+1.8)/numRows * (h - r.y) + r.y;
            gl.fillStyle = "rgba(0,0,0,1)";
            gl.fillText(stacks[i], 10, height);
            // Adaptive line
            var text = toString(stacks[i]);
            maxTextWidth = Math.max(gl.measureText(text).width, maxTextWidth);
        }
        
        // BMLPLANNER STATE
        /*if (BehaviorPlanner){
            gl.font= 10 * Math.max(h/600, 0.5) + "px Arial";
            gl.fillStyle = "rgba(0,0,0,0.5)";
            height = (-1+1.8)/numRows * (h - r.y) + r.y;
            gl.fillText(BehaviorPlanner.state, 40, height);
        }*/
        
        
        // Column line
        var firstColW = maxTextWidth * 0.5;
        gl.beginPath(); gl.moveTo(firstColW, r.y); gl.lineTo(firstColW, h); gl.stroke();
        
        // Blocks
        if (!blockStack)
            return;
        if (blockStack.length == 0)
            return;
        // Get global timestamp

        // Block rectangle
        var rr = {x: 0, y:0, w: 0, h: 0};
        for (var i = 0; i<blockStack.length; i++){
            var block = blockStack[i];
            var xB = firstColW + timescale * 10 * (block.startGlobalTime - time);
            var wB = timescale * 10 * Math.min((block.endGlobalTime - time), block.end);
            rr.x = Math.max(firstColW,xB);
            rr.y = r.y;
            rr.w = wB;
            rr.h = r.h;
            gl.strokeStyle = "rgba(0,0,0,0.6)";
            gl.lineWidth = 4;
            gl.strokeRect(rr.x,rr.y, rr.w, rr.h);
            // Add block id on top
            gl.font= 12 * Math.max(h/600, 0.5) + "px Arial"; // Compensated
            gl.fillStyle = "rgba(0,0,0,0.5)";
            gl.fillText(block.id, rr.x, 0.8/numRows * (h - r.y) + r.y);
        }
        // BML instruction rectangles
        for (var i = 0; i < stacks.length; i++){ // bmlStacks.length
            var bmlStack = bmlStacks[i];
            // Select color
            gl.fillStyle = "rgba" + colors[i] + "0.3)";
            for (var j = 0; j < bmlStack.length; j++){
            var bmlIns = bmlStack[j];
            if (bmlIns === undefined){
                console.log("Error in: ", stacks[i], bmlStack);
                return;
            }
            // Paint rectangle
            xB = firstColW + timescale * 10 * (bmlIns.startGlobalTime - time);
            wB = timescale * 10 * Math.min((bmlIns.endGlobalTime - time), bmlIns.end);
            rr.x = Math.max(firstColW,xB);
            rr.y = (i+1)/numRows * (h - r.y) + r.y;
            rr.w = Math.max(wB,0);
            rr.h = 1/numRows * (h - r.y);
            gl.fillRect(rr.x, rr.y, rr.w, rr.h);
            gl.lineWidth = 2;
            gl.strokeRect(rr.x, rr.y, rr.w, rr.h);
            }
        }
        
    }
    init(onLoaded) {
        //this.createPanel();
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0x2A2928 );
        this.scene.fog = new THREE.Fog( 0x2A2928, 100, 150 );
        
        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshPhongMaterial( { color: 0x151414, depthWrite: false } ) );
        ground.position.y = 0; // it is moved because of the mesh scale
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );
        
        // // lights
        // let hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        // hemiLight.position.set( 0, 20, 0 );
        // this.scene.add( hemiLight );

        // let spotLight = new THREE.SpotLight( 0xffa95c, 1 );
        // spotLight.position.set( -50, 50, 50);
        // spotLight.castShadow = true;
        // spotLight.shadow.bias = -0.00001;
        // spotLight.shadow.mapSize.width = 1024 * 8;
        // spotLight.shadow.mapSize.height = 1024 * 8;
        // this.scene.add( spotLight );
        // this.spotLight = spotLight;

        // let dirLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        // dirLight.position.set( 3, 10, 50 );
        // dirLight.castShadow = false;
        // this.scene.add( dirLight );

        let pointLight = new THREE.PointLight( 0xffa95c, 1 );
        pointLight.position.set( 0, 2.5, 8);
        pointLight.castShadow = true;
        pointLight.shadow.bias = -0.00001;
        pointLight.shadow.mapSize.width = 1024 * 8;
        pointLight.shadow.mapSize.height = 1024 * 8;
        this.scene.add( pointLight );
        this.pointLight = pointLight;
        
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

        // creates GIF encoder
        this.rendererVideo = new THREE.WebGLRenderer( { antialias: true } ); // aux renderer for desired W,H
        this.rendererVideo.setPixelRatio( window.devicePixelRatio );
        this.rendererVideo.setSize( W, H );
        this.rendererVideo.toneMapping = THREE.ACESFilmicToneMapping;
        this.rendererVideo.toneMappingExposure = 0.7;
        this.rendererVideo.outputEncoding = THREE.sRGBEncoding;
        this.rendererVideo.shadowMap.enabled = true;
        this.capturer = new CCapture( {
            name: 'signAnimation',
            format: 'webm',
            workersPath: './',
            framerate: 30,
            quality: 100,
        } );

        // so the screen is not black while loading
        this.renderer.render( this.scene, this.camera );
        
        // Behaviour Planner
        this.eyesTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthWrite: false }) );
        this.eyesTarget.name = "eyesTarget";
        this.eyesTarget.position.set(0, 2.5, 100); 
        this.headTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0xff0000 , depthWrite: false }) );
        this.headTarget.name = "headTarget";
        this.headTarget.position.set(0, 2.5, 100); 
        this.neckTarget = new THREE.Mesh( new THREE.SphereGeometry(0.5, 5, 16), new THREE.MeshPhongMaterial({ color: 0x00fff0 , depthWrite: false }) );
        this.neckTarget.name = "neckTarget";
        this.neckTarget.position.set(0, 2.5, 100); 

        this.scene.add(this.eyesTarget);
        this.scene.add(this.headTarget);
        this.scene.add(this.neckTarget);

        // Load the model
        this.loaderGLB.load( './data/anim/Eva_Y.glb', (glb) => {

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
            
            
            // Create a multi render target with Float buffers
            this.renderTarget = new THREE.WebGLMultipleRenderTargets(
                window.innerWidth * window.devicePixelRatio,
                window.innerHeight * window.devicePixelRatio,
                1
            );

            for ( let i = 0, il = this.renderTarget.texture.length; i < il; i ++ ) {

                this.renderTarget.texture[ i ].minFilter = THREE.NearestFilter;
                this.renderTarget.texture[ i ].magFilter = THREE.NearestFilter;
                this.renderTarget.texture[ i ].type = THREE.FloatType;

            }

            // Name our G-Buffer attachments for debugging

            this.renderTarget.texture[ 0 ].name = 'outColor0';
            // this.renderTarget.texture[ 1 ].name = 'outColor1';
           // this.renderTarget.texture[ 2 ].name = 'outColor2';
            
            
            // PostProcessing setup

            this.postScene = new THREE.Scene();
            this.postCamera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

            this.postScene.add( new THREE.Mesh(
                new THREE.PlaneGeometry( 2,2 ),
                new THREE.RawShaderMaterial( {
                    vertexShader: ShaderChunk.vertexShaderQuad(),
                    fragmentShader: ShaderChunk.fragmentShaderQuad(),
                    uniforms: {
                        t0: { value: this.renderTarget.texture[ 0 ] },
                        // t1: { value: this.renderTarget.texture[ 1 ] },
                        //t2: { value: this.renderTarget.texture[ 2 ] },
                    },
                    glslVersion: THREE.GLSL3
                } )
            ) );
            let uniforms =  THREE.UniformsLib.lights;
            
            const loader = new THREE.TextureLoader();

            const color_texture = loader.load( './data/Woman_Body_Diffuse.png', this.render.bind(this) );
            color_texture.wrapS = THREE.RepeatWrapping;
            color_texture.wrapT = THREE.RepeatWrapping;

            const specular_texture = loader.load( './data/Woman_Body_Specular.png', this.render.bind(this) );
            specular_texture.wrapT = THREE.RepeatWrapping;
            specular_texture.wrapS = THREE.RepeatWrapping;

            // const normal_texture = loader.load( 'textures/hardwood2_diffuse.jpg', render );
            // normal_texture.wrapS = THREE.RepeatWrapping;
            // normal_texture.wrapT = THREE.RepeatWrapping;

            const sss_texture = loader.load( './data/woman_body_sss.png', this.render.bind(this) );
            sss_texture.wrapS = THREE.RepeatWrapping;
            sss_texture.wrapT = THREE.RepeatWrapping;

            const transmitance_lut_texture = loader.load( './data/transmitance_lut.png',this.render.bind(this) );
            transmitance_lut_texture.wrapS = THREE.RepeatWrapping;
            transmitance_lut_texture.wrapT = THREE.RepeatWrapping;

            const specular_lut_texture = loader.load( './data/beckmann_lut.png', this.render.bind(this) );
            specular_lut_texture.wrapS = THREE.RepeatWrapping;
            specular_lut_texture.wrapT = THREE.RepeatWrapping;
            
            uniforms["u_specular"] =  {type: 'number', value: 1};
            uniforms["u_roughness"] =  {type: 'number', value: 1};
            uniforms["u_normalmap_factor"] =  {type: 'number', value: 1};
            uniforms["u_shadow_shrinking"] =  {type: 'number', value: 0.05};
            uniforms["u_translucency_scale"] =  {type: 'number', value: 150.0};
            uniforms["u_enable_translucency"] =  {type: 'boolean', value: true};
            // uniforms["u_color_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/Woman_Body_Diffuse.png")};
            // uniforms["u_specular_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/Woman_Body_Specular.png")};
            uniforms["u_normal_texture"] =  {type: "t", texture: this.model.getObjectByName("Body").material.normalMap};
            // uniforms["u_sss_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/woman_body_sss.png")};
            // uniforms["u_transmitance_lut_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/transmitance_lut.png"), wrap: THREE.CLAMP_TO_EDGE};
            // uniforms["u_specular_lut_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/beckmann_lut.png"), wrap: THREE.CLAMP_TO_EDGE};
            uniforms["u_color_texture"] =  {value: color_texture};
            uniforms["u_specular_texture"] =  {value : specular_texture};
            uniforms["u_sss_texture"] =  {value: sss_texture};
            uniforms["u_transmitance_lut_texture"] =  {value: transmitance_lut_texture};
            uniforms["u_specular_lut_texture"] =  {value: specular_lut_texture};
        

            let material =  new THREE.RawShaderMaterial({
                uniforms: uniforms,
                fragmentShader: ShaderChunk.fragmentShader(),
                vertexShader: ShaderChunk.vertexShader(),
                lights: true,
                glslVersion: THREE.GLSL3
            })
            material.colorWrite = true;
            material.extensions.drawBuffers = true;
            material.extensions.derivatives = true;
            
            //this.model.getObjectByName("Body").material = material;
            

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
            for ( let i = 0; i < expressions.length; i ++ ) {
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

            glb.animations.forEach(( clip ) => {
                if (clip.name == "LSE - Communicate via Player") {
                    this.mixer.clipAction(clip).setEffectiveWeight( 1.0 ).play();
                }
            });

            this.loadBVH('./data/anim/VGT Thanks.bvh');
            
            $('#loading').fadeOut(); //hide();
            this.clock.start()
            if(onLoaded)
                onLoaded(this);
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

        // if (delta > 0.1) {
        //     this.clock.stop();
        //     this.clock.start();
        //     return;
        // } else if (firstframe) {
        //     //this.capturer.start();
        //     //this.recording = true;
        //     this.clock.stop();
        //     this.clock.start();
        //     firstframe = false;
        // }

        //console.log("a: " + delta + ", b: " + et);

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
        
        let [x, y, z] = [... this.camera.position];
        //this.spotLight.position.set( x + 10, y + 10, z + 10);
        
        this.render();
        
        
        //this.drawBlocks(this.ECAcontroller.BehaviourManager, et)
    }
    render(){
        this.renderTarget.samples = 7;
        // render scene into target
        this.renderer.setRenderTarget( this.renderTarget );

        this.renderer.render( this.scene, this.camera );
        
        // render post FX
        this.renderer.setRenderTarget( null );
        this.renderer.render( this.postScene, this.postCamera );
    }
    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

    loadBVH( filename ) {

        this.loaderBVH.load( filename , (result) => {
            // for (let i = 0; i < result.clip.tracks.length; i++) {
            //     result.clip.tracks[i].name = result.clip.tracks[i].name.replaceAll(/[\]\[]/g,"").replaceAll(".bones","");
            // }
            // this.mixer.clipAction( result.clip ).setEffectiveWeight( 1.0 ).play();
            
            

            this.animate();
            // send the facial actions to do
            
            //this.mixer.update(0);
        } );
    }
}

// let player = new Player();
// player.init();

export { Player };
