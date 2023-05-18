let fs = require('fs');
let path = require('path');

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
        "./js/BML.js": [
            "../js/bml/BehaviourManager.js",
            "../js/bml/BehaviourPlanner.js", 
            "../js/bml/BehaviourRealizer.js", 
            "../js/sigml/Extfidir.js",
            "../js/sigml/HandShapeRealizer.js",
            "../js/sigml/LocationArmIK.js",
            "../js/sigml/Motion.js",
            "../js/sigml/Palmor.js",
            "../js/sigml/sigmlUtils.js"
        ],
        "./js/CharacterController.js": [
            "../js/controllers/CharacterController.js",
            "../js/controllers/FacialController.js",
            "../js/sigml/BodyController.js",
        ],
        "./js/IKSolver.js" : ["../js/sigml/IKSolver.js"],
        "./js/SigmlToBML.js": [ "../js/sigml/SigmlToBML.js"],
        "./js/app.js": ["../js/app.js"]
    };
    
    //change import files of classes
    
    let readedFiles = {};
    let toImport = {};

    for(let filename in files) {
        
        readFiles(files[filename], 
            (data, imports) => {
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
                
                toImport[filename] = imports;
                readedFiles[filename] = data;
            },
            (err) => {
                
                if (err) console.log(err);    
               
            },
        )
    }
    console.log(toImport)
    
    let filenames = Object.values(files);
    let newFilenames = Object.keys(files);

    for(let filename in files) {
        let newPaths = {};
        let imports = toImport[filename];

        for(let oldPath in imports) {
            let classes = imports[oldPath];
            let newPath = oldPath;
            if(!oldPath.includes("three")) 
            {
                let p =  oldPath.split("/"); 
                p = p[p.length-1];
     
                let idx = filenames.findIndex(x => {
                    let a = x.map( f => {
                        let a = f.split("/");
                        return a[a.length-1];
                    })
    
                    return a.indexOf(p) > -1 ;       
                });
                console.log(idx + ": ", newFilenames[idx] + " -> "+ p);
                newPath = newFilenames[idx];
            }
            if(newPath == undefined)
                continue;
            if(newPaths[newPath])
                newPaths[newPath] = [...newPaths[newPath], ...classes];
            else
                newPaths[newPath] = classes;
        }
        console.log(newPaths)
        let data = "";
        for(let newPath in newPaths) {

            let classes = newPaths[newPath].join(", ");
            console.log(classes, classes.includes("*"))
            if(!classes.includes("*"))
                classes = "{ " + classes + " }";
                
           data += "import " + classes + " from '" + newPath + "';\n";
           
        }
        data += readedFiles[filename];
        
        function ensureDirectoryExistence(filePath) {
            var dirname = path.dirname(filePath);
            if (fs.existsSync(dirname)) {
              return true;
            }
            ensureDirectoryExistence(dirname);
            fs.mkdirSync(dirname);
          }
        ensureDirectoryExistence(filename);

        fs.writeFile(filename, data, (err) => {
            if (err) console.log(err);
            console.log("Successfully Written to ", filename);
        });
        }
}

function readFiles(filenames, onFileContent, onError) {
 
    let globals = [];
    let imports = {};
    let exports = [];
    let contentFile = ""; //"(function(global){\n";
    let files = filenames.map((x) => {let a = x.split("."); return a[a.length-2]});

    for(let i = 0; i < filenames.length; i++) {
        let filename = filenames[i];
        let content = fs.readFileSync(filename, 'utf-8');
        let newContent = "";
        content.split(/\r?\n/).forEach(line =>  {
            if(line.includes("import "))
            {

                line = line.replace("import ", "");
                let oldPath = line.split("from ")[1];
                line = line.replace("from " + oldPath, "");
                oldPath = oldPath.replaceAll(/[\'\"\;]/g, "");

                let str = "";
                if(line.includes("*")) {
                    str = [line];
                }
                else {

                    str = line.split("{")[1];
                    str = str.split("}")[0];
                    str = str.replaceAll(" ", "");
                    str = str.split(",");
                }
                if(imports[oldPath] != undefined) {
                    
                    for(let j = 0; j < str.length; j++) {
                        
                        if(imports[oldPath].indexOf(str[j]) < 0)
                            imports[oldPath].push(str[j]);
                    }
                }
                else {
                    imports[oldPath] = str;
                }
            }
            else if(line.includes("export ")) {
               
                let classes = line.replace("export ", "").replace("{", "").replace("}", "").replace(";", "");
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
    onFileContent(contentFile, imports);

}

build();