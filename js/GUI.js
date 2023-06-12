import { GUI } from 'https://cdn.skypack.dev/lil-gui'
import * as THREE from 'three';

import { extfidirPointTable } from './sigml/Extfidir.js';
import { nearArmPosesTable } from './sigml/LocationArmIK.js';
import { TIMESLOT, sigmlStringToBML } from './sigml/SigmlToBML.js';

 
class AppGUI {
    constructor( app ){
        this.app = app;
        this.gui = null;
        this.createPanel();
    }

    createPanel() {
    
        let that = this;
        let gui = this.gui = new GUI();
    
        gui.add(this.app, "fps").name("fps").listen().disable();
        
        let params = {
            colorChroma: 0x141455,
            colorClothes: 0xFFFFFF,
            reset: () => { this.app.ECAcontroller.reset(); },
            openBMLInput: () => {
                // open window and set all html elements (copy previous state)
                let handle = window.open("", "BML Input", "width=700, height=700");
                let previousText = "";
                while( handle.document.body.firstChild ){
                    if ( handle.document.body.firstChild.id == "bmlInput" ){ previousText = handle.document.body.firstChild.value; }
                    handle.document.body.removeChild( handle.document.body.firstChild );
                }
    
                let htmlStr = "<p>Write in the text area below the bml instructions to move the avatar from the web application. A sample of BML instructions can be tested through the helper tabs in the right panel.</p>";
                htmlStr += "<a href=\"https://github.com/upf-gti/SignON-realizer/blob/SiGMLExperiments/docs/InstructionsBML.md\" target=\"_blank\">Click here to see BML instructions and attributes</a>";
                htmlStr += "<p>Note: In 'speech', all text between '%' is treated as actual words. An automatic translation from words (dutch) to phonemes (arpabet) is performed. </p>";
                htmlStr += "<p>Note: Each instruction is inside '{}'. Each instruction is separated by a coma ',' except que last one. </p>";
                htmlStr += '<p>An example: <br>{ "type":"speech", "start": 0, "text": "%hallo%.", "sentT": 1, "sentInt": 0.5 }, <br> { "type": "gesture", "start": 0, "attackPeak": 0.5, "relax": 1, "end": 2, "locationArm": "shoulderR", "lrSym": true, "hand": "both", "distance": 0.1 }</p>';
                htmlStr += "<textarea id=\"bmlInput\" placeholder=\"Write bml here\" style=\"width:100%; height:34%;\"></textarea>  ";
                htmlStr += "<button id=\"sendButton\" type=\"button\" style=\"width:100%; height:9%\">Send</button> ";
                handle.document.write(htmlStr);
                let textarea = handle.document.getElementById( "bmlInput" );
                textarea.value = previousText;
                let button = handle.document.getElementById( "sendButton" );
                
                // generate msg and send it to ECAController
                button.addEventListener( "click", () => { 
                    let msg = {
                        type: "behaviours",
                        data: []
                    };
                    // JSON
                    try {
                        msg.data = JSON.parse( "[" + textarea.value + "]" ); 
                    } catch (error) {
                        handle.alert( "Invalid bml message. Check for errors such as proper quoting (\") of words or commas after each instruction (except the last one) and attribute." );
                        return;
                    }
    
                    // for mouthing, find those words that need to be translated into phonemes (ARPA)
                    for( let i = 0; i < msg.data.length; ++i ){
                        if ( msg.data[i].type == "speech" && typeof( msg.data[i].text ) == "string" ){
                            let strSplit = msg.data[i].text.split( "%" ); // words in NGT are between "%"
                            let result = "";
                            for( let j = 0; j < strSplit.length; ){
                                result += strSplit[j]; // everything before are phonemes
                                j++;
                                if ( j < ( strSplit.length - 1 ) ){ // word to translate
                                    result += this.app.wordsToArpa( strSplit[j], "NGT" );
                                }
                                j++;
                            }
                            msg.data[i].text = result + ".";
                        }
                    }
    
                    this.app.ECAcontroller.processMsg(JSON.stringify(msg));
                
                });
    
            },
            openSiGMLInput: () => {
                // open window and set all html elements (copy previous state)
                let handle = window.open("", "SiGML Input", "width=700, height=700");
                let previousText = "";
                while( handle.document.body.firstChild ){
                    if ( handle.document.body.firstChild.id == "sigmlInput" ){ previousText = handle.document.body.firstChild.value; }
                    handle.document.body.removeChild( handle.document.body.firstChild );
                }
    
                let htmlStr = "<p>Write in the text area below the SiGML instructions (as in JaSigning) to move the avatar from the web application. Work in progress</p>";
                htmlStr += "<textarea id=\"sigmlInput\" placeholder=\"Write SiGML here\" style=\"width:100%; height:34%;\"></textarea>  ";
                htmlStr += "<button id=\"sendButton\" type=\"button\" style=\"width:100%; height:9%\">Send</button> ";
                handle.document.write(htmlStr);
                let textarea = handle.document.getElementById( "sigmlInput" );
                textarea.value = previousText;
                let button = handle.document.getElementById( "sendButton" );
                
                // generate msg and send it to ECAController
                button.addEventListener( "click", () => { 
                    let msg = {
                        type: "behaviours",
                        data: []
                    };
                    msg.data = sigmlStringToBML( textarea.value ).data;
                    // try {
                    // } catch (error) {
                    //     handle.alert( "Invalid SiGML message." );
                    //     console.error( error );
                    //     return;
                    // }
    
                    this.app.ECAcontroller.processMsg(JSON.stringify(msg));
    
                
                });
    
            }
        } 
        
    
        // get init color and set them to sGRB (css works in sRGB) 
        let color = new THREE.Color();
        color.copyLinearToSRGB(this.app.scene.getObjectByName("Chroma").material.color);
        params.colorChroma = color.getHex();
    
        color.copyLinearToSRGB(this.app.model.getObjectByName("Tops").material.color);
        params.colorClothes = color.getHex();
    
        gui.addColor(params, 'colorChroma').onChange( (e) => {
            let color = this.app.scene.getObjectByName("Chroma").material.color; // css works in sRGB
            color.setHex(e);
            color.copySRGBToLinear(color); // material.color needs to be in linearSpace
        });
        gui.addColor(params, 'colorClothes').onChange( (e) => {
            let color = this.app.model.getObjectByName("Tops").material.color; // css works in sRGB
            color.setHex(e);
            color.copySRGBToLinear(color); // material.color needs to be in linearSpace
        });
    
        gui.add( params, "reset").name("reset Pose");
        gui.add( params, "openBMLInput").name("bml input");
        gui.add( params, "openSiGMLInput").name("SiGML input");
    
        let moodFolder = gui.addFolder( "Moods" ).close();
        let armFolder = gui.addFolder( 'Arm Gestures' ).close();
        let handShapeFolder = gui.addFolder( 'Handshape Gestures' ).close();
        let palmorFolder = gui.addFolder( 'Palmor Gestures' ).close();
        let extfidirFolder = gui.addFolder( 'Extfidir Gestures' ).close();
        let motionFolder = gui.addFolder( 'Motion' ).close();
        let testFolder = gui.addFolder( 'Preset Signs' );
    
    
        /*
        let otherFolder = gui.addFolder( 'Animations' );
        let otherParams = {
               happyISLday: () => {
                this.app.loadGLB('https://webglstudio.org/projects/signon/repository/files/signon/animations/Happy ISL Day.glb', 'ISL - Happy ISL Day', () => {
                    this.app.msg = {
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
                    this.app.ECAcontroller.reset();
                    this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
                });
            },
            ngt7: () => { 
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        {   type: "speech",
                            start: 0.4,
                            text: this.app.wordsToArpa("vergadering", "NGT"),
                            speed: 12,
                            sentInt: 0.8
                        },
                        {   type: "speech",
                            start: 1.7,
                            text: this.app.wordsToArpa("wanneer", "NGT") + ".",
                            speed: 12,
                            sentInt: 0.8
                        },
                ]};
                this.app.ECAcontroller.reset();
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
        }
    
        otherFolder.add(otherParams, 'happyISLday').name('Happy ISL Day');
        otherFolder.add(otherParams, 'ngt7').name("7 vergadering wanneer");
    */
    
        let moodIntensity = 1;
        let moodParams = {
            neutral: () => {
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
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            anger: () => {
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
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            happiness: () => {
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
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            sadness: () => {
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
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            surprise: () => {
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
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            fear: () => {
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
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            disgust: () => {
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
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            },
            contempt: () => {
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
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
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
        window.armDist = 0.01;
        function armSimplifier( armshape, hand = "right" ){
            this.msg = {
                type: "behaviours",
                data: [
                    {   type: "gesture", start: 0.0, attackPeak: 0.5, relax : 5, end: 5.3, locationArm: armshape, hand: 'both', distance: window.armDist },
            ]};
            this.ECAcontroller.processMsg(JSON.stringify(this.msg));
        }
        let armParams = {
            rightArm: () => {
                let duration = 0.8;
               this.app.msg = {
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
               this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
           },
           leftArm: () => {
                let duration = 0.8;
               this.app.msg = {
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
               this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
           }
        }
      
        for( let e in nearArmPosesTable ){
            armParams[e] = armSimplifier.bind(this.app, e);
            armFolder.add(armParams, e).name(e);
        }
        armFolder.add(armParams, "rightArm").name("TEST_ALL_R");
        armFolder.add(armParams, "leftArm").name("TEST_ALL_L");
    
    
        // HANDSHAPE FOLDER ------------
        function handshapeSimplifier( handshape, thumbshape = null, hand = "both" ){
            this.msg = {
                type: "behaviours",
                data: [
                    {   type: "gesture", start: 0.0, attackPeak: 0.5, relax : 5, end: 5.3, handshape: handshape, thumbshape: thumbshape, hand: hand },
            ]};
            this.ECAcontroller.processMsg(JSON.stringify(this.msg));
        }
        let handShapeParams = {
    
            fist : handshapeSimplifier.bind(this.app, "fist"),
            finger2 : handshapeSimplifier.bind(this.app, "finger2"),
            finger23 : handshapeSimplifier.bind(this.app, "finger23"),
            finger23spread : handshapeSimplifier.bind(this.app, "finger23spread"),
            finger2345 : handshapeSimplifier.bind(this.app, "finger2345"),
            flat : handshapeSimplifier.bind(this.app, "flat"),
            pinch12 : handshapeSimplifier.bind(this.app, "pinch12"),
            pinch12open : handshapeSimplifier.bind(this.app, "pinch12open"),
            pinchall : handshapeSimplifier.bind(this.app, "pinchall"),
            ceeall : handshapeSimplifier.bind(this.app, "ceeall"),
            cee12 : handshapeSimplifier.bind(this.app, "cee12"),
            cee12open : handshapeSimplifier.bind(this.app, "cee12open"),
    
            count: () => {
                let duration = 0.8;
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0.0         , attackPeak: duration * 1, end: 1000, handshape: "finger2", hand: "both" },
                        { type: "gesture", start: duration    , attackPeak: duration * 2, end: 1000, handshape: "finger23spread", hand: "both" },
                        { type: "gesture", start: duration * 2, attackPeak: duration * 3, end: 1000, handshape: "finger23spread", thumbshape:"out",  hand: "both" },
                        { type: "gesture", start: duration * 3, attackPeak: duration * 4, end: 1000, handshape: "finger2345", thumbshape: "across",  hand: "both" },
                        { type: "gesture", start: duration * 4, attackPeak: duration * 5, relax: duration * 5.5, end: duration * 6, handshape: "finger2345", thumbshape: "out",  hand: "both" },
                ]};
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
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
            this.msg = {
                type: "behaviours",
                data: [
                     { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 4000000, locationArm: "chest", hand: "right", distance: 0.75 },
                     { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 3000000, locationArm: "chest", hand: "left", distance: 0.75 },
                    { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 3000000, handshape: "flat", hand: "both"},
                    { type: "gesture", start: 0, attackPeak: 0.8, relax: 2000000, end: 3000000, palmor: rotname, hand: "both"}, 
                ]
            };
            this.ECAcontroller.processMsg(JSON.stringify(this.msg));
           
        }
        
        let palmorParams = {
            u  : rotationSimplifier.bind(this.app, 'u'),
            ul : rotationSimplifier.bind(this.app, 'ul'),
            l  : rotationSimplifier.bind(this.app, 'l'),
            dl : rotationSimplifier.bind(this.app, 'dl'),
            d  : rotationSimplifier.bind(this.app, 'd'),
            dr : rotationSimplifier.bind(this.app, 'dr'),
            r  : rotationSimplifier.bind(this.app, 'r'),
            ur : rotationSimplifier.bind(this.app, 'ur'),
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
            this.msg = {
                type: "behaviours",
                data: [
                     { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 4000000, locationArm: "chest", hand: "right", distance: 0.75 },
                     { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 3000000, locationArm: "chest", hand: "left", distance: 0.75 },
                    { type: "gesture", start: 0, attackPeak: 0.2, relax: 2000000, end: 3000000, handshape: "flat", hand: "both"},
                    { type: "gesture", start: 0, attackPeak: 0.8, relax: 2000000, end: 3000000, extfidir: rotname, hand: "both", mode: 2 }, 
                ]
            };
            this.ECAcontroller.processMsg(JSON.stringify(this.msg));
           
        }
        let extfidirParams = {};
        for( let e in extfidirPointTable ){
            extfidirParams[e] = extfidirSimplifier.bind(this.app, e);
            extfidirFolder.add(extfidirParams, e).name(e);
        }
    
        // MOTION FOLDER
        let motionParams = {
            directed: () => { 
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0, attackPeak: 2, relax: 3, end: 4, hand: "both", lrSym:true, motion: "directed", direction: "u", curve: "l" },//, zigzag:"i", zigzagSpeed:1.33, zigzagSize:0.05 }, 
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
            circular: () => { 
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0, attackPeak: 2, relax: 2, end: 4, hand: "both", lrSym: true, motion: "circular", direction: "u", startAngle: 0, endAngle: 470}, //zigzag:"u", zigzagSpeed:3.33, zigzagSize:0.05 }, 
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
            fingerplay: () => {
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0, attackPeak: 1, relax: 3, end: 4, hand: "both", motion: "fingerplay", speed: 4, intensity: 0.3 }, 
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
            wristMotion: () => {
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: 0, attackPeak: 1, relax: 3, end: 4, hand: "both", motion: "wrist", speed: 1, intensity: 0.3, mode: "stirCW" }, 
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            }
        };
    
        motionFolder.add(motionParams, "directed").name("directed");
        motionFolder.add(motionParams, "circular").name("circular");
        motionFolder.add(motionParams, "fingerplay").name("fingerplay");
        motionFolder.add(motionParams, "wristMotion").name("wristMotion");
    
    
        // PHRASES FOLDER PARAMS -------------
        let testParams = {     
      
            HALLO: () => {
                let halloStart = 0.0;
                let hallo = 1.0;
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "speech", start: halloStart, end: 100000, text: this.app.wordsToArpa("hallo", "NGT") + ".", sentT: hallo, sentInt: 0.5 },
    
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: halloStart + hallo + 1, end: halloStart + hallo + 2, locationArm: "shoulderR", hand: "right", distance: 0.1 },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: halloStart + hallo + 1, end: halloStart + hallo + 2, handshape: "flat", thumbshape: "touch", hand: "right" },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: halloStart + hallo + 1, end: halloStart + hallo + 2, palmor: "d", hand: "right" },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: halloStart + hallo + 1, end: halloStart + hallo + 2, extfidir: "u", hand: "right" },
                        { type: "gesture", start: halloStart + hallo * 0.4, attackPeak: halloStart + hallo, relax:halloStart + hallo + 1, end: halloStart + hallo + 2, motion: "directed", direction: "r", distance: 0.05, curve:'u' },
    
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
    
            LEUK: () => {
                let leukStart = 0.0;
                let leuk = 1.0;
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "speech", start: leukStart, end: 100000, text: this.app.wordsToArpa("leuk", "NGT") + ".", sentT: leuk, sentInt: 0.8 },
    
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: leukStart + leuk + 1, end: leukStart + leuk + 2, locationArm: "chest", hand: "right", distance: 0.1, side:"r", sideDistance: 0.1 },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: leukStart + leuk + 1, end: leukStart + leuk + 2, handshape: "finger2", thumbshape:"opposed", hand: "right" },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: leukStart + leuk + 1, end: leukStart + leuk + 2, palmor: "u", hand: "right" },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: leukStart + leuk + 1, end: leukStart + leuk + 2, extfidir: "uo", hand: "right", mode:"relative" },
                        
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: leukStart + leuk + 1, end: leukStart + leuk + 2, handshape: "pinch12", hand: "right" },
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: leukStart + leuk + 1, end: leukStart + leuk + 2, motion: "directed", direction:"d", hand: "right" },
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
    
            ONTMOETEN: () => {
                let ontStart = 0.0;
                let ontmoeten = 1.0;
                let end = ontStart + ontmoeten;
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2, locationArm: "stomach", hand: "right", distance: 0.025, side:"r", sideDistance: 0.1 },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2, locationArm: "stomach", hand: "left", distance: 0.075, side:"l", sideDistance: 0.1 },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2, handshape: "finger2", hand: "both" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2,  palmor: "l", hand: "right" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2,  palmor: "r", hand: "left" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 1, end: end + 2,  extfidir: "u", secondExtfidir: "uo", hand: "both" },
                        { type: "gesture", start: ontStart + ontmoeten * 0.4, attackPeak: ontStart + ontmoeten, relax: end + 1, end: end + 2, motion: "directed", direction:"l", hand: "both", lrSym: true, distance: 0.025, side:"r", sideDistance: 0.1 },
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
    
            HalloLeukOntmoeten: () => {
                let hallo = 1.0;
                let leuk = 1.0;
                let ontmoeten = 1.0;
    
                let halloStart = 0;
                let leukStart = halloStart + hallo;
                let ontStart = leukStart + leuk;
                let end = ontStart + ontmoeten;
    
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "faceLexeme", start: 0, attackPeak: 0.5, relax: end + 1, end: end + 2, lexeme: "NMF_SMILE_CLOSED", amount:0.4 },
    
                        // hallo
                        { type: "speech", start: halloStart, end: 100000, text: this.app.wordsToArpa("hallo", "NGT") + ".", sentT: hallo, sentInt: 0.5 },
    
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: halloStart + hallo, end: halloStart + hallo + 0.5, locationArm: "shoulderR", hand: "right", distance: 0.1 },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: halloStart + hallo, end: halloStart + hallo + 0.5, handshape: "flat", thumbshape: "touch", hand: "right" },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: halloStart + hallo, end: halloStart + hallo + 0.5, palmor: "d", hand: "right" },
                        { type: "gesture", start: halloStart, attackPeak: halloStart + hallo * 0.5, relax: halloStart + hallo, end: halloStart + hallo + 0.5, extfidir: "u", hand: "right" },
                        { type: "gesture", start: halloStart + hallo * 0.4, attackPeak: halloStart + hallo, relax:halloStart + hallo, end: halloStart + hallo + 0.5, motion: "directed", direction: "r", distance: 0.05, curve:'u' },
                        // leuk                  
                        { type: "speech", start: leukStart, end: 100000, text: this.app.wordsToArpa("leuk", "NGT") + ".", sentT: leuk, sentInt: 0.8 },
    
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, locationArm: "chest", hand: "right", distance: 0.1, side:"r", sideDistance: 0.1 },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, handshape: "finger2", thumbshape:"opposed", hand: "right" },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, palmor: "u", hand: "right" },
                        { type: "gesture", start: leukStart, attackPeak: leukStart + leuk * 0.4, relax: 100000, end: 100000, extfidir: "uo", hand: "right", mode:"relative" },
                        
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: 100000, end: 100000, handshape: "pinch12", hand: "right" },
                        { type: "gesture", start: leukStart + leuk * 0.4, attackPeak: leukStart + leuk, relax: leukStart + leuk, end: leukStart + leuk + 0.5, motion: "directed", direction:"d", hand: "right" },
    
                                               
                        // ontmoeten
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5, locationArm: "stomach", hand: "right", distance: 0.025, side:"r", sideDistance: 0.1 },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5, locationArm: "stomach", hand: "left", distance: 0.075, side:"l", sideDistance: 0.1 },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5, handshape: "finger2", hand: "both" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5,  palmor: "l", hand: "right" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5,  palmor: "r", hand: "left" },
                        { type: "gesture", start: ontStart, attackPeak: ontStart + ontmoeten * 0.4, relax: end + 0.5, end: end + 1.5,  extfidir: "u", secondExtfidir: "uo", hand: "both" },
                        { type: "gesture", start: ontStart + ontmoeten * 0.4, attackPeak: ontStart + ontmoeten, relax: end + 0.5, end: end + 1.5, motion: "directed", direction:"l", hand: "both", lrSym: true, distance: 0.025, side:"r", sideDistance: 0.1 },
    
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
    
            tweeentwintig: () => {
                let start = 0.0;
                let sign = 2.0; // sign duration
                let relax = 0.5; // relax duration
                let end = start + sign + relax;
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "speech", start: start, end: 100000, text: this.app.wordsToArpa("tweeentwintig", "NGT") + ".", sentT: sign, sentInt: 0.25 },
    
                        { type: "gesture", start: start, attackPeak: start + sign * 0.4, relax: end - relax, end: end, handshape: "finger23spread", thumbshape: "across", hand: "right",  },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.4, relax: end - relax, end: end, extfidir: "u", hand: "right" },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.4, relax: end - relax, end: end, palmor: "ur", hand: "right" },
                        
                        { type: "gesture", start: start, attackPeak: start + sign * 0.4, relax: end - relax, end: end, locationArm: "chest", hand: "right", distance: 0.25, side: 'r', sideDistance: 0.05 },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.4, relax: end - relax, end: end, motion: "wrist", mode:"swing", hand: "right", intensity:0.1 },
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
    
            bos: () => {
                let start = 0.0;
                let sign = 3.0; // sign duration
                let relax = 0.5; // relax duration
                let end = start + sign + relax;
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, locationArm: "chest", hand: "both", lrSym: true, distance: 0.25, side: 'r', sideDistance: 0.08 },
                        
                        
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, handshape: "ceeall", thumbshape: "opposed", hand: "both"  },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, extfidir: "o", hand: "both" },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, palmor: "l", hand: "both", lrSym: true },
                        
                        { type: "speech", start:  start + sign * 0.1, end: 100000, text: this.app.wordsToArpa("bos", "NGT") + ".", sentInt: 0.5 },
                        { type: "gesture", start: start + sign * 0.1, attackPeak: start + sign, relax: end - relax, end: end, motion: "directed", direction:'r', distance: 0.05, hand: "right", zigzag: 'u', zigzagSize: 0.1 },
                        { type: "gesture", start: start + sign * 0.1, attackPeak: start + sign, relax: end - relax, end: end, motion: "directed", direction:'l', distance: 0.05, hand: "left", zigzag: 'd', zigzagSize: 0.1 },
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
    
            aarde: () => {
                let start = 0.0;
                let sign = 1.5; // sign duration
                let relax = 0.5; // relax duration
                let end = start + sign + relax;
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, locationArm: "chest", hand: "both", lrSym: true, distance: 0.2, side: 'r', sideDistance: 0.04 },
                        
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, handshape: "ceeall", thumbshape: "opposed", hand: "both"  },
                        
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, extfidir: "uo", hand: "both" },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, palmor: "u", hand: "both", lrSym: true },
                        
                        { type: "speech", start: start + sign * 0.1, end: 100000, text: this.app.wordsToArpa("aarde", "NGT") + ".", sentInt: 0.5 },
                        { type: "gesture", start: start + sign * 0.1, attackPeak: start + sign, relax: end - relax, end: end, motion: "directed", lrSym:true, direction:'r', distance: 0.05, hand: "both"},
                        { type: "gesture", start: start + sign * 0.1, attackPeak: start + sign*0.2, relax: start + sign*0.8, end: start + sign, motion: "fingerplay", hand: 'both', speed: 5, intensity: 0.7 },
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
    
            automatische: () => {
                let start = 0.0;
                let sign = 2.0; // sign duration
                let relax = 0.5; // relax duration
                let end = start + sign + relax;
                this.app.msg = {
                    type: "behaviours",
                    data: [
                        { type: "speech", start: start, end: 100000, text: this.app.wordsToArpa("automatisch", "NGT") + ".", sentInt: 0.5 },
    
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, locationArm: "stomach", hand: "right", distance: 0.22, side: 'ir', sideDistance: 0.06 },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, locationArm: "stomach", hand: "left", distance: 0.22, side: 'l', sideDistance: 0.13},
    
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, handshape: "flat", thumbshape: "touch", hand: "both"  },
    
                        // { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, extfidir: "o", secondExtfidir: "o", hand: "right", mode:"local"  },
                        // { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, extfidir: "o", hand: "left", mode:"local" },
    
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, extfidir: "ol", secondExtfidir: "o", hand: "right"  },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, extfidir: "or",secondExtfidir: "dor", hand: "left", },
    
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, palmor: "dl", hand: "right" },
                        { type: "gesture", start: start, attackPeak: start + sign * 0.1, relax: end - relax, end: end, palmor: "ur", hand: "left" },
                    
                       { type: "gesture", start: start + sign * 0.1, attackPeak: start + sign, relax: end - relax, end: end, motion: "circular", direction: "uir", endAngle:360*3, distance:0.02, hand: "right"},
    
                    ]
                };
                this.app.ECAcontroller.processMsg(JSON.stringify(this.app.msg));
            },
        };
        testFolder.add(testParams, "HALLO").name("Hallo");
        testFolder.add(testParams, "LEUK").name("Leuk");
        testFolder.add(testParams, "ONTMOETEN").name("Ontmoeten");
        testFolder.add(testParams, "HalloLeukOntmoeten").name("Hallo leuk ontmoeten");
        
        testFolder.add(testParams, "tweeentwintig").name("Tweeentwintig");
        testFolder.add(testParams, "bos").name("Bos");
        testFolder.add(testParams, "aarde").name("Aarde");
        testFolder.add(testParams, "automatische").name("Automatische");
        
    }
}

export { AppGUI };