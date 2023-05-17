var fs = require('fs');


/** BML.js includes: 
 * - ./js/bml/BehaviourManager.js
 * - ./js/bml/BehaviourPlanner.js
 * - ./js/bml/BehaviourRealizer.js 
 *      - ./js/sigml/Extfidir.js
 *      - ./js/sigml/HandShapeRealizer.js
 *      - ./js/sigml/LocationArmIK.js
 *      - ./js/sigml/Motion.js
 *      - ./js/sigml/Palmor.js
 *      - ./js/sigml/sigmlUtils.js
 * */

/** CharacterController.js includes:
 * - ./js/controllers/CharacterController.js
 * - ./js/controllers/FacialController.js
 * - ./js/sigml/BodyController.js 
 * */

/** IKSolver.js --> Same as IKSolver.js */

/** SigmlToBML.js --> Same as SigmlToBML.js */

function build() {
    
    let files = {
        "BML.js": [
            ["", "../js/bml/BehaviourManager.js"],
            ["", "../js/bml/BehaviourPlanner.js"], 
            ["", "../js/bml/BehaviourRealizer.js"], 
            ["", "../js/sigml/Extfidir.js"],
            ["", "../js/sigml/HandShapeRealizer.js"],
            ["", "../js/sigml/LocationArmIK.js"],
            ["", "../js/sigml/Motion.js"],
            ["", "../js/sigml/Palmor.js"],
            ["", "../js/sigml/sigmlUtils.js"]
        ],
        "CharacterController.js": [
            ["BML", "../js/controllers/CharacterController.js"],
            ["BML", "../js/controllers/FacialController.js"],
            ["BML", "../js/sigml/BodyController.js"],
        ],
        "IKSolver.js" : [["", "../js/sigml/IKSolver.js"]],
        "SigmlToBML.js": [["", "../js/sigml/SigmlToBML.js"]],
        "app.js": [["CharacterController", "../js/app.js"]]
    };
    
    //change import files of classes
    
    let readedFiles = [];
    for(let filename in files) {
        
        readFiles(files[filename], 
            (data) => {
                // let imports = "";
                // if(filename == "app.js") {
                //     for(let i = 0; i < readedFiles.length; i++) {
                //         let classToImport = readedFiles[i].split("/");
                //         classToImport = classToImport[classToImport.length-1].split(".");
                //         classToImport = classToImport[0];
                //         imports += "import {" + classToImport + "} from '" + readedFiles[i] + "'\n";
                //     }
                //     data = imports + data;
                // }
                fs.writeFile(filename, data, (err) => {
                    if (err) console.log(err);
                    console.log("Successfully Written to ", filename);
                });
                readedFiles.push(filename);
            },
            (err) => {
                
                if (err) console.log(err);    
               
            },
        )
    }
}

function readFiles(filenames, onFileContent, onError) {
 
    let globals = [];
    let exports = [];
    let contentFile = ""; //"(function(global){\n";
    let files = filenames.map((x) => {let a = x[1].split("."); return a[a.length-2]});
    //console.log(files)
    for(let i = 0; i < filenames.length; i++) {
        let context = filenames[i][0];
        let filename = filenames[i][1];
        let content = fs.readFileSync(filename, 'utf-8');
        let newContent = "";
        content.split(/\r?\n/).forEach(line =>  {
            if(line.includes("import "))
            {
                let includes = files.map((x) => { return line.includes(x)});
                if(includes.indexOf(true)>-1) {
                    
                }
                else{
                    newContent += line + "\r";
                }
            }
            else if(line.includes("export ")) {
                console.log(line)
                let classes = line.replace("export ", "").replace("{", "").replace("}", "").replace(";", "");
                console.log(classes)
                classes = classes.split(",");
                exports = [...exports, ...classes]
            }
            else if(line.slice(0,3) == 'let' ) {
                let global = line.split("=")[0];
                let includes = globals.map( x => {
                    
                    return line.includes(x)
                });

                if(includes.indexOf(true)>-1) {
                }else {
                    globals.push(global);
                    newContent += line + "\r";
                }
            }
            else
                newContent += line + "\r";
          });
        contentFile += 
        // "/** \n"+
        // "* @class "+ context + "\n*/ " +
        newContent + "\n" 
        

    }
    // contentFile += "})( typeof(window) != 'undefined' ? window : (typeof(self) != 'undefined' ? self : global ) );\n\n\n";
    console.log(exports)
    contentFile += "export { " + exports.join(", ") + "} \n";
    onFileContent(contentFile);

}

build();