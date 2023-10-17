//@FacialController

import { Blink, FacialExpr, FacialEmotion, GazeManager, Gaze, HeadBML, Lipsync, Text2LipInterface, T2LTABLES } from '../bml/BehaviourRealizer.js';
import * as THREE from 'three';

import { findIndexOfBone } from "../sigml/SigmlUtils.js"

function FacialController(config = null) {
    
    // define some properties
    this.headNode = "mixamorig_Head";
    this.neckNode = "mixamorig_Neck";
    this.lookAt = "target";
    this.lookAtEyes = "eyesTarget";
    this.lookAtHead = "headTarget";
    this.lookAtNeck = "neckTarget";

    this._gazePositions = {
        "RIGHT": new THREE.Vector3(-30, 2, 100), "LEFT": new THREE.Vector3(30, 2, 100),
        "UP": new THREE.Vector3(0, 20, 100), "DOWN": new THREE.Vector3(0, -20, 100),
        "UP_RIGHT": new THREE.Vector3(-30, 20, 100), "UP_LEFT": new THREE.Vector3(30, 20, 100),
        "DOWN_RIGHT": new THREE.Vector3(-30, -20, 100), "DOWN_LEFT": new THREE.Vector3(30, -20, 100),
        "FRONT": new THREE.Vector3(0, 2, 100), "CAMERA": new THREE.Vector3(0, 2, 100)
    };

    // TODO: updatet2l names ?
    this.squintBSName = "Squint";
    this.eyelidsBSName = "Blink";
    this.smileBSName = "Smile";
    this.sadBSName = "Sad";
    this.kissBSName = "MouthWhistle";
    this.lipsPressedBSName = "Jaw_Up";
    this.lowerLipINBSName = "Lip_Suck_Lower"; //"LowerLipIn";
    this.lowerLipDownBSName = "Lower_Lip_Depressor_Left"; //"LowerLipDown";
    this.mouthNarrowBSName = "MouthNarrow";
    this.mouthOpenBSName = "MouthOpen";
    this.tongueBSName = "Tongue";

    this.browsDownBSName = "BrowsDown";
    this.browsInnerUpBSName = "BrowsIn";
    this.browsUpBSName = "BrowsUp";

    this._morphTargets = {}; // current avatar morph targets
    this._mappingBS = {}; // mappings of current (target) avatar BS to default (source) morph deformers
    this._body = "BodyMesh"; // name of the avatar's body mesh
    this._boneMap = {}; // bone name to index mapper
    
    // default morph deformers
    this._morphDeformers = {
        "Body": {
            "morphTargetDictionary": {
                "Inner_Brow_Raiser": 0, "Outer_Brow_Raiser_Left": 1, "Outer_Brow_Raiser_Right": 2, "Brow_Lowerer_Left": 3, "Brow_Lowerer_Right": 4, "Nose_Wrinkler_Left": 5, "Nose_Wrinkler_Right": 6, "Nostril_Dilator": 7, "Nostril_Compressor": 8,
                "Dimpler_Left": 9, "Dimpler_Right": 10, "Upper_Lip_Raiser_Left": 11, "Upper_Lip_Raiser_Right": 12, "Lip_Corner_Puller_Left": 13, "Lip_Corner_Puller_Right": 14, "Lip_Corner_Depressor_Left": 15, "Lip_Corner_Depressor_Right": 16,
                "Lower_Lip_Depressor_Left": 17, "Lower_Lip_Depressor_Right": 18, "Lip_Puckerer_Left": 19, "Lip_Puckerer_Right": 20, "Lip_Stretcher_Left": 21, "Lip_Stretcher_Right": 22, "Lip_Funneler": 23, "Lip_Tightener": 24, "Lip_Pressor_Left": 25,
                "Lip_Pressor_Right": 26, "Lips_Part": 27, "Lip_Suck_Upper": 28, "Lip_Suck_Lower": 29, "Lip_Wipe": 30, "Tongue_Show": 31, "Tongue_Bulge": 32, "Mouth_Stretch": 33, "Jaw_Drop": 34, "Jaw_Thrust": 35, "Jaw_Sideways_Left": 36, "Jaw_Sideways_Right": 37,
                "Chin_Raiser": 38, "Cheek_Raiser_Left": 39, "Cheek_Raiser_Right": 40, "Cheek_Blow_Left": 41, "Cheek_Blow_Right": 42, "Cheek_Suck_Left": 43, "Cheek_Suck_Right": 44, "Upper_Lid_Raiser_Left": 45, "Upper_Lid_Raiser_Right": 46, "Lid_Tightener": 47,
                "Eyes_Closed": 48, "Squint_Left": 49, "Squint_Right": 50, "Blink_Left": 51, "Blink_Right": 52, "Wink_Left": 53, "Wink_Right": 54, "Neck_Tightener": 55
            },
            "morphTargetInfluences": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        "Eyelashes": {
            "morphTargetDictionary": {
                "Upper_Lid_Raiser_Left": 45, "Upper_Lid_Raiser_Right": 46, "Eyes_Closed": 48, "Squint_Left": 49, "Squint_Right": 50, "Blink_Left": 51, "Blink_Right": 52, "Wink_Left": 53, "Wink_Right": 54
            },
            "morphTargetInfluences": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
    };
    
    // weighting factor for t2l interface
    this._t2lFactor = {
        "kiss": {
            "Lip_Puckerer_Left": 1.0,
            "Lip_Puckerer_Right": 1.0
        },
        "upperLipClosed": { "Lip_Suck_Upper": 1.0 }, 
        "lowerLipClosed": {"Lip_Suck_Lower": 1.0 },
        "jawOpen": { "Mouth_Stretch": 1.0 },
        "tongueFrontUp": { "Tongue_Show": 1.0 },
    };
        
    this.lipsyncModule = new Lipsync();

    // if we have the state passed, then we restore the state
    if (config)
        this.configure(config);
}


FacialController.prototype.configure = function (o) {

    if (o.character) {
        this.character = o.character;
     
        // get skeleton
        let skeleton = this.skeleton = null;
        this.character.traverse( ob => {
            if ( ob.isSkinnedMesh ) {
                skeleton = this.skeleton = ob.skeleton;
            }
        } );

    }
    if (o.headNode) this.headNode = o.headNode;
    if (o.lookAt) this.lookAt = o.lookAt;
    if (o.lookAtEyes) this.lookAtEyes = o.lookAtEyes;
    if (o.lookAtHead) this.lookAtHead = o.lookAtHead;
    if (o.lookAtNeck) this.lookAtNeck = o.lookAtNeck;
    if (o.gazePositions) this._gazePositions = o.gazePositions;
    // if (o.morphTargets) this._morphDeformers = o.morphTargets;
    if (o.morphTargets) this._morphTargets = o.morphTargets;

    if(o.characterConfig) {
        this._mappingBS = o.characterConfig.faceController.blendshapeMap;
        this._body = o.characterConfig.Body;
        this._boneMap = o.characterConfig.faceController.boneMap;
    
        /** BoneMap */
        // name to index map
        for ( let p in this._boneMap ){
            this._boneMap[ p ] = findIndexOfBone( this.skeleton, this._boneMap[ p ] );            
        }
    }
}

FacialController.prototype.start = function (morphTargets) {
    // console.log(this._facialBS);
    
    if (!morphTargets) {
        // Get morph targets
        morphTargets = {
            Body: this.character.getObjectByName(this._body),
            Eyelashes: this.character.getObjectByName("Eyelashes")
        }
        this._morphTargets = morphTargets;
    }
    
    this._facialBSAcc = {};
    this._facialBSFinal = {};
    
    this._facialBS = {};
    this._eyeLidsBS = [];
    this._squintBS = [];
    
    if (morphTargets) {
        for (let part in this._morphDeformers) {

            let eyelidsIdx = [];
            let squintIdx = [];
            this._facialBS[part] = this._morphDeformers[part].morphTargetInfluences.slice(); // clone array
            this._facialBSAcc[part] = this._morphDeformers[part].morphTargetInfluences.slice(); // clone array;
            this._facialBSFinal[part] = this._morphDeformers[part].morphTargetInfluences.slice(); // clone array;

            let BSnames = Object.keys(this._morphDeformers[part].morphTargetDictionary);

            for (let i = 0; i < BSnames.length; ++i) {
                let name = BSnames[i];
                
                // Eyelashes things
                // if (name.toLocaleLowerCase().includes(this.eyelidsBSName.toLocaleLowerCase())) // get blendshape indices of eyelids
                // eyelidsIdx.push(this._morphDeformers[part].morphTargetDictionary[name]);
                if (name.toLocaleLowerCase().includes("blink")) // get blendshape indices of eyelids
                eyelidsIdx.push(this._morphDeformers[part].morphTargetDictionary[name]);
                if (name.toLocaleLowerCase().includes("eyes_closed")) // get blendshape indices of eyelids
                eyelidsIdx.push(this._morphDeformers[part].morphTargetDictionary[name]);
                if (name.toLocaleLowerCase().includes("wink")) // get blendshape indices of eyelids
                eyelidsIdx.push(this._morphDeformers[part].morphTargetDictionary[name]);

                if (name.toLocaleLowerCase().includes(this.squintBSName.toLocaleLowerCase())) // get blendshape indices of squint
                squintIdx.push(this._morphDeformers[part].morphTargetDictionary[name]);

            }
            this._eyeLidsBS.push(eyelidsIdx);
            this._squintBS.push(squintIdx);

        }
    }

    if (!this._morphDeformers) {
        console.error("Morph deformer not found");
        return;
    }
    
    this.resetFace();

    this._FacialLexemes = [];
    this.FA = new FacialEmotion(this._facialBS);
    
    // Gaze
    // Get head bone node
    if (!this._boneMap.Head)
    console.error("Head bone node not found with id: ");
    else if (!this._gazePositions["HEAD"]) {
        let headNode = this.skeleton.bones[this._boneMap.Head] // let headNode = this.character.getObjectByName(this.headNode)
        this._gazePositions["HEAD"] = headNode.getWorldPosition(new THREE.Vector3());
    }

    // Get lookAt nodes  
    let lookAtEyesNode = this.character.eyesTarget;
    let lookAtNeckNode = this.character.neckTarget;
    let lookAtHeadNode = this.character.headTarget;

    if (!this.lookAtEyes)
    console.error("LookAt Eyes not found");
    else if (!this._gazePositions["EYESTARGET"])
    this._gazePositions["EYESTARGET"] = lookAtEyesNode.getWorldPosition(new THREE.Vector3());

    if (!this.lookAtHead)
    console.error("LookAt Head not found");
    else if (!this._gazePositions["HEADTARGET"])
    this._gazePositions["HEADTARGET"] = lookAtHeadNode.getWorldPosition(new THREE.Vector3());

    if (!this.lookAtNeck)
    console.error("LookAt Neck not found");
    else if (!this._gazePositions["NECKTARGET"])
    this._gazePositions["NECKTARGET"] = lookAtNeckNode.getWorldPosition(new THREE.Vector3());

    // Gaze manager
    this.gazeManager = new GazeManager(lookAtNeckNode, lookAtHeadNode, lookAtEyesNode, this._gazePositions);

    this.headBML = []; //null;

    this.autoBlink = new Blink();

}

FacialController.prototype.reset = function ( keepEmotion = false ) {
    
    this.resetFace(); // blendshapes to 0
    
    if (this.textToLip) { this.textToLip.cleanQueueSentences(); }
    if (this.lipsyncModule) { this.lipsyncModule.stop(); }

    this._FacialLexemes.length = 0;
    if ( !keepEmotion ){ this.FA.reset(); } 

    this.gazeManager.reset();
    this.headBML.length = 0;
}

FacialController.prototype.resetFace = function () {
    
    for (let part in this._facialBS) {
        for (let i = 0; i < this._facialBS[part].length; i++) {
            this._facialBS[part][i] = 0;
            this._facialBSAcc[part][i] = 0;
            this._facialBSFinal[part][i] = 0;
            this._morphDeformers[part].morphTargetInfluences[i] = 0;
            // this._morphTargets[part].morphTargetInfluences[i] = 0;
        }
    }
}

/**  public update function (update inner BS and map them to current avatar) */ 
FacialController.prototype.update = function (dt) {

    // Update Facial BlendShapes
    this.innerUpdate(dt);

    // Map facialBS to current model BS
    for (let part in this._morphDeformers) {
        let targetAccumulatedValues = {}; // store multiple value for each target

        for (let defBSName in this._mappingBS[part]) {
            let currBSnames = this._mappingBS[part][defBSName]; // array of target avatar BS [names, factor]
            
            let idx = this._morphDeformers[part].morphTargetDictionary[defBSName]; // index of source blendshape
            let value = this._morphDeformers[part].morphTargetInfluences[idx]; // value of source blendshape

            // map source value to all target BS
            for (let i = 0; i < currBSnames.length; i++) {
                let targetBSName = currBSnames[i][0];
                let targetBSFactor = currBSnames[i][1];
                
                if (!targetAccumulatedValues[targetBSName]) { targetAccumulatedValues[targetBSName] = []; }
                targetAccumulatedValues[targetBSName].push(value * targetBSFactor); // store the value in the array for this target
            }
        }
        
        // compute the mean influence value for each target
        for (let targetBSName in targetAccumulatedValues) {
            let values = targetAccumulatedValues[targetBSName];
            let meanValue = 0;
            let acc = 0;
            let final = 0;

            for (let i = 0; i < values.length; i++) {
                acc += Math.abs(values[i]);
                final += values[i] * Math.abs(values[i]);
            }

            if (acc > 0.0001) meanValue = final / acc;
    
            // update the target blendshape with the mean value
            let targetIdx = this._morphTargets[part].morphTargetDictionary[targetBSName];
            if (targetIdx !== undefined) {
                this._morphTargets[part].morphTargetInfluences[targetIdx] = meanValue;
            }
        }
    }
}
    
//example of one method called for ever update event
FacialController.prototype.innerUpdate = function (dt) {

    // Update facial expression
    this.faceUpdate(dt);

    let lookAtEyes = this.character.eyesTarget.getWorldPosition(new THREE.Vector3());
    let lookAtHead = this.character.headTarget.getWorldPosition(new THREE.Vector3());
    let lookAtNeck = this.character.headTarget.getWorldPosition(new THREE.Vector3());
    
    this.skeleton.bones[this._boneMap.Neck].lookAt(lookAtNeck);
    this.skeleton.bones[this._boneMap.Head].lookAt(lookAtHead);
    
    // HEAD (nod, shake, tilt, tiltleft, tiltright, forward, backward)
    let headQuat = this.skeleton.bones[this._boneMap.Head].quaternion; // Not a copy, but a reference
    let neckQuat = this.skeleton.bones[this._boneMap.Neck].quaternion; // Not a copy, but a reference
    for( let i = 0; i< this.headBML.length; ++i){
        let head = this.headBML[i];
        if( !head.transition ){
            this.headBML.splice(i,1);
            --i;
            continue;
        }
        head.update(dt);
        if(head.lexeme == "FORWARD" || head.lexeme == "BACKWARD") {
            neckQuat.multiply( head.currentStrokeQuat );
            headQuat.multiply( head.currentStrokeQuat.invert() );
            head.currentStrokeQuat.invert(); // inverting quats is cheap
        } 
        else
            headQuat.multiply( head.currentStrokeQuat );
    }

    this.skeleton.bones[this._boneMap.LEye].lookAt(lookAtEyes);
    this.skeleton.bones[this._boneMap.REye].lookAt(lookAtEyes);
}

// Update facial expressions
FacialController.prototype.faceUpdate = function (dt) {
    
    let keys = Object.keys(this._facialBSAcc);
    // for each part (body, eyelashes), reset accumulators for biased average
    for (let i = 0; i < keys.length; ++i) {
        this._facialBSAcc[keys[i]].fill(0);
        this._facialBSFinal[keys[i]].fill(0);
    }

    // Text to lip
    if (this.textToLip && this.textToLip.getCompactState() == 0) { // when getCompactState==0 lipsync is working, not paused and has sentences to process
        this.textToLip.update(dt);
        let t2lBSW = this.textToLip.getBSW(); // reference, not a copy
        for (let i = 0; i < this.textToLipBSMapping.length; i++) {
            let mapping = this.textToLipBSMapping[i];
            let value = Math.min(1, Math.max(-1, t2lBSW[mapping[1]] * mapping[2]));
            let index = mapping[0];
            // for this model, some blendshapes need to be negative
            this._facialBSAcc["Body"][index] += Math.abs(value); // denominator of biased average
            this._facialBSFinal["Body"][index] += value * Math.abs(value); // numerator of biased average
        }
    }

    // lipsync
    if (this.lipsyncModule && this.lipsyncModule.working) // audio to lip
    {
        this.lipsyncModule.update(dt);
        let facialLexemes = this.lipsyncModule.BSW;
        if (facialLexemes) {

            let smooth = 0.66;
            let BSAcc = this._facialBSAcc["Body"];
            let BSFin = this._facialBSFinal["Body"];
            let BS = this._morphDeformers["Body"].morphTargetInfluences; // for smoothing purposes
            let morphDict = this._morphDeformers["Body"].morphTargetDictionary;
            // search every morphTarget to find the proper ones
            let names = Object.keys(morphDict);
            for (let i = 0; i < names.length; i++) {

                let name = names[i];
                let bsIdx = morphDict[name];
                let value = 0;
                if (name.includes(this.mouthOpenBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[2];

                if (name.includes(this.lowerLipINBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                if (name.includes(this.lowerLipDownBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                if (name.includes(this.mouthNarrowBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[0] * 0.5;

                if (name.includes(this.lipsPressedBSName))
                    value = (1 - smooth) * BS[bsIdx] + smooth * facialLexemes[1];

                BSAcc[bsIdx] += Math.abs(value); // denominator of biased average
                BSFin[bsIdx] += value * Math.abs(value); // numerator of biased average

            }
        }
    }

    //FacialEmotion ValAro/Emotions
    this.FA.updateVABSW(dt);

    for (let j = 0; j < this.FA.currentVABSW.length; j++) {
        let value = this.FA.currentVABSW[j];
        this._facialBSAcc["Body"][j] += Math.abs(value); // denominator of biased average
        this._facialBSFinal["Body"][j] += value * Math.abs(value); // numerator of biased average
    }

    // FacialExpr lexemes
    for (let k = 0; k < this._FacialLexemes.length; k++) {
        let lexeme = this._FacialLexemes[k];
        if (lexeme.transition) {
            lexeme.updateLexemesBSW(dt);
            // accumulate blendshape values
            for (let i = 0; i < lexeme.indicesLex.length; i++) {
                for (let j = 0; j < lexeme.indicesLex[i].length; j++) {
                    let value = lexeme.currentLexBSW[i][j];
                    let index = lexeme.indicesLex[i][j];
                    this._facialBSAcc["Body"][index] += Math.abs(value); // denominator of biased average
                    this._facialBSFinal["Body"][index] += value * Math.abs(value); // numerator of biased average
                }
            }
        }

        // remove lexeme if finished
        if (!lexeme.transition) {
            this._FacialLexemes.splice(k, 1);
            --k;
        }
    }

    // Gaze
    if (this.gazeManager){
        let weights = this.gazeManager.update(dt);

        // eyelids update
        for(let i = 0; i< this._eyeLidsBS[0].length; i++){         
            this._facialBSAcc[ "Body" ][ this._eyeLidsBS[0][i] ] += Math.abs(weights.eyelids);
            this._facialBSFinal[ "Body" ][ this._eyeLidsBS[0][i] ] += weights.eyelids * Math.abs(weights.eyelids);
        }
        // squint update
        for(let i = 0; i< this._squintBS[0].length; i++){         
            this._facialBSAcc[ "Body" ][ this._squintBS[0][i] ] += Math.abs(weights.squint);
            this._facialBSFinal[ "Body" ][ this._squintBS[0][i] ] += weights.squint * Math.abs(weights.squint);
        }
    }


    // Second pass, compute mean (division)
    // result = ( val1 * |val1|/|sumVals| ) + ( val2 * |val2|/|sumVals| ) + ...
    // copy blendshape arrays back to real arrays and compute biased average  
    let target = this._facialBS["Body"];
    let numerator = this._facialBSFinal["Body"];
    let acc = this._facialBSAcc["Body"];
    for (let i = 0; i < target.length; ++i) {
        if (acc[i] < 0.0001) { target[i] = 0; }
        else { target[i] = numerator[i] / acc[i]; }
    }

    // --- UPDATE POST BIASED AVERAGE --- 
    // this._facialBS has all the valid values

    // Eye blink
    if (!this.autoBlink.between) {
        this.autoBlink.update(dt, this._facialBS["Body"][this._eyeLidsBS[0][0]], this._facialBS["Body"][this._eyeLidsBS[0][1]]);
        this._facialBS["Body"][this._eyeLidsBS[0][0]] = this.autoBlink.weights[0];
        this._facialBS["Body"][this._eyeLidsBS[0][1]] = this.autoBlink.weights[1];
    }

    // fix eyelashes after all facial is done
    for (let i = 0; i < this._eyeLidsBS[0].length; i++) {
        this._facialBS["Eyelashes"][this._eyeLidsBS[1][i]] = this._facialBS["Body"][this._eyeLidsBS[0][i]];
    }
    for (let i = 0; i < this._squintBS[0].length; i++) {
        this._facialBS["Eyelashes"][this._squintBS[1][i]] = this._facialBS["Body"][this._squintBS[0][i]];
    }

    // "Render" final facial (body && eyelashes) blendshapes
    // copy blendshape arrays back to real arrays 
    for (let part in this._morphDeformers) {
        let target = this._morphDeformers[part].morphTargetInfluences;
        let source = this._facialBS[part];
        for (let i = 0; i < target.length; ++i) {
            target[i] = source[i];
        }
    }


}


// ----------------------- TEXT TO LIP --------------------
// Create a Text to Lip mouthing
FacialController.prototype.newTextToLip = function (bml) {
    
    if (!this.textToLip) { // setup

        this.textToLip = new Text2LipInterface();
        this.textToLip.start(); // keep started but idle
        this.textToLipBSMapping = []; // array of [ MeshBSIndex, T2Lindex, factor ]

        let t2lBSWMap = T2LTABLES.BlendshapeMapping;

        // map blendshapes to text2lip output
        for(const part in this._t2lFactor) {
            for(const BSName in this._t2lFactor[part]) {
                // instead of looping through all BS, access directly the index of the desired blendshape
                let idx = this._morphDeformers["Body"].morphTargetDictionary[BSName];
                if (idx) this.textToLipBSMapping.push([ idx, t2lBSWMap[part], this._t2lFactor[part][BSName]]);
            }
        }
    }

    let text = bml.text;
    if ( text[ text.length - 1 ] != "." ){ text += "."; } 
    this.textToLip.cleanQueueSentences();
    this.textToLip.pushSentence(bml.text, bml); // use info object as options container also  
}


// --------------------- lipsync --------------------------------
// Create a Text to Lip mouthing
FacialController.prototype.newLipsync = function (bml) {
    
    if (!this.lipsyncModule)
        return;

    if (bml.audio)
        this.lipsyncModule.loadBlob(bml.audio);
    else if (bml.url)
        this.lipsyncModule.loadSample(bml.url);
}


// --------------------- FACIAL EXPRESSIONS ---------------------
// BML
// <face or faceShift start attackPeak relax* end* valaro
// <faceLexeme start attackPeak relax* end* lexeme amount
// <faceFacs not implemented>
// lexeme  [OBLIQUE_BROWS, RAISE_BROWS,
//      RAISE_LEFT_BROW, RAISE_RIGHT_BROW,LOWER_BROWS, LOWER_LEFT_BROW,
//      LOWER_RIGHT_BROW, LOWER_MOUTH_CORNERS,
//      LOWER_LEFT_MOUTH_CORNER,
//      LOWER_RIGHT_MOUTH_CORNER,
//      RAISE_MOUTH_CORNERS,
//      RAISE_RIGHT_MOUTH_CORNER,
//      RAISE_LEFT_MOUTH_CORNER, OPEN_MOUTH,
//      OPEN_LIPS, WIDEN_EYES, CLOSE_EYES]
//
// face/faceShift can contain several sons of type faceLexeme without sync attr
// valaro Range [-1, 1]

// Declare new facial expression
FacialController.prototype.newFA = function (faceData, shift) {
    
    // Use BSW of the agent
    for (let morph in this._facialBS) {
        for (let i = 0; i < this._facialBS[morph].length; i++) {
            this._facialBS[morph][i] = this._morphDeformers[morph].morphTargetInfluences[i];
        }
    }
    if (faceData.emotion || faceData.valaro) {
        this.FA.initFaceValAro(faceData, shift, this._facialBS); // new FacialExpr (faceData, shift, this._facialBS);
    }
    else if (faceData.lexeme) {
        this._FacialLexemes.push(new FacialExpr(faceData, shift, this._facialBS));
    }

}

// --------------------- BLINK ---------------------
FacialController.prototype.newBlink = function ( bml ){
    this.autoBlink.blink();
}

// --------------------- GAZE ---------------------
// BML
// <gaze or gazeShift start ready* relax* end influence target influence offsetAngle offsetDirection>
// influence [EYES, HEAD, NECK, SHOULDER, WAIST, WHOLE, ...]
// offsetAngle relative to target
// offsetDirection (of offsetAngle) [RIGHT, LEFT, UP, DOWN, UP_RIGHT, UP_LEFT, DOWN_LEFT, DOWN_RIGHT]
// target [CAMERA, RIGHT, LEFT, UP, DOWN, UP_RIGHT, UP_LEFT, DOWN_LEFT, DOWN_RIGHT]

// "HEAD" position is added on Start

FacialController.prototype.newGaze = function (gazeData, shift, gazePositions = null) {

    // TODO: recicle gaze in gazeManager
    let keys = Object.keys(this._facialBS);
    let blinkW = this._facialBS[keys[0]][0]
    let eyelidsW = this._facialBS[keys[0]][this._eyeLidsBS[0][0]]
    let squintW = this._facialBS[keys[0]][this._squintBS[0][0]]
    gazeData.eyelidsWeight = eyelidsW;
    gazeData.squintWeight = squintW;
    gazeData.blinkWeight = blinkW;

    this.gazeManager.newGaze(gazeData, shift, gazePositions, !!gazeData.headOnly);

}

// BML
// <headDirectionShift start end target>
// Uses gazeBML
FacialController.prototype.headDirectionShift = function (headData, cmdId) {
    
    headData.end = headData.end || 2.0;
    headData.influence = "HEAD";
    this.newGaze(headData, true, null, true);
}

// --------------------- HEAD ---------------------
// BML
// <head start ready strokeStart stroke strokeEnd relax end lexeme repetition amount>
// lexeme [NOD, SHAKE, TILT, TILT_LEFT, TILT_RIGHT, FORWARD, BACKWARD]
// repetition cancels stroke attr
// amount how intense is the head nod? 0 to 1
// New head behavior
FacialController.prototype.newHeadBML = function (headData) {
    
    // work with indexes instead of names
    let node = headData.lexeme == "FORWARD" || headData.lexeme == "BACKWARD" ? this._boneMap.Neck : this._boneMap.Head;
    let bone = this.skeleton.bones[node]; // let bone = this.character.getObjectByName(node);
    if (bone) {
        this.headBML.push(new HeadBML(headData, bone, bone.quaternion.clone()));
    }
}


export { FacialController }