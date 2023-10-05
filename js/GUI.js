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

                
                new LX.PocketDialog( "BML Instruction", p => {

                    let htmlStr = "Write in the text area below the bml instructions to move the avatar from the web application. A sample of BML instructions can be tested through the helper tabs in the right panel.";
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
        
                    p.addButton(null, "Click here to see BML instructions and attributes", () => {
                        window.open("https://github.com/upf-gti/SignON-realizer/blob/SiGMLExperiments/docs/InstructionsBML.md");
                    });
        
                    htmlStr = "Note: In 'speech', all text between '%' is treated as actual words. An automatic translation from words (dutch) to phonemes (arpabet) is performed.";
                    htmlStr += "\n\nNote: Each instruction is inside '{}'. Each instruction is separated by a coma ',' except que last one.";
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
        
                    htmlStr = 'An example: { "type":"speech", "start": 0, "text": "%hallo%.", "sentT": 1, "sentInt": 0.5 }, { "type": "gesture", "start": 0, "attackPeak": 0.5, "relax": 1, "end": 2, "locationBodyArm": "shoulder", "lrSym": true, "hand": "both", "distance": 0.1 }';
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});
        
                    const area = new LX.Area({ height: "59%" });
                    p.attach( area.root );
        
                    window.editor = new LX.CodeEditor(area, {
                        highlight: 'JSON',
                        skip_info: true,
                        allow_add_scripts: false, 
                        name : "BML"
                    });
        
                    p.addButton(null, "Send", () => {
                        let msg = {
                            type: "behaviours",
                            data: []
                        };
                        // JSON
                        try {
                            let text = window.editor.getText().replaceAll("\n", "").replaceAll("\r", "");
                            msg.data = JSON.parse( "[" + text + "]" ); 
                        } catch (error) {
                            alert( "Invalid bml message. Check for errors such as proper quoting (\") of words or commas after each instruction (except the last one) and attribute." );
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
        
                }, { size: ["35%", "70%"], float: "right", draggable: false, closable: true});
            
            });

            p.addButton( null, "SiGML Input", (value, event) =>{
                new LX.PocketDialog( "SiGML Instruction", p => {
                    let htmlStr = "Write in the text area below the SiGML instructions (as in JaSigning) to move the avatar from the web application. Work in progress";
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});       
        
                    const area = new LX.Area({ height: "85%" });
                    p.attach( area.root );
        
                    window.editor = new LX.CodeEditor(area, {
                        highlight: 'xml',
                        skip_info: true,
                        allow_add_scripts: false, 
                        name : "XML"
                    });
        
                    p.addButton(null, "Send", () => {
            
                        let msg = {
                            type: "behaviours",
                            data: []
                        };
                        let text = window.editor.getText().replaceAll("\n", "").replaceAll("\r", "");
                        msg.data = sigmlStringToBML( text ).data;
                        this.app.ECAcontroller.processMsg(JSON.stringify(msg));  
                    });
        
                }, { size: ["35%", "70%"], float: "right", draggable: false, closable: true});
            

            });
            this.glosses = "";
            let languages = Object.keys(this.app.languageDictionaries);
            let glossesDictionary = {};
            this.language = languages[0];

            for(let i = 0; i < languages.length; i++) {
                let lang = languages[i];
                glossesDictionary[lang] = [];
                for(let glossa in this.app.languageDictionaries[lang].glosses) {
                    glossesDictionary[lang].push(glossa.replaceAll(".sigml", ""));
                }
            }
            p.addButton( null, "Glosses Input", (value, event) =>{

                
                new LX.PocketDialog( "Glosses Input", p => {
                    p.refresh = () => {
                        p.clear();
                        let htmlStr = "Write in the text area below the glosses (NGT) to move the avatar from the web application. Work in progress";
                        p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});  
                        
                        const area = new LX.Area({ height: "85%" });
                        p.attach( area.root );
                        
                        p.addDropdown("Language", languages, this.language, (value, event) => {
                            this.language = value;
                            p.refresh();
                        } );

                        
                        p.addDropdown("Glosses", glossesDictionary[this.language], "", (value, event) => {
                            this.glosses+= " " + value;
                            p.refresh();
                        }, {filter: true});
                        
                        p.addTextArea(null, this.glosses, (value, event) => {
                            this.glosses = value;
                            p.refresh();
                        });

                        p.addButton(null, "Send", () => {
            
                            let glosses = this.glosses.replaceAll( "\n", " ").split( " " );
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
                    }
                    p.refresh();
                }, {closable: true});
               
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

