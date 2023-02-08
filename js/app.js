import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/RGBELoader.js';
import { GUI } from 'https://cdn.skypack.dev/lil-gui'
import { CharacterController } from './controllers/CharacterController.js'

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

        this.eyesTarget = null;
        this.headTarget = null;
        this.neckTarget = null;
        
        // current model selected
        this.model = null;
        this.ECAcontroller = null;
        this.mixer = null;
        this.skeletonHelper = null;

        this.msg = {};
    }

    createPanel() {

        let that = this;

        let gui = new GUI();

        
        let params = {
            colorChroma: 0x141455,
            colorClothes: 0xFFFFFF,
        } 
                
        // get init color and set them to sGRB (css works in sRGB) 
        let color = new THREE.Color();
        color.copyLinearToSRGB(that.scene.getObjectByName("Chroma").material.color);
        params.colorChroma = color.getHex();

        color.copyLinearToSRGB(that.model1.getObjectByName("Tops").material.color);
        params.colorClothes = color.getHex();


        gui.addColor(params, 'colorChroma').onChange( (e) => {
            let color = that.scene.getObjectByName("Chroma").material.color; // css works in sRGB
            color.setHex(e);
            color.copySRGBToLinear(color); // material.color needs to be in linearSpace
        });
        gui.addColor(params, 'colorClothes').onChange( (e) => {
            let color = that.model1.getObjectByName("Tops").material.color; // css works in sRGB
            color.setHex(e);
            color.copySRGBToLinear(color); // material.color needs to be in linearSpace

            color = that.model2.getObjectByName("Tops").material.color; // css works in sRGB
            color.setHex(e);
            color.copySRGBToLinear(color); // material.color needs to be in linearSpace
        });

		let folder = gui.addFolder( 'Animations' );
  

        let folderAnims = {
/*            happyISLday() {
                that.loadGLB('https://webglstudio.org/projects/signon/repository/files/signon/animations/Happy ISL Day.glb', 'ISL - Happy ISL Day', () => {
                    that.msg = {
                        type: "behaviours",
                        data: [
                            {
                                type: "faceLexeme",
                                start: 0.3,
                                attackPeak: 0.7,
                                relax: 3.5,
                                end: 4.5,
                                amount: 0.5,
                                lexeme: 'RAISE_BROWS'
                            },
                            {
                                type: "faceEmotion",
                                start: 0.3,
                                attackPeak: 0.7,
                                relax: 3.9,
                                end: 5.1,
                                amount: 0.3,
                                emotion: "HAPPINESS",
                            },
                            {
                                type: "speech",
                                start: 0.3,
                                end: 1.3,
                                text: "aaaaa pii",
                                speed: 9/1.3,
                            },
                            {
                                type: "speech",
                                start: 1.6,
                                end: 2.2,
                                text: "aaaaii",
                                speed: 6/0.7
                            },
                            {
                                type: "speech",
                                start: 2.2,
                                end: 2.6,
                                text: "ssss",
                                speed: 4/0.4
                            },
                            {
                                type: "speech",
                                start: 2.6,
                                end: 3.0,
                                text: "llll",
                                speed: 4/0.4
                            },
                            {
                                type: "speech",
                                start: 3.1,
                                end: 3.6,
                                text: "de",
                                speed: 2/0.5
                            },
                        ]
                    }; 
                    that.ECAcontroller.reset();
                    that.ECAcontroller.processMsg(JSON.stringify(that.msg));
                });
            },
            ngt7(){ 
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "speech",
                            start: 0.4,
                            text: that.wordsToArpa("vergadering"),
                            speed: 12,
                            sentInt: 0.8
                        },
                        {   type: "speech",
                            start: 1.7,
                            text: that.wordsToArpa("wanneer") + ".",
                            speed: 12,
                            sentInt: 0.8
                        },
                ]};
                that.ECAcontroller.reset();
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
*/


            fist(){
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "fist", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            finger2(){
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "finger2", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            finger23(){
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "finger23", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            finger23spread(){
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "finger23spread", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            finger2345(){
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "finger2345", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            flat(){
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "flat", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },

            pinch12() {
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "pinch12", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            pinch12open() {
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "pinch12open", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            pinchall() {
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "pinchall", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            ceeall() {
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "ceeall", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            cee12() { 
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "cee12", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            cee12open() {
                that.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "gesture", start: 0.0, end: 0.5, handshape: "cee12open", hand: 1 },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            }


		};

 /*       folder.add(folderAnims, 'happyISLday').name('Happy ISL Day');

        folder.add(folderAnims, 'ngt7').name("7 vergadering wanneer");
*/


        folder.add(folderAnims, "fist").name("fist");
        folder.add(folderAnims, "finger2").name("finger2");
        folder.add(folderAnims, "finger23").name("finger23");
        folder.add(folderAnims, "finger23spread").name("finger23spread");
        folder.add(folderAnims, "finger2345").name("finger2345");
        folder.add(folderAnims, "flat").name("flat");

        folder.add(folderAnims, "pinch12").name("pinch12");
        folder.add(folderAnims, "pinch12open").name("pinch12open");
        folder.add(folderAnims, "pinchall").name("pinchall");
        folder.add(folderAnims, "ceeall").name("ceeall");
        folder.add(folderAnims, "cee12").name("cee12");
        folder.add(folderAnims, "cee12open").name("cee12open");
        
    }

    // loads dictionary for mouthing purposes. Not synchronous.
    loadMouthingDictinoary(){
        let that = this;
               
        fetch("data/phonetics/nl_ipa.txt").then(x => x.text()).then(function(text){ 

            let texts = text.split("\n");
            let IPADict = {}; // keys: plain text word,   value: ipa transcription
            let ARPADict = {}; // keys: plain text word,   value: arpabet transcription
            
            //https://www.researchgate.net/figure/1-Phonetic-Alphabet-for-IPA-and-ARPAbet-symbols_tbl1_2865098                
            let ipaToArpa =  {
                // symbols
                "'": "", // primary stress
                '.': " ", // syllable break
                
                // vowels
                'a': "a",   'ɑ': "a",   'ɒ': "a", 
                'œ': "@",   'ɛ': "E",   'ɔ': "c",
                'e': "e",   'ø': "e",   'ə': "x",   'o': "o",  
                'ɪ': "I",   'i': "i",   'y': "i",   'u': "u",   'ʉ': "u",

                // consonants
                'x': "k",   'j': "y",   't': "t",   'p': "p",   'l': "l",   'ŋ': "G", 
                'k': "k",   'b': "b",   's': "s",   'ʒ': "Z",   'm': "m",   'n': "n", 
                'v': "v",   'r': "r",   'ɣ': "g",   'f': "f",   'ʋ': "v",   'z': "z", 
                'h': "h",   'd': "d",   'ɡ': "g",   'ʃ': "S",   'ʤ': "J"
            };
            let errorPhonemes = {};


            for(let i = 0; i < texts.length; ++i){
                let a = texts[i].replace("\t", "").split("\/");
                if (a.length < 2 || a[0].length == 0 || a[1].length == 0 ){ continue; }

                IPADict[ a[0] ] = a[1];

                let ipa = a[1];
                let arpa = "";

                // convert each IPA character into correpsonding ARPABet
                for( let j = 0; j < ipa.length; ++j ){
                    if ( ipa[j] == 'ː' || ipa[j] == ":" ) { arpa += arpa[arpa.length-1]; continue; }
                    let s = ipaToArpa[ ipa[j] ];
                    if ( s != undefined ){ arpa += s; continue; }
                    errorPhonemes[ s ];
                }

                ARPADict[ a[0] ] = arpa; 

            }

            if ( Object.keys(errorPhonemes).length > 0 ){ console.error( "MOUTHING: loading phonetics: unmapped IPA phonemes to ARPABET: \n", errorPhonemes ); }

            that.PHONETICS = {};
            that.PHONETICS.word2IPA = IPADict;
            that.PHONETICS.word2ARPA = ARPADict;

        });
    }

    // convert plain text into phoneme encoding ARPABet-1-letter. Uses dictionaries previously loaded 
    wordsToArpa ( phrase ){
        
        let words = phrase.replace(",", "").replace(".", "").split(" ");

        let result = "";
        let unmappedWords = [];
        for ( let i = 0; i < words.length; ++i ){
            let r = this.PHONETICS.word2ARPA[ words[i] ] ;
            if ( r ){ result += " " + r; }
            else{ unmappedWords.push( words[i]); }
        }
        if ( unmappedWords.length > 0 ){ console.error("MOUTHING: phrase: ", phrase, "\nUnknown words: ",JSON.stringify(unmappedWords)); }
        return result;
    
    }

    init() {

        this.loadMouthingDictinoary();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xa0a0a0 );
        //const gridHelper = new THREE.GridHelper( 10, 10 );
        //gridHelper.position.set(0,0.001,0);
        //this.scene.add( gridHelper );
                
        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.gammaInput = true; // applies degamma to textures ( not applied to material.color and roughness, metalnes, etc. Only to colour textures )
        this.renderer.gammaOutput = true; // applies gamma after all lighting operations ( which are done in linear space )
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild( this.renderer.domElement );

        // camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.01, 1000);
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.object.position.set(0.0, 1.5, 1);
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 7;
        this.controls.target.set(0.0, 1.3, 0);
        this.controls.update();
        
        // IBL Light
        // var that = this;

        // new RGBELoader()
        //     .setPath( 'data/hdrs/' )
        //     .load( 'cafe.hdr', function ( texture ) {

        //         texture.mapping = THREE.EquirectangularReflectionMapping;

        //         // that.scene.background = texture;
        //         that.scene.environment = texture;

        //         that.renderer.render( that.scene, that.camera );
        // } );

        // include lights
        let hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.2 );
        this.scene.add( hemiLight );

        let keySpotlight = new THREE.SpotLight( 0xffffff, 0.4, 0, 45 * (Math.PI/180), 0.5, 1 );
        keySpotlight.position.set( 0.5, 2, 2 );
        keySpotlight.target.position.set( 0, 1, 0 );
        keySpotlight.castShadow = true;
        keySpotlight.shadow.mapSize.width = 1024;
        keySpotlight.shadow.mapSize.height = 1024;
        keySpotlight.shadow.bias = 0.00001;
        this.scene.add( keySpotlight.target );
        this.scene.add( keySpotlight );

        let fillSpotlight = new THREE.SpotLight( 0xffffff, 0.2, 0, 45 * (Math.PI/180), 0.5, 1 );
        fillSpotlight.position.set( -0.5, 2, 1.5 );
        fillSpotlight.target.position.set( 0, 1, 0 );
        fillSpotlight.castShadow = true;
        this.scene.add( fillSpotlight.target );
        this.scene.add( fillSpotlight );

        let dirLight = new THREE.DirectionalLight( 0xffffff, 0.2 );
        dirLight.position.set( 1.5, 5, 2 );
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.left= -1;
        dirLight.shadow.camera.right= 1;
        dirLight.shadow.camera.bottom= -1;
        dirLight.shadow.camera.top= 1;
        dirLight.shadow.bias = 0.00001;
        dirLight.castShadow = true;
        this.scene.add( dirLight );

        // add entities
        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshStandardMaterial( { color: 0x141414, depthWrite: true, roughness: 1, metalness: 0 } ) );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );
        
        let backPlane = new THREE.Mesh( new THREE.PlaneGeometry( 7, 6 ), new THREE.MeshStandardMaterial( {color: 0x141455, side: THREE.DoubleSide, roughness: 1, metalness: 0 } ) );
        backPlane.name = 'Chroma';
        backPlane.position.z = -1;
        backPlane.receiveShadow = true;
        this.scene.add( backPlane );
        
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

        // loads a model
        function loadModel ( nameString, callback, glb ) {
            let model = this["model"+nameString] = glb.scene;

            model = glb.scene;
            model.rotateOnAxis( new THREE.Vector3(1,0,0), -Math.PI/2 );
            model.castShadow = true;
            
            model.traverse( (object) => {
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

            let skeletonHelper = this[ "skeletonHelper" + nameString ] = new THREE.SkeletonHelper( model );
            skeletonHelper.visible = false;
            this.scene.add(skeletonHelper);
            this.scene.add(model);

            model.eyesTarget = this.eyesTarget;
            model.headTarget = this.headTarget;
            model.neckTarget = this.neckTarget;

            let ECAcontroller = this[ "ECAcontroller" + nameString ] = new CharacterController( {character: model} );
            ECAcontroller.start();

            // load the actual animation to play
            let mixer = this[ "mixer" + nameString ] = new THREE.AnimationMixer( model );
            mixer.addEventListener('loop', () => { ECAcontroller.reset(); ECAcontroller.processMsg(JSON.stringify(this.msg)); } );

            if ( callback ){ callback (); }

        }

        function loadfinished() {
            this.model1.position.set(0.05, 0.96, 0 );
            let q = new THREE.Quaternion();
            q.setFromAxisAngle( new THREE.Vector3(1,0,0), -5 * Math.PI /180 ); // slightly tilted on x axis
            this.model1.quaternion.premultiply(q); 
            q.setFromAxisAngle( new THREE.Vector3(0,0,1), 2 * Math.PI /180 ); // slightly tilted on z axis
            this.model1.quaternion.premultiply(q); 

            this.model2.position.set(0, 0., 0);

            this.switchModel( this.model1 );

            this.createPanel();
            this.animate();
            $('#loading').fadeOut(); //hide();
        }

        // Load both models "synchronous". model1 = eva_Y    model2 = Signs
        this.loaderGLB.load( './data/anim/Eva_Y.glb', 
            loadModel.bind( this, "1",  
                    ()=>this.loaderGLB.load( './data/anim/Signs.glb', loadModel.bind( this, "2", loadfinished.bind(this)) )  
            ) 
        );

        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
    }

    switchModel ( visibleModel ) {
        // could be done with arrays but it is just a demo...
        if ( visibleModel === this.model1 ){
            this.model = this.model1;
            this.ECAcontroller = this.ECAcontroller1;
            this.mixer = this.mixer1;
            this.skeletonHelper = this.skeletonHelper1;
    
            this.model1.visible = true;
            this.model2.visible = false;
        }
        else {
            this.model = this.model2;
            this.ECAcontroller = this.ECAcontroller2;
            this.mixer = this.mixer2;
            this.skeletonHelper = this.skeletonHelper2;
    
            this.model1.visible = false;
            this.model2.visible = true;
        }

    }

    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        let delta = this.clock.getDelta();
        let et = this.clock.getElapsedTime();

        if ( this.mixer ) { this.mixer.update(delta); }
        if ( this.ECAcontroller ){ this.ECAcontroller.update(delta, et); }

        // correct hand's size
        this.model.getObjectByName("mixamorig_RightHand").scale.set( 0.85, 0.85, 0.85 );
        this.model.getObjectByName("mixamorig_LeftHand").scale.set( 0.85, 0.85, 0.85 );

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
            
            this.switchModel( this.model1 ); // use signs model
            this.ECAcontroller.reset(); // reset face status
            this.msg = {};
            
            this.mixer.stopAllAction();
            this.mixer._actions.length = 0;
            this.mixer.timeScale = 1;
            
            let anim = this.mixer.clipAction( result.clip );
            anim.setEffectiveWeight( 1.0 ).play();
            this.mixer.update(0);
            
            // reset clock to avoid counting loading time as dt in update
            this.clock.stop();
            this.clock.start();
            this.ECAcontroller.time = 0;


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

                    this.switchModel( this.model2 ); // use signs model
                    this.ECAcontroller.reset(); // reset face status
                    this.msg = {};
                    
                    this.mixer.stopAllAction();
                    this.mixer._actions.length = 0;
                    this.mixer.timeScale = 1;
                    
                    let anim = this.mixer.clipAction( clip );
                    anim.setEffectiveWeight( 1.0 ).play();
                    this.mixer.update(0);
                    
                    // reset clock to avoid counting loading time as dt in update
                    this.clock.stop();
                    this.clock.start();
                    this.ECAcontroller.time = 0;

                    if (callback) {
                        callback();
                    }

                }
            });
        });
    }
}

let app = new App();
app.init();
window.global = {app:app};
export { app };
