import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/RGBELoader.js';
import { GUI } from 'https://cdn.skypack.dev/lil-gui'
import { CharacterController } from './controllers/CharacterController.js'


import { rotationTable as extfidirTable } from './sigml/Extfidir.js';
import { nearArmPosesTable } from './sigml/LocationArm.js';

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

        this.fps = 0;
    }

    createPanel() {

        let that = this;

        let gui = new GUI();

        gui.add(this, "fps").name("fps").listen().disable();
        
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

        let moodFolder = gui.addFolder( "Moods" ).close();
        let armFolder = gui.addFolder( 'Arm Gestures' ).close();
        let handShapeFolder = gui.addFolder( 'Handshape Gestures' ).close();
        let palmorFolder = gui.addFolder( 'Palmor Gestures' ).close();
        let extfidirFolder = gui.addFolder( 'Extfidir Gestures' ).close();
        let motionFolder = gui.addFolder( 'Motion' ).close();
        let testFolder = gui.addFolder( 'Phrases' );


        /*
		let otherFolder = gui.addFolder( 'Animations' );
        let otherParams = {
               happyISLday() {
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
                                text: "aaaaa pii.",
                                speed: 9/1.3,
                            },
                            {
                                type: "speech",
                                start: 1.6,
                                end: 2.2,
                                text: "aaaaii.",
                                speed: 6/0.7
                            },
                            {
                                type: "speech",
                                start: 2.2,
                                end: 2.6,
                                text: "ssss.",
                                speed: 4/0.4
                            },
                            {
                                type: "speech",
                                start: 2.6,
                                end: 3.0,
                                text: "llll.",
                                speed: 4/0.4
                            },
                            {
                                type: "speech",
                                start: 3.1,
                                end: 3.6,
                                text: "de.",
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
        }

        otherFolder.add(otherParams, 'happyISLday').name('Happy ISL Day');
        otherFolder.add(otherParams, 'ngt7').name("7 vergadering wanneer");
*/

        let moodIntensity = 1;
        let moodParams = {
            neutral() {
                let msg = {
                    type: "behaviours",
                    data: [
                        {
                            type: "faceEmotion",
                            start: 0.0,
                            amount: moodIntensity,
                            shift: true,
                            emotion: "NEUTRAL",
                        }
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            anger() {
                let msg = {
                    type: "behaviours",
                    data: [
                        {
                            type: "faceEmotion",
                            start: 0.0,
                            amount: moodIntensity,
                            shift: true,
                            emotion: "ANGER",
                        }
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            happiness() {
                let msg = {
                    type: "behaviours",
                    data: [
                        {
                            type: "faceEmotion",
                            start: 0.0,
                            amount: moodIntensity,
                            shift: true,
                            emotion: "HAPPINESS",
                        }
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            sadness() {
                let msg = {
                    type: "behaviours",
                    data: [
                        {
                            type: "faceEmotion",
                            start: 0.0,
                            amount: moodIntensity,
                            shift: true,
                            emotion: "SADNESS",
                        }
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            surprise() {
                let msg = {
                    type: "behaviours",
                    data: [
                        {
                            type: "faceEmotion",
                            start: 0.0,
                            amount: moodIntensity,
                            shift: true,
                            emotion: "SURPRISE",
                        }
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            fear() {
                let msg = {
                    type: "behaviours",
                    data: [
                        {
                            type: "faceEmotion",
                            start: 0.0,
                            amount: moodIntensity,
                            shift: true,
                            emotion: "FEAR",
                        }
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            disgust() {
                let msg = {
                    type: "behaviours",
                    data: [
                        {
                            type: "faceEmotion",
                            start: 0.0,
                            amount: moodIntensity,
                            shift: true,
                            emotion: "DISGUST",
                        }
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            contempt() {
                let msg = {
                    type: "behaviours",
                    data: [
                        {
                            type: "faceEmotion",
                            start: 0.0,
                            amount: moodIntensity,
                            shift: true,
                            emotion: "CONTEMPT",
                        }
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(msg));
            },
        }
        moodFolder.add(moodParams, 'neutral').name('neutral');
        moodFolder.add(moodParams, 'anger').name('anger');
        moodFolder.add(moodParams, 'happiness').name('happiness');
        moodFolder.add(moodParams, 'sadness').name('sadness');
        moodFolder.add(moodParams, 'surprise').name('surprise');
        moodFolder.add(moodParams, 'fear').name('fear');
        moodFolder.add(moodParams, 'disgust').name('disgust');
        moodFolder.add(moodParams, 'contempt').name('contempt');


        // ARM FOLDER -----------
        function armSimplifier( armshape, hand = "right" ){
            this.msg = {
                type: "behaviours",
                data: [
                    {   type: "gesture", start: 0.0, attackPeak: 0.5, relax : 5, end: 5.3, locationArm: armshape, hand: hand, distance: 0.01 },
            ]};
            this.ECAcontroller.processMsg(JSON.stringify(this.msg));
        }

        let armParams = {
            rightArm(){
                let duration = 0.8;
               that.msg = {
                   type: "behaviours",
                   data: [
                       { type: "gesture", start: duration, end: duration * 2, locationArm: "headtop", hand: "right" },
                       { type: "gesture", start: duration * 2, end: duration * 3, locationArm: "forehead", hand: "right" },
                       { type: "gesture", start: duration * 3, end: duration * 4, locationArm: "eyeL", hand: "right" },
                       { type: "gesture", start: duration * 4, end: duration * 5, locationArm: "eyeR", hand: "right" },
                       { type: "gesture", start: duration * 5, end: duration * 6, locationArm: "nose", hand: "right" },
                       { type: "gesture", start: duration * 6, end: duration * 7, locationArm: "upperlip", hand: "right" },
                       { type: "gesture", start: duration * 7, end: duration * 8, locationArm: "mouth", hand: "right" },
                       { type: "gesture", start: duration * 8, end: duration * 9, locationArm: "chin", hand: "right" },
                       { type: "gesture", start: duration * 9, end: duration * 10, locationArm: "earL", hand: "right" },
                       { type: "gesture", start: duration * 10, end: duration * 11, locationArm: "earR", hand: "right" },
                       { type: "gesture", start: duration * 11, end: duration * 12, locationArm: "cheekL", hand: "right" },
                       { type: "gesture", start: duration * 12, end: duration * 13, locationArm: "cheekR", hand: "right" },
                       { type: "gesture", start: duration * 13, end: duration * 14, locationArm: "neck", hand: "right" },
                       { type: "gesture", start: duration * 14, end: duration * 15, locationArm: "shoulderL", hand: "right" },
                       { type: "gesture", start: duration * 15, end: duration * 16, locationArm: "shoulderR", hand: "right" },
                       { type: "gesture", start: duration * 16, end: duration * 17, locationArm: "chest", hand: "right" },
                       { type: "gesture", start: duration * 17, end: duration * 18, locationArm: "stomach", hand: "right" },
                       { type: "gesture", start: duration * 18, end: duration * 19, locationArm: "belowstomach", hand: "right" },
                       { type: "gesture", start: duration * 19, end: duration * 20, locationArm: "neutral", hand: "right" },
               ]};
               that.ECAcontroller.processMsg(JSON.stringify(that.msg));
           },
           leftArm(){
                let duration = 0.8;
               that.msg = {
                   type: "behaviours",
                   data: [
                       { type: "gesture", start: duration, end: duration * 2, locationArm: "headtop", hand: "left"},
                       { type: "gesture", start: duration * 2, end: duration * 3, locationArm: "forehead", hand: "left" },
                       { type: "gesture", start: duration * 3, end: duration * 4, locationArm: "eyeL", hand: "left" },
                       { type: "gesture", start: duration * 4, end: duration * 5, locationArm: "eyeR", hand: "left" },
                       { type: "gesture", start: duration * 5, end: duration * 6, locationArm: "nose", hand: "left" },
                       { type: "gesture", start: duration * 6, end: duration * 7, locationArm: "upperlip", hand: "left" },
                       { type: "gesture", start: duration * 7, end: duration * 8, locationArm: "mouth", hand: "left" },
                       { type: "gesture", start: duration * 8, end: duration * 9, locationArm: "chin", hand: "left" },
                       { type: "gesture", start: duration * 9, end: duration * 10, locationArm: "earL", hand: "left" },
                       { type: "gesture", start: duration * 10, end: duration * 11, locationArm: "earR", hand: "left" },
                       { type: "gesture", start: duration * 11, end: duration * 12, locationArm: "cheekL", hand: "left" },
                       { type: "gesture", start: duration * 12, end: duration * 13, locationArm: "cheekR", hand: "left" },
                       { type: "gesture", start: duration * 13, end: duration * 14, locationArm: "neck", hand: "left" },
                       { type: "gesture", start: duration * 14, end: duration * 15, locationArm: "shoulderL", hand: "left" },
                       { type: "gesture", start: duration * 15, end: duration * 16, locationArm: "shoulderR", hand: "left" },
                       { type: "gesture", start: duration * 16, end: duration * 17, locationArm: "chest", hand: "left" },
                       { type: "gesture", start: duration * 17, end: duration * 18, locationArm: "stomach", hand: "left" },
                       { type: "gesture", start: duration * 18, end: duration * 19, locationArm: "belowstomach", hand: "left" },
                       { type: "gesture", start: duration * 19, end: duration * 20, locationArm: "neutral", hand: "left" },
                   ]};
               that.ECAcontroller.processMsg(JSON.stringify(that.msg));
           }
        }
        for( let e in nearArmPosesTable ){
            armParams[e] = armSimplifier.bind(that, e);
            armFolder.add(armParams, e).name(e);
        }
        armFolder.add(armParams, "rightArm").name("TEST_ALL_R");
        armFolder.add(armParams, "leftArm").name("TEST_ALL_L");


        // HANDSHAPE FOLDER ------------
        function handshapeSimplifier( handshape, thumbshape = null, hand = "right" ){
            this.msg = {
                type: "behaviours",
                data: [
                    {   type: "gesture", start: 0.0, attackPeak: 0.5, relax : 5, end: 5.3, handshape: handshape, thumbshape: thumbshape, hand: hand },
            ]};
            this.ECAcontroller.processMsg(JSON.stringify(this.msg));
        }
        let handShapeParams = {

            fist : handshapeSimplifier.bind(that, "fist"),
            finger2 : handshapeSimplifier.bind(that, "finger2"),
            finger23 : handshapeSimplifier.bind(that, "finger23"),
            finger23spread : handshapeSimplifier.bind(that, "finger23spread"),
            finger2345 : handshapeSimplifier.bind(that, "finger2345"),
            flat : handshapeSimplifier.bind(that, "flat"),
            pinch12 : handshapeSimplifier.bind(that, "pinch12"),
            pinch12open : handshapeSimplifier.bind(that, "pinch12open"),
            pinchall : handshapeSimplifier.bind(that, "pinchall"),
            ceeall : handshapeSimplifier.bind(that, "ceeall"),
            cee12 : handshapeSimplifier.bind(that, "cee12"),
            cee12open : handshapeSimplifier.bind(that, "cee12open"),
  
            count(){
                let duration = 0.8;
                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0.0         , attackPeak: duration * 1, end: 1000, handshape: "finger2", hand: "both" },
                        { type: "gesture", start: duration    , attackPeak: duration * 2, end: 1000, handshape: "finger23spread", thumbshape: "across",  hand: "both" },
                        { type: "gesture", start: duration * 2, attackPeak: duration * 3, end: 1000, handshape: "finger23spread", thumbshape:"out",  hand: "both" },
                        { type: "gesture", start: duration * 3, attackPeak: duration * 4, end: 1000, handshape: "finger2345", thumbshape: "across",  hand: "both" },
                        { type: "gesture", start: duration * 4, attackPeak: duration * 5, relax: duration * 5.5, end: duration * 6, handshape: "finger2345", thumbshape: "out",  hand: "both" },
                ]};
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },

		};

        handShapeFolder.add(handShapeParams, "fist").name("fist");
        handShapeFolder.add(handShapeParams, "finger2").name("finger2");
        handShapeFolder.add(handShapeParams, "finger23").name("finger23");
        handShapeFolder.add(handShapeParams, "finger23spread").name("finger23spread");
        handShapeFolder.add(handShapeParams, "finger2345").name("finger2345");
        handShapeFolder.add(handShapeParams, "flat").name("flat");

        handShapeFolder.add(handShapeParams, "pinch12").name("pinch12");
        handShapeFolder.add(handShapeParams, "pinch12open").name("pinch12open");
        handShapeFolder.add(handShapeParams, "pinchall").name("pinchall");
        handShapeFolder.add(handShapeParams, "ceeall").name("ceeall");
        handShapeFolder.add(handShapeParams, "cee12").name("cee12");
        handShapeFolder.add(handShapeParams, "cee12open").name("cee12open");
        handShapeFolder.add(handShapeParams, "count").name("count");
        

        // PALMOR ORIENTATION ----------------------
        function rotationSimplifier(rotname){
            let that = this;
            that.msg = {
                type: "behaviours",
                data: [
                     { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 4000000, locationArm: "chest", hand: "right", distance: 0.75 },
                     { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 3000000, locationArm: "chest", hand: "left", distance: 0.75 },
                    { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 3000000, handshape: "flat", hand: "both"},
                    { type: "gesture", start: 0, attackPeak: 0.8, relax: 2000000, end: 3000000, palmor: rotname, hand: "both"}, 
                ]
            };
            that.ECAcontroller.processMsg(JSON.stringify(that.msg));
           
        }
        
        let palmorParams = {
            u  : rotationSimplifier.bind(that, 'u'),
            ul : rotationSimplifier.bind(that, 'ul'),
            l  : rotationSimplifier.bind(that, 'l'),
            dl : rotationSimplifier.bind(that, 'dl'),
            d  : rotationSimplifier.bind(that, 'd'),
            dr : rotationSimplifier.bind(that, 'dr'),
            r  : rotationSimplifier.bind(that, 'r'),
            ur : rotationSimplifier.bind(that, 'ur'),
        }
        palmorFolder.add(palmorParams, "u").name("u");
        palmorFolder.add(palmorParams, "ul").name("ul");
        palmorFolder.add(palmorParams, "l").name("l");
        palmorFolder.add(palmorParams, "dl").name("dl");
        palmorFolder.add(palmorParams, "d").name("d");
        palmorFolder.add(palmorParams, "dr").name("dr");
        palmorFolder.add(palmorParams, "r").name("r");
        palmorFolder.add(palmorParams, "ur").name("ur");


        // EXTFIDIR FOLDER PARAMS ------------------
        function extfidirSimplifier(rotname){
            let that = this;
            that.msg = {
                type: "behaviours",
                data: [
                     { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 4000000, locationArm: "chest", hand: "right", distance: 0.75 },
                     { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 3000000, locationArm: "chest", hand: "left", distance: 0.75 },
                    { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 3000000, handshape: "flat", hand: "both"},
                    { type: "gesture", start: 0, attackPeak: 0.8, relax: 2000000, end: 3000000, extfidir: rotname, hand: "both", mode: 2 }, 
                ]
            };
            that.ECAcontroller.processMsg(JSON.stringify(that.msg));
           
        }
        let extfidirParams = {};
        for( let e in extfidirTable ){
            extfidirParams[e] = extfidirSimplifier.bind(that, e);
            extfidirFolder.add(extfidirParams, e).name(e);
        }

        // MOTION FOLDER
        let motionParams = {
            directed(){ 
                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0, attackPeak: 2, relax: 3, end: 4, hand: "both", motion: "directed", direction: "u", curve: "l", zigzag:"i", zigzagSpeed:1.33, zigzagSize:0.05 }, 
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            circular(){ 
                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0, attackPeak: 2, relax: 3, end: 4, hand: "both", motion: "circular", direction: "u", startAngle: 0, endAngle: 470, zigzag:"u", zigzagSpeed:3.33, zigzagSize:0.05 }, 
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            fingerplay(){
                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0, attackPeak: 1, relax: 3, end: 4, hand: "both", motion: "fingerplay", speed: 4, intensity: 0.3 }, 
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
            wristMotion(){
                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0, attackPeak: 1, relax: 3, end: 4, hand: "both", motion: "wrist", speed: 1, intensity: 0.3, mode: "spinCW" }, 
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            }
        };

        motionFolder.add(motionParams, "directed").name("directed");
        motionFolder.add(motionParams, "circular").name("circular");
        motionFolder.add(motionParams, "fingerplay").name("fingerplay");
        motionFolder.add(motionParams, "wristMotion").name("wristMotion");


        // PHRASES FOLDER PARAMS -------------
        let testParams = {     
      
            HALLO(){
                let halloStart = 0.0;
                let hallo = 1.0;
                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "speech", start: halloStart, end: 100000, text: that.wordsToArpa("hallo") + ".", sentT: hallo, sentInt: 0.5 },

                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: 100000, end: 100000, locationArm: "shoulderR", hand: "right", distance: 0.1 },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: 100000, end: 100000, handshape: "flat", thumbshape: "touch", hand: "right" },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: 100000, end: 100000, palmor: "d", hand: "right" },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: 100000, end: 100000, extfidir: "u", hand: "right" },
                        // { type: "gesture", start: halloStart + hallo * 0.5, attackPeak: halloStart + hallo, relax: 100000, end: 100000, locationArm: "loc3mid", hand: "right", distance: 0.1 },

                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },

            LEUK(){
                let leukStart = 0.0;
                let leuk = 1.0;
                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "speech", start: leukStart, end: 100000, text: that.wordsToArpa("leuk") + ".", sentT: leuk, sentInt: 0.8 },

                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, locationArm: "chest", hand: "right", distance: 0.1 },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, handshape: "finger2", thumbshape:"opposed", hand: "right" },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, palmor: "l", hand: "right" },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, extfidir: "uo", hand: "right" },
                        
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: 100000, end: 100000, locationArm: "stomach", hand: "right", distance: 0.1 },
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: 100000, end: 100000, handshape: "pinch12", hand: "right" },
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: 100000, end: 100000, palmor: "l", hand: "right" },
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },

            ONTMOETEN(){
                let ontStart = 0.0;
                let ontmoeten = 1.0;
                let end = ontStart + ontmoeten;
                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end, end: end, locationArm: "stomach", hand: "right", distance: 0.25 },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end, end: end, locationArm: "stomach", hand: "left", distance: 0.75 },

                        { type: "gesture", start: ontStart + ontmoeten * 0.4, attackPeak: end, relax: end + 1, end: end + 2, locationArm: "stomach", hand: "right", distance: 0.35 },
                        { type: "gesture", start: ontStart + ontmoeten * 0.4, attackPeak: end, relax: end + 1, end: end + 2, locationArm: "stomach", hand: "left", distance: 0.6 },

                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2, handshape: "finger2", hand: "both" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2,  palmor: "dr", hand: "right" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2,  palmor: "dr", hand: "left" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2,  extfidir: "u", secondExtfidir: "uo", hand: "both" },
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },

            HalloLeukOntmoeten(){
                let hallo = 1.0;
                let leuk = 1.0;
                let ontmoeten = 1.0;

                let halloStart = 0;
                let leukStart = halloStart + hallo;
                let ontStart = leukStart + leuk;
                let end = ontStart + ontmoeten;

                that.msg = {
                    type: "behaviours",
                    data: [
                        { type: "faceLexeme", start: 0, attackPeak: 0.5, relax: end + 1, end: end + 2, lexeme: "NMF_SMILE_CLOSED", amount:0.4 },

                        // hallo
                        { type: "speech", start: halloStart, end: 100000, text: that.wordsToArpa("hallo") + ".", sentT: hallo, sentInt: 0.5 },

                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5 , relax: 100000, end: 100000, locationArm: "shoulderR", hand: "right", distance: 0.1 },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: 100000, end: 100000, handshape: "flat", thumbshape: "touch", hand: "right" },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: 100000, end: 100000, palmor: "d", hand: "right"},
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: 100000, end: 100000, extfidir: "u", hand: "right" },

                        // leuk                  
                        { type: "speech", start: leukStart, end: 100000, text: that.wordsToArpa("leuk") + ".", sentT: leuk + ontmoeten * 0.4, sentInt: 0.8 },

                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, locationArm: "chest", hand: "right", distance: 0.1 },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, handshape: "finger2", thumbshape:"opposed", hand: "right" },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, palmor: "l", hand: "right" },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, extfidir: "uo", hand: "right" },
                        
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: 100000, end: 100000, locationArm: "stomach", hand: "right", distance: 0.1 },
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: 100000, end: 100000, handshape: "pinch12", hand: "right" },
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: 100000, end: 100000, palmor: "l", hand: "right" },                        
                        
                        // ontmoeten
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end, end: end, locationArm: "stomach", hand: "right", distance: 0.25 },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end, end: end, locationArm: "stomach", hand: "left", distance: 0.75 },

                        { type: "gesture", start: ontStart + ontmoeten * 0.4, attackPeak: end, relax: end + 0.5, end: end + 1.5, locationArm: "stomach", hand: "right", distance: 0.35 },
                        { type: "gesture", start: ontStart + ontmoeten * 0.4, attackPeak: end, relax: end + 0.5, end: end + 1.5, locationArm: "stomach", hand: "left", distance: 0.6 },

                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5, handshape: "finger2", hand: "both" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5,  palmor: "dr", hand: "right" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5,  palmor: "dr", hand: "left" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5,  extfidir: "u", secondExtfidir: "uo", hand: "both" },
                    ]
                };
                that.ECAcontroller.processMsg(JSON.stringify(that.msg));
            },
        };
        testFolder.add(testParams, "HALLO").name("HALLO");
        testFolder.add(testParams, "LEUK").name("LEUK");
        testFolder.add(testParams, "ONTMOETEN").name("ONTMOETEN");
        
        testFolder.add(testParams, "HalloLeukOntmoeten").name("Hallo leuk ontmoeten");


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
            ECAcontroller.reset();
            ECAcontroller.processMsg( JSON.stringify( { control: 2 } )); // speaking

            // load the actual animation to play
            let mixer = this[ "mixer" + nameString ] = new THREE.AnimationMixer( model );
            mixer.addEventListener('loop', () => { ECAcontroller.reset(true); ECAcontroller.processMsg(JSON.stringify(this.msg)); } );

            if ( callback ){ callback (); }

        }

        function loadfinished() {
//            this.model1.position.set(0.05, 0.96, 0 );
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
                    //()=>this.loaderGLB.load( './data/anim/Signs.glb', loadModel.bind( this, "2", loadfinished.bind(this)) )  
                    ()=>this.loaderGLB.load( './data/anim/Eva_Y.glb', loadModel.bind( this, "2", loadfinished.bind(this)) )  
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

        this.fps = Math.floor( 1.0 / ((delta>0)?delta:1000000) );
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
