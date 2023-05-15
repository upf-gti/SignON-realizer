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
            ["BML", "../js/bml/BehaviourManager.js"],
            ["BML", "../js/bml/BehaviourPlanner.js"], 
            ["BML", "../js/bml/BehaviourRealizer.js"], 
            ["BML", "../js/sigml/Extfidir.js"],
            ["BML", "../js/sigml/HandShapeRealizer.js"],
            ["BML", "../js/sigml/LocationArmIK.js"],
            ["BML", "../js/sigml/Motion.js"],
            ["BML", "../js/sigml/Palmor.js"],
            ["BML", "../js/sigml/sigmlUtils.js"]
        ],
        "CharacterController.js": [
            ["CC", "../js/controllers/CharacterController.js"],
            ["CC", "../js/controllers/FacialController.js"],
            ["CC", "../js/sigml/BodyController.js"],
        ],
        "IKSolver.js" : [["IK", "../js/sigml/IKSolver.js"]],
        "SigmlToBML.js": [["ParserSIGML", "../js/sigml/SigmlToBML.js"]]
    };
    
    for(let filename in files) {
        readFiles(files[filename], 
            (data) => {
            
                fs.writeFile(filename, data, (err) => {
                    if (err) console.log(err);
                    console.log("Successfully Written to ", filename);
                });
            },
            (err) => {
                
                if (err) console.log(err);    
               
            },
        )
    }
}

function readFiles(filenames, onFileContent, onError) {
 
    let globals = [];
    let contentFile = "(function(global){\n";
    let files = filenames.map((x) => {let a = x[1].split(".").pop(); return a[a.length-1]});
    console.log(files)
    for(let i = 0; i < filenames.length; i++) {
        let context = filenames[i][0];
        let filename = filenames[i][1];
        let content = fs.readFileSync(filename, 'utf-8');
        let newContent = "";
        content.split(/\r?\n/).forEach(line =>  {
            if((line.includes("import ") || line.includes("export ")) && files.map((x) => line.includes(x)))
            {
            }
            else if(line.slice(0,3) == 'let' ) {
                if(globals.map( x => line.includes(x))) {

                }else {
                    globals.push(line);
                    newContent += line + "\r";
                }
            }
            else
                newContent += line + "\r";
          });
        contentFile += 
        "/** \n"+
        "* @class "+ context + "\n*/ " +
        newContent + "\n" 

    }
    contentFile += "})( typeof(window) != 'undefined' ? window : (typeof(self) != 'undefined' ? self : global ) );\n\n\n";
    onFileContent(contentFile);

}

build();