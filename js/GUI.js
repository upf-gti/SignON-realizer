import * as THREE from "three"
import { sigmlStringToBML } from "./sigml/SigmlToBML.js";

class AppGUI{
    constructor( app ){
        this.app = app;

        // take canvas from dom, detach from dom, attach to lexgui 
        this.app.renderer.domElement.remove(); // removes from dom
        let main_area = LX.init();
        main_area.attach( this.app.renderer.domElement );

        this.gui = null;
        this.createPanel();
    }

    createPanel(){

        this.gui = new LX.PocketDialog( "Controls", p => {

            // --------- Customization ---------
            p.branch( "Customization" );
            // get color set on the actual objects and set them as default values to the colorpicker
            let color = new THREE.Color();

            let chroma = this.app.scene.getObjectByName("Chroma");
            if ( chroma ){
                color.copyLinearToSRGB(chroma.material.color);
                let backPlaneColor = "#" + color.getHexString();
                p.addColor("Color Chroma", backPlaneColor, (value, event) => {
                    let color = this.app.scene.getObjectByName("Chroma").material.color; // css works in sRGB
                    color.set(value);
                    color.copySRGBToLinear(color); // material.color needs to be in linearSpace
                });
            }
        
            let modelShirt = this.app.model.getObjectByName("Tops");
            if ( modelShirt ){
                color.copyLinearToSRGB(this.app.model.getObjectByName("Tops").material.color);
                let topsColor = "#" + color.getHexString();
    
                p.addColor("Color Clothes", topsColor, (value, event) => {
                    let color = this.app.scene.getObjectByName("Tops").material.color; // css works in sRGB
                    color.set(value);
                    color.copySRGBToLinear(color); // material.color needs to be in linearSpace
                });
            }

            p.addNumber("Signing Speed", 1, (value, event) => {
                // this.app.signingSpeed = Math.pow( Math.E, (value - 1) );
                this.app.signingSpeed = value;
            }, { min: "0", max: 2, step: 0.01});
            
            p.addButton( null, "Reset Pose", (value, event) =>{
                this.app.ECAcontroller.reset();
            });
            p.addButton( null, "BML Input", (value, event) =>{
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
                htmlStr += '<p>An example: <br>{ "type":"speech", "start": 0, "text": "%hallo%.", "sentT": 1, "sentInt": 0.5 }, <br> { "type": "gesture", "start": 0, "attackPeak": 0.5, "relax": 1, "end": 2, "locationBodyArm": "shoulder", "lrSym": true, "hand": "both", "distance": 0.1 }</p>';
                htmlStr += "<textarea id=\"bmlInput\" spellcheck=\"false\" placeholder=\"Write bml here\" style=\"width:100%; height:34%;\"></textarea>  ";
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
    
            
            });
            p.addButton( null, "SiGML Input", (value, event) =>{
                // open window and set all html elements (copy previous state)
                let handle = window.open("", "SiGML Input", "width=700, height=700");
                let previousText = "";
                while( handle.document.body.firstChild ){
                    if ( handle.document.body.firstChild.id == "sigmlInput" ){ previousText = handle.document.body.firstChild.value; }
                    handle.document.body.removeChild( handle.document.body.firstChild );
                }
    
                let htmlStr = "<p>Write in the text area below the SiGML instructions (as in JaSigning) to move the avatar from the web application. Work in progress</p>";
                htmlStr += "<textarea id=\"sigmlInput\" spellcheck=\"false\" placeholder=\"Write SiGML here\" style=\"width:100%; height:34%;\"></textarea>  ";
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
                    this.app.ECAcontroller.processMsg(JSON.stringify(msg));    
                });
            });

            p.addButton( null, "Glosses Input", (value, event) =>{
                // open window and set all html elements (copy previous state)
                let handle = window.open("", "Glosses NGT Input", "width=700, height=700");
                let previousText = "";
                while( handle.document.body.firstChild ){
                    if ( handle.document.body.firstChild.id == "input" ){ previousText = handle.document.body.firstChild.value; }
                    handle.document.body.removeChild( handle.document.body.firstChild );
                }
    
                let htmlStr = "<p>Write in the text area below the glosses (NGT) to move the avatar from the web application. Work in progress </p>";
                htmlStr += "<textarea id=\"input\" spellcheck=\"false\" placeholder=\"Write glosses here\" style=\"width:100%; height:34%;\"></textarea>  ";
                htmlStr += "<button id=\"sendButton\" type=\"button\" style=\"width:100%; height:9%\">Send</button> ";
                handle.document.write(htmlStr);
                let textarea = handle.document.getElementById( "input" );
                textarea.value = previousText;
                let button = handle.document.getElementById( "sendButton" );
                
                // generate msg and send it to ECAController
                button.addEventListener( "click", () => { 
                    // parse glosses array and remove undesired characters
                    let glosses = textarea.value;
                    glosses = glosses.replaceAll( "\n", " ").split( " " );
                    for ( let i = 0; i < glosses.length; ++i ){
                        if ( typeof( glosses[i] ) != "string" || glosses[i].length < 1 ){ 
                            glosses.splice( i, 1 ); 
                            --i; 
                            continue; 
                        }
                        glosses[i] = glosses[i].toUpperCase();
                    }
    
                    this.app.processMessage( { IntermediateRepresentation: { glosses: glosses } } );    
                
                });
            });
            
            p.addDropdown("Mood", [ "Neutral", "Anger", "Happiness", "Sadness", "Surprise", "Fear", "Disgust", "Contempt" ], "Neutral", (value, event) => {
                let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: value.toUpperCase(), amount: 1, start: 0.0, shift: true } ] };
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            });

            p.merge(); // end of customization

            // p.branch( "Preset Signs", { closed: true } );
            // p.merge(); // end of preset signs

        }, { size: ["20%", null], float:"left", draggable:false});

    }
}

export { AppGUI };