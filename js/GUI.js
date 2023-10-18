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

        this.bmlInputData = { dialog: null, codeObj: null };
        this.sigmlInputData = { dialog: null, codeObj: null };
        this.glosInputData = { dialog: null, glosses: "", textArea: null };
    }

    createPanel(){

        new LX.PocketDialog( "Controls", p => {
            this.gui = p;
            // --------- Customization ---------
            p.branch( "Customization" );
            // get color set on the actual objects and set them as default values to the colorpicker
            let color = new THREE.Color();

            let chroma = this.app.scene.getObjectByName("Chroma");
            if ( chroma ){
                color.copy(chroma.material.color);
                let backPlaneColor = "#" + color.getHexString();
                p.addColor("Color Chroma", backPlaneColor, (value, event) => {
                    this.app.scene.getObjectByName("Chroma").material.color.set(value); // css works in sRGB
                });
            }
        
            let modelShirt = this.app.model.getObjectByName("Tops");
            if ( modelShirt ){
                color.copy(this.app.model.getObjectByName("Tops").material.color);
                let topsColor = "#" + color.getHexString();
    
                p.addColor("Color Clothes", topsColor, (value, event) => {
                    this.app.scene.getObjectByName("Tops").material.color.set(value); // css works in sRGB
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

                if ( this.bmlInputData.dialog ){ this.bmlInputData.dialog.close(); }

                this.bmlInputData.dialog = new LX.PocketDialog( "BML Instruction", p => {
                    this.bmlInputData.dialog = p;

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
        
                    let editor = new LX.CodeEditor(area, {
                        highlight: 'JSON',
                        skip_info: true,
                        allow_add_scripts: false, 
                        name : "BML"
                    });
                    if ( this.bmlInputData.codeObj ){ editor.setText( this.bmlInputData.codeObj.getText() ); }
                    this.bmlInputData.codeObj = editor;

                    p.addButton(null, "Send", () => {
                        let msg = {
                            type: "behaviours",
                            data: []
                        };
                        // JSON
                        try {
                            let text = this.bmlInputData.codeObj.getText().replaceAll("\n", "").replaceAll("\r", "");
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

                if ( this.sigmlInputData.dialog ){ this.sigmlInputData.dialog.close(); }

                this.sigmlInputData.dialog = new LX.PocketDialog( "SiGML Instruction", p => {
                    let htmlStr = "Write in the text area below the SiGML instructions (as in JaSigning) to move the avatar from the web application. Work in progress";
                    p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});       
        
                    const area = new LX.Area({ height: "85%" });
                    p.attach( area.root );
        
                    let editor = new LX.CodeEditor(area, {
                        highlight: 'xml',
                        skip_info: true,
                        allow_add_scripts: false, 
                        name : "XML"
                    });
                    if ( this.sigmlInputData.codeObj ){ editor.setText( this.sigmlInputData.codeObj.getText() ); }
                    this.sigmlInputData.codeObj = editor;
        
                    p.addButton(null, "Send", () => {
            
                        let msg = {
                            type: "behaviours",
                            data: []
                        };
                        let text = this.sigmlInputData.codeObj.getText().replaceAll("\n", "").replaceAll("\r", "");
                        msg.data = sigmlStringToBML( text ).data;
                        this.app.ECAcontroller.processMsg(JSON.stringify(msg));  
                    });
        
                }, { size: ["35%", "70%"], float: "right", draggable: false, closable: true});
            

            });

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

                if ( this.glosInputData.dialog ){ this.glosInputData.dialog.close(); }

                this.glosInputData.dialog = new LX.PocketDialog( "Glosses Input", p => {
                    p.refresh = () => {
                        p.clear();
                        let htmlStr = "Select or write in the text area below the glosses (NGT) to move the avatar from the web application. Work in progress";
                        p.addTextArea(null, htmlStr, null, {disabled: true, fitHeight: true});  
                        
                        const area = new LX.Area({ height: "85%" });
                        p.attach( area.root );
                        
                        p.addDropdown("Language", languages, this.app.selectedLanguage, (value, event) => {
                            this.app.selectedLanguage = value;
                            p.refresh();
                        } );

                        p.addDropdown("Select glosses", glossesDictionary[ this.language ], "", (value, event) => {
                            this.glosInputData.glosses += " " + value;
                            this.glosInputData.textArea.set( this.glosInputData.glosses );
                        }, {filter: true});
                        
                        this.glosInputData.textArea = p.addTextArea("Write glosses", this.glosInputData.glosses, (value, event) => {
                            this.glosInputData.glosses = value;
                        }, {placeholder: "Hallo Leuk"});

                        p.addButton(null, "Send", () => {
            
                            let glosses = this.glosInputData.glosses.replaceAll( "\n", " ").split( " " );
                            for ( let i = 0; i < glosses.length; ++i ){
                                if ( typeof( glosses[i] ) != "string" || glosses[i].length < 1 ){ 
                                    glosses.splice( i, 1 ); 
                                    --i; 
                                    continue; 
                                }
                                glosses[i] = glosses[i].toUpperCase();
                            }
                            if(!glosses.length) alert("Please, write or select at least one gloss");
                            this.app.processMessage( { IntermediateRepresentation: { glosses: glosses } } );    
                        });
                    }
                    p.refresh();
                }, { closable: true } );
               
            });
            
            p.addDropdown("Mood", [ "Neutral", "Anger", "Happiness", "Sadness", "Surprise", "Fear", "Disgust", "Contempt" ], "Neutral", (value, event) => {
                let msg = { type: "behaviours", data: [ { type: "faceEmotion", emotion: value.toUpperCase(), amount: 1, start: 0.0, shift: true } ] };
                this.app.ECAcontroller.processMsg(JSON.stringify(msg));
            });

            p.merge(); // end of customization

        }, { size: ["20%", null], float:"left", draggable:false});

    }
}

export { AppGUI };

