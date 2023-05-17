
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js'; 
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

import { CharacterController } from './controllers/CharacterController.js';
import { TIMESLOT, sigmlStringToBML } from './sigml/SigmlToBML.js';
import { AppGUI } from './gui.js';

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class App {

    constructor() {
        
        this.fps = 0;
        this.clock = new THREE.Clock();
        this.loaderGLB = new GLTFLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        
        this.model = null;
        this.ECAcontroller = null;
        this.eyesTarget = null;
        this.headTarget = null;
        this.neckTarget = null;
        
        this.msg = {};

        this.languageDictionaries = {}; // key = NGT, value = { glosses: {}, word2ARPA: {} }
        this.selectedLanguage = "NGT";
    }

    // entry point of data from the mobile app. "Synchronous"
    async processMessage( data ){
        // check there is a gloss to file dictionary
        if ( !this.languageDictionaries[ this.selectedLanguage ] || !this.languageDictionaries[ this.selectedLanguage ].glosses ){ return; }

        let glosses = [];
        // received data is a json in string format
        try{
            let json = data;
            if ( typeof( data ) == "string" ){ json = JSON.parse( data ); }

            let intermediateRepresentation = json.IntermediateRepresentation;
            if ( typeof( intermediateRepresentation ) == "string" ){ intermediateRepresentation = JSON.parse( json.IntermediateRepresentation ); }
            glosses = intermediateRepresentation.glosses;
        } catch ( error ){
            glosses = [];
        }

        // check whether there is something to do
        if ( !glosses || glosses.length < 1 ){
            // TODO DEFAULT SKIPPING SIGN MESSAGE
            return;
        }


        // for each gloss, fetch its sigml file, convert it into bml
        let orders = [];
        let time = 0;
        let glossesDictionary = this.languageDictionaries[ this.selectedLanguage ].glosses;
        for( let i = 0; i < glosses.length; ++i ){
            let glossFile = glossesDictionary[ glosses[i] ];
            if ( !glossFile ){ 
                // TODO DEFAULT SKIPPING SIGN MESSAGE
                time += 3; continue; 
            }

            await fetch( "data/dictionaries/NGT/Glosses/" + glossFile ).then(x=>x.text()).then( (text) =>{ 
                let extension = glossFile.split(".");
                extension = extension[ extension.length - 1 ];
                if ( extension == "bml" ){
                    try{ 
                        let result = JSON.parse( text );
                        let maxDuration = 0;
                        for( let b = 0; b < result.length; ++b ){
                            let bml = result[b];
                            if( !isNaN( bml.start ) ){ bml.start += time; }
                            if( !isNaN( bml.ready ) ){ bml.ready += time; }
                            if( !isNaN( bml.attackPeak ) ){ bml.attackPeak += time; }
                            if( !isNaN( bml.relax ) ){ bml.relax += time; }
                            if( !isNaN( bml.end ) ){ 
                                if ( maxDuration < bml.end ){ maxDuration = bml.end; } 
                                bml.end += time; 
                            }
                        }
                        orders = orders.concat( result );
                        time += maxDuration;
                    }catch(e){ console.log( "bml parse error in file: " + glossFile ); }
                }else {
                    let result = sigmlStringToBML( text, time );
                    orders = orders.concat(result.data);
                    time += result.duration; 
                    if ( i < ( glosses.length - 1 ) ){ 
                        time = time - TIMESLOT.DEF - 0.5 * TIMESLOT.DEF; // if not last, remove relax-end stage and partially remove the peak-relax (*1.85 )
                    }
                }
            } ).catch(e =>{ console.log("failed at loading dictionary file: " + glossFile) } );
        }


        // give the orders to the avatar controller 
        let msg = {
            type: "behaviours",
            data: orders
        };
        this.ECAcontroller.processMsg(JSON.stringify(msg));
    }


    // loads dictionary for mouthing purposes. Not synchronous.
    loadMouthingDictinoary( language ){
        let that = this;
               
        fetch("data/dictionaries/" + language + "/IPA/ipa.txt").then(x => x.text()).then(function(text){ 

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

            that.languageDictionaries[ language ].word2ARPA = ARPADict;

        });
    }

    // convert plain text into phoneme encoding ARPABet-1-letter. Uses dictionaries previously loaded 
    wordsToArpa ( phrase, language = "NGT" ){
        
        if ( !this.languageDictionaries[ language ] || !this.languageDictionaries[ language ].word2ARPA ){
            console.warn( "missing word-ARPABET dictionary for " + language );
            return "";
        }
        let word2ARPA = this.languageDictionaries[ language ].word2ARPA;
        let words = phrase.replace(",", "").replace(".", "").split(" ");

        let result = "";
        let unmappedWords = [];
        for ( let i = 0; i < words.length; ++i ){
            let r = word2ARPA[ words[i] ] ;
            if ( r ){ result += " " + r; }
            else{ unmappedWords.push( words[i]); }
        }
        if ( unmappedWords.length > 0 ){ console.error("MOUTHING: phrase: ", phrase, "\nUnknown words: ",JSON.stringify(unmappedWords)); }
        return result;
    
    }

    loadLanguageDictionaries( language ){
        this.languageDictionaries[ language ] = { glosses: null, wordsToArpa: null };

        this.loadMouthingDictinoary( language );

        fetch( "data/dictionaries/" + language + "/Glosses/_glossesDictionary.txt").then( (x)=>x.text() ).then( (file) =>{
            let glossesDictionary = this.languageDictionaries[ language ].glosses = {};
            let lines = file.split("\n");
            for( let i = 0; i < lines.length; ++i ){
                if ( !lines[i] || lines[i].length < 1 ){ continue; }
                let map = lines[i].split("\t");
                if ( map.length < 2 ){ continue; }
                glossesDictionary[ map[0] ] = map[1].replace("\r", "").replace("\n", "");
            }
        } );

    }

    init() {

        this.loadLanguageDictionaries( "NGT" );

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
        this.renderer.shadowMap.enabled = false;
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
        // keySpotlight.castShadow = true;
        // keySpotlight.shadow.mapSize.width = 1024;
        // keySpotlight.shadow.mapSize.height = 1024;
        // keySpotlight.shadow.bias = 0.00001;
        this.scene.add( keySpotlight.target );
        this.scene.add( keySpotlight );

        let fillSpotlight = new THREE.SpotLight( 0xffffff, 0.2, 0, 45 * (Math.PI/180), 0.5, 1 );
        fillSpotlight.position.set( -0.5, 2, 1.5 );
        fillSpotlight.target.position.set( 0, 1, 0 );
        // fillSpotlight.castShadow = true;
        this.scene.add( fillSpotlight.target );
        this.scene.add( fillSpotlight );

        let dirLight = new THREE.DirectionalLight( 0xffffff, 0.2 );
        dirLight.position.set( 1.5, 5, 2 );
        // dirLight.shadow.mapSize.width = 1024;
        // dirLight.shadow.mapSize.height = 1024;
        // dirLight.shadow.camera.left= -1;
        // dirLight.shadow.camera.right= 1;
        // dirLight.shadow.camera.bottom= -1;
        // dirLight.shadow.camera.top= 1;
        // dirLight.shadow.bias = 0.00001;
        // dirLight.castShadow = true;
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
        this.eyesTarget = new THREE.Object3D(); //THREE.Mesh( new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthWrite: false }) );
        this.eyesTarget.name = "eyesTarget";
        this.eyesTarget.position.set(0, 2.5, 15); 
        this.headTarget = new THREE.Object3D(); //THREE.Mesh( new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshPhongMaterial({ color: 0xff0000 , depthWrite: false }) );
        this.headTarget.name = "headTarget";
        this.headTarget.position.set(0, 2.5, 15); 
        this.neckTarget = new THREE.Object3D(); //THREE.Mesh( new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshPhongMaterial({ color: 0x00fff0 , depthWrite: false }) );
        this.neckTarget.name = "neckTarget";
        this.neckTarget.position.set(0, 2.5, 15); 

        this.scene.add(this.eyesTarget);
        this.scene.add(this.headTarget);
        this.scene.add(this.neckTarget);

        this.loaderGLB.load( './data/EvaHandsEyesFixed.glb', (glb) => {
            let model = this.model = glb.scene;
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

            this.scene.add(model);

            model.eyesTarget = this.eyesTarget;
            model.headTarget = this.headTarget;
            model.neckTarget = this.neckTarget;

            let ECAcontroller = this.ECAcontroller = new CharacterController( {character: model} );
            ECAcontroller.start();
            ECAcontroller.reset();
            ECAcontroller.processMsg( JSON.stringify( { control: 2 } )); // speaking
        
            if ( AppGUI ) { this.gui = new AppGUI( this ); }
            this.animate();
            $('#loading').fadeOut(); //hide();
        
    
        });

        window.addEventListener( 'resize', this.onWindowResize.bind(this) );

    }

    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        let delta = this.clock.getDelta();
        let et = this.clock.getElapsedTime();

        this.fps = Math.floor( 1.0 / ((delta>0)?delta:1000000) );
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

}

let app = new App();
app.init();
window.global = {app:app};
export { app };
