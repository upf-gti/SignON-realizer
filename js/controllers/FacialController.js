//@FacialController

import {Blink, FacialExpr, GazeManager, Gaze, HeadBML, GestureManager, Lipsync, AnimationManager, Text2LipInterface, T2LTABLES} from '../bml/BehaviourRealizer.js';
import * as THREE from 'three';

function FacialController(o) {
  //define some properties
  this.headNode = "mixamorig_Head";
  this.lookAt = "target";
  this.lookAtEyes = "eyesTarget";
  this.lookAtHead = "headTarget";
  this.lookAtNeck = "neckTarget";

 /* this._gazePositions = {
    "RIGHT": [60, 125, 400], "LEFT": [-80, 125, 400],
    "UP": [-10, 200, 400], "DOWN": [-10, 105, 400],
    "UPRIGHT": [60, 200, 400], "UPLEFT": [-80, 200, 400],
    "DOWNRIGHT": [60, 105, 400], "DOWNLEFT": [-80, 105, 400],
    "CAMERA": [-10, 125, 400]
    };
    */
  this._gazePositions = {
    "RIGHT": new THREE.Vector3(30, 2, 100), "LEFT": new THREE.Vector3(-30, 2, 100),
    "UP": new THREE.Vector3(-10, 20, 100), "DOWN": new THREE.Vector3(-10, -20, 100),
    "UPRIGHT": new THREE.Vector3(30, 20, 100), "UPLEFT": new THREE.Vector3(-30, 20, 100),
    "DOWNRIGHT": new THREE.Vector3(30, -20, 100), "DOWNLEFT": new THREE.Vector3(-30, -20, 100),
    "CAMERA": new THREE.Vector3(0, 2, 100)
    };
  this._Blink = null;
  this._blinking = false;
  
  this.squintBSName = "Squint";
  this.eyelidsBSName = "Blink";
  this.smileBSName = "Smile";
  this.sadBSName = "Sad";
  this.kissBSName = "MouthWhistle";
  this.lipsPressedBSName = "Jaw_Up";
  this.lowerLipINBSName = "LowerLipIn";
  this.lowerLipDownBSName = "LowerLipDown";
  this.mouthNarrowBSName = "MouthNarrow";
  this.mouthOpenBSName = "MouthOpen";
  this.tongueBSName = "Tongue";

  this.browsDownBSName= "BrowsDown";
  this.browsInnerUpBSName = "BrowsIn";
  this.browsUpBSName = "BrowsUp";

  this._FacialLexemes = [];
  this._morphDeformers = {};
  this.lipsyncModule = new Lipsync();
  //if we have the state passed, then we restore the state
  if(o)
    this.configure(o);
}


FacialController.prototype.configure = function(o){

  if(o.character)
    this.character = o.character;
  if(o.headNode)
      this.headNode = o.headNode;
  if(o.lookAt)
      this.lookAt = o.lookAt;
  if(o.lookAtEyes)
      this.lookAtEyes = o.lookAtEyes;
  if(o.lookAtHead)
      this.lookAtHead = o.lookAtHead;
  if(o.lookAtNeck)
      this.lookAtNeck = o.lookAtNeck;
  if(o._gazePositions)
      this._gazePositions = o._gazePositions;
  if(o.morphTargets)
    this._morphDeformers = o.morphTargets;

}

FacialController.prototype.onStart = function(morphTargets)
{    
  // Get morph targets
  var body = this.character.getObjectByName("Body");
  var eyelashes = this.character.getObjectByName("Eyelashes");

  this._morphDeformers = { "Body" : body, "Eyelashes": eyelashes};
  this._facialBS = {};
  this._eyeLidsBS = []
  this._squintBS = [];
  this.map = {};
  
    // var morphTargets = children[child].getComponent("MorphDeformer");
  
  if(morphTargets)
  {
    for(var part in this._morphDeformers){

      //var eyelidsIx = morphTargets.morph_targets.findIndex(t=>t.mesh.includes(this.eyeLidsBSName));
      var eyelidsIdx = [];
      var squintIdx = [];
      var targets = [];
      var BSnames = Object.keys(this._morphDeformers[part].morphTargetDictionary);
      this._facialBS[part] = [];
      for(var i = 0; i<this._morphDeformers[part].morphTargetInfluences.length; i++)
      {
        
        var name = BSnames[i].replaceAll("mesh_morph_","");
        if(!this.map[name])
          this.map[name] = {};
        this.map[name][part] = i;


        if(name.toLocaleLowerCase().includes(this.eyelidsBSName.toLocaleLowerCase()))
            eyelidsIdx.push(this._morphDeformers[part].morphTargetDictionary[name])
        
        if(name.toLocaleLowerCase().includes(this.squintBSName.toLocaleLowerCase()))
          squintIdx.push(this._morphDeformers[part].morphTargetDictionary[name])
        this._facialBS[part].push(this._morphDeformers[part].morphTargetInfluences[i]);//targets;

      }
      this._eyeLidsBS.push(eyelidsIdx)
      this._squintBS.push(squintIdx)
      
    }
  }
  
  if (!this._morphDeformers)
  {
    console.error("Morph deformer not found");
    return; 
  }
  
  this.resetFace();  // body.updateMorphTargets() ????
  // Gaze
  // Get head bone node

  
  if (!this.headNode)
    console.error("Head bone node not found with id: ");
  else if(!this._gazePositions["HEAD"])
  {
    var headNode = this.character.getObjectByName(this.headNode)
    this._gazePositions["HEAD"] = headNode.getWorldPosition(new THREE.Vector3());
    
  }
  this.character.camera = this.character.getObjectByName("Camera")
  if (this.character.camera)
      this._gazePositions["CAMERA"] = this.character.camera.getWorldPosition(new THREE.Vector3());
  else
    console.error("Camera position not found for gaze.");
  
  // Get lookAt nodes
  
  var lookAtEyesNode = this.character.eyesTarget;//this.character.getObjectByName(this.lookAtEyes);
  var lookAtNeckNode = this.character.neckTarget; //this.character.getObjectByName(this.lookAtNeck);
  var lookAtHeadNode = this.character.headTarget; //this.character.getObjectByName(this.lookAtHead);
  
  if (!this.lookAtEyes) 
    console.error("LookAt Eyes not found");
  else if(!this._gazePositions["EYESTARGET"]) 
    this._gazePositions["EYESTARGET"] = lookAtEyesNode.getWorldPosition(new THREE.Vector3());
  
  if (!this.lookAtHead) 
    console.error("LookAt Head not found");
  else if( !this._gazePositions["HEADTARGET"]) 
    this._gazePositions["HEADTARGET"] = lookAtHeadNode.getWorldPosition(new THREE.Vector3());
  
  if (!this.lookAtNeck) 
    console.error("LookAt Neck not found");
  else if( !this._gazePositions["NECKTARGET"] )
    this._gazePositions["NECKTARGET"] = lookAtNeckNode.getWorldPosition(new THREE.Vector3());


  // Gaze manager
  this.gazeManager = new GazeManager(lookAtNeckNode, lookAtHeadNode, lookAtEyesNode, this._gazePositions);

  /*
  // Head behavior
  // Get lookAt head component
  this._lookAtHeadComponent = this.headBone.getComponents(LS.Components.LookAt)[0];
  if (!this._lookAtHeadComponent)
    console.error("LookAt component not found in head bone. ", this._lookAtHeadComponent, this.headBone);
  */
  this.headBML = null;
  

}
 
//example of one method called for ever update event
FacialController.prototype.onUpdate = function(dt, et, callback)
{
  if (this.character.camera)
  {
      this._gazePositions["CAMERA"] = this.character.camera.getWorldPosition(new THREE.Vector3());;
      this._gazePositions["CAMERA"].z = 100;
  }
  
  // Gaze
  if (this.gazeManager){
    var weights = this.gazeManager.update(dt);
    var keys = Object.keys(this._facialBS);
    var i = 0;
    if(weights.eyelids!=undefined)
      for(var morph in this._morphDeformers)
      {
        for(var j = 0; j< this._eyeLidsBS[i].length; j++){
          
          this._facialBS[keys[i]][this._eyeLidsBS[i][j]] = weights.eyelids;
          //this._morphDeformers[morph].morphTargetInfluences[this._eyeLidsBS[i][j]] = weights.eyelids;
        }
        i++;
      }
    i = 0
    if(weights.squint!=undefined)
      for(var morph in this._morphDeformers)
      {
        for(var j = 0; j< this._squintBS[i].length; j++){
    
          this._facialBS[keys[i]][this._squintBS[i][j]] = weights.squint;

         // this._morphDeformers[morph].morphTargetInfluences[this._squintBS[i][j]] = weights.squint;
        }
        i++;
      }
    /*var keys = Object.keys(this._facialBS);
    if(weights.eyelids !=undefined && weights.eyelids !=null)
    {
        this._facialBS[keys[0]][this._eyeLidsBS[0][0]] = weights.eyelids
        this._facialBS[keys[0]][this._squintBS[0][0]] = weights.squint
      this._facialBS[keys[0]][[0]] = weights.eyelids
    }*/
  }
  this.lipsyncModule.update(dt);
  // Update facial expression
  this.faceUpdate(dt);
  // Face blend (blink, facial expressions, lipsync)
  this.facialBlend(dt);
    
  var lookAtEyes = this.character.eyesTarget.getWorldPosition(new THREE.Vector3());//this.character.getObjectByName(this.lookAtEyes).getWorldPosition(new THREE.Vector3());
  var lookAtHead = this.character.headTarget.getWorldPosition(new THREE.Vector3());//this.character.getObjectByName(this.lookAtHead).getWorldPosition(new THREE.Vector3());
  var lookAtNeck = this.character.headTarget.getWorldPosition(new THREE.Vector3());//this.character.getObjectByName(this.lookAtNeck).getWorldPosition(new THREE.Vector3());
  this.character.getObjectByName("mixamorig_LeftEye").lookAt(lookAtEyes);
  this.character.getObjectByName("mixamorig_RightEye").lookAt(lookAtEyes);
  // Head behavior
  this.headBMLUpdate(dt)
  if(!this.headBMLUpdate(dt))
    this.character.getObjectByName("mixamorig_Head").lookAt(lookAtHead);
  this.character.getObjectByName("mixamorig_Neck").lookAt(lookAtNeck);
  
 if(callback)
    callback(dt,et)
}

// --------------------- BLINK ---------------------
// BML
// <blink start attackPeak relax end amount>

FacialController.prototype.blink = function(blinkData, cmdId){

  blinkData.end = blinkData.end || blinkData.attackPeak * 2 || 0.5;
  
  this.newBlink(blinkData);
  this._blinking = true;
  
/*  // Server response
  if (cmdId) 
    setTimeout(LS.Globals.ws.send.bind(LS.Globals.ws), blinkData.end * 1000, cmdId + ": true");*/
}

// Create blink object
FacialController.prototype.newBlink = function(blinkData){
  var keys = Object.keys(this._morphDeformers);
  this._Blink = new Blink(blinkData, this._morphDeformers[keys[0]].morphTargetInfluences[this._eyeLidsBS[0][0]]);
}
FacialController.prototype.newLipSync = function (text)
{
  if(!this.lipsync)
      this.lipsync = new TextToLipsync(text);
  this.lipsync.parse(text);
  this.lipsync.speaking = true;
}

FacialController.prototype.newTextToLip = function (info)
  {
    if(!this.lipsync){ // setup
  
        this.lipsync = new Text2LipInterface();
      this.lipsync.start(); // keep started but idle
      this.lipsyncBSMapping = []; // array of [ MeshBSIndex, T2Lindex, factor ]
  
      let BS = Object.keys(this._morphDeformers["Body"].morphTargetDictionary);
      let t2lBSWMap = T2LTABLES.BlendshapeMapping;
  
      for(let i = 0; i<BS.length; i++)
      {
        if(BS[i].includes("Midmouth_Left"))      this.lipsyncBSMapping.push( [ i, t2lBSWMap.kiss, 0.4 ]);
        if(BS[i].includes("Midmouth_Right"))     this.lipsyncBSMapping.push( [ i, t2lBSWMap.kiss, 0.4 ]);
        if(BS[i].includes("MouthNarrow_Left"))   this.lipsyncBSMapping.push( [ i, t2lBSWMap.kiss, 1.0 ]);
        if(BS[i].includes("MouthNarrow_Left"))   this.lipsyncBSMapping.push( [ i, t2lBSWMap.kiss, 1.0 ]);
  
        if(BS[i].includes("MouthDown"))          this.lipsyncBSMapping.push( [ i, t2lBSWMap.upperLipClosed, 0.4 ]);
        if(BS[i].includes("UpperLipOut"))        this.lipsyncBSMapping.push( [ i, t2lBSWMap.upperLipClosed, -1.5 ]);
        if(BS[i].includes("UpperLipUp_Left"))    this.lipsyncBSMapping.push( [ i, t2lBSWMap.upperLipClosed, -0.3 ]);
        if(BS[i].includes("UpperLipUp_Right"))   this.lipsyncBSMapping.push( [ i, t2lBSWMap.upperLipClosed, -0.3 ]);
  
        if(BS[i].includes("LowerLipDown_Left"))  this.lipsyncBSMapping.push( [ i, t2lBSWMap.lowerLipClosed, -0.8 ]);
        if(BS[i].includes("LowerLipDown_Right")) this.lipsyncBSMapping.push( [ i, t2lBSWMap.lowerLipClosed, -0.8 ]);
        if(BS[i].includes("LowerLipIn"))         this.lipsyncBSMapping.push( [ i, t2lBSWMap.lowerLipClosed, 1.0 ]);
  
        if(BS[i].includes("MouthOpen"))          this.lipsyncBSMapping.push( [ i, t2lBSWMap.jawOpen, 1.0 ]);
  
        if(BS[i].includes("TongueBackUp"))       this.lipsyncBSMapping.push( [ i, t2lBSWMap.tongueBackUp,  1.0 ]);
        if(BS[i].includes("TongueFrontUp"))      this.lipsyncBSMapping.push( [ i, t2lBSWMap.tongueFrontUp, 1.0 ]);
        if(BS[i].includes("TongueOut"))          this.lipsyncBSMapping.push( [ i, t2lBSWMap.tongueOut,     1.0 ]);
      }
    }// end of setup
  
    this.lipsync.cleanQueueSentences();
    this.lipsync.pushSentence( info.text, info ); // use info object as options container also
    this.lipsync.setEvent( "onIdle", function(){console.log("Ended text to lip");});
  
  }

// --------------------- FACIAL BLEND ---------------------
FacialController.prototype.facialBlend = function(dt)
{
  
  // Facial interpolation 
  if (this.FA || this._FacialLexemes.length != 0 ){
    var md = this._morphDeformers;
    /* for(var part in this._morphDeformers)
    {*/
      for(var i = 0; i<this._morphDeformers["Body"].morphTargetInfluences.length; i++)
      {
        var e = null;
        for(var k in this.map)
        {
          if( i == this.map[k]["Body"])
            e = this.map[k]["Eyelashes"]
        }
        var w = this._facialBS["Body"][i];
        this._morphDeformers["Body"].morphTargetInfluences[i] = this._facialBS["Body"][i];
        if(e != null)
          this._morphDeformers["Eyelashes"].morphTargetInfluences[e] = this._facialBS["Eyelashes"][i];
      }
    // }
  
  }
  
  var smooth = 0.66;

  if(this.lipsync && this.lipsync.getCompactState() == 0 ) // when getCompactState==0 lipsync is working, not paused and has sentences to process
  {
    this.lipsync.update(dt);
    let t2lBSW = this.lipsync.getBSW(); // reference, not a copy
    if( t2lBSW )
    {    
      let BS =  this._morphDeformers["Body"].morphTargetInfluences;
      
      for(let i = 0; i < this.lipsyncBSMapping.length; i++)
      {
        let mapping = this.lipsyncBSMapping[i];        
        // for this model, some blendshapes need to be negative
        BS[ mapping[0] ] = Math.min( 1, Math.max( -1, t2lBSW[ mapping[1] ] * mapping[2] ) );
      }
    }
    //console.log(t2lBSW);

  }
  else if(this.lipsyncModule && this.lipsyncModule.working)
  {
    var facialLexemes = this.lipsyncModule.BSW 
    if(facialLexemes)
    {
      var BS = this._morphDeformers["Body_SSS"]|| this._morphDeformers["Body"];
      var names = Object.keys(BS.morphTargetDictionary);
      for(var i = 0; i<BS.length; i++)
      {
        if(names[i].includes(this.mouthOpenBSName))
          BS.morphTargetInfluences[i] = (1-smooth)*BS.morphTargetInfluences[i] + smooth*facialLexemes[2];

        /*if(BS[i].mesh.includes(this.kissBSName))
          BS[i].weight =  (1-smooth)*BS[i].weight + smooth*facialLexemes[0];*/
        
        /*if(BS[i].mesh.includes(this.tongueBSName))
          BS[i].weight =  (1-smooth)*BS[i].weight + smooth*facialLexemes.tongue_up;*/
  
        if(names[i].includes(this.lowerLipINBSName))
          BS.morphTargetInfluences[i] =  (1-smooth)*BS.morphTargetInfluences[i] + smooth*facialLexemes[1];
        
        if(names[i].includes(this.lowerLipDownBSName))
          BS.morphTargetInfluences[i] =  (1-smooth)*BS.morphTargetInfluences[i] + smooth*facialLexemes[1];
        
        if(names[i].includes(this.mouthNarrowBSName))
          BS.morphTargetInfluences[i] =  (1-smooth)*BS.morphTargetInfluences[i] + smooth*facialLexemes[0]*0.5;
  
        if(names[i].includes(this.lipsPressedBSName))
          BS.morphTargetInfluences[i] =  (1-smooth)*BS.morphTargetInfluences[i] + smooth*facialLexemes[1];
      }
    }
  }
  
  /* // Facial interpolation (low face) if audio is not playing
  if (this._audio.paused && (this.FA || this._FacialLexemes.length != 0) ){
    this._blendshapes[this.sadBSIndex].weight = this._facialBSW[0] * this.sadFactor; // sad
    this._blendshapes[this.smileBSIndex].weight = this._facialBSW[1] * this.smileFactor; // smile
    this._blendshapes[this.lipsClosedBSIndex].weight = this._facialBSW[2] * this.lipsClosedFactor; // lipsClosed
    this._blendshapes[this.kissBSIndex].weight = this._facialBSW[3] * this.kissFactor; // kiss
        
    if(this.jawBSIndex == -1){
            quat.copy (this._jawRot, this._jawInitRotation);
        this._jawRot[3] += -this._facialBSW[4] * 0.3 * this.jawFactor; // jaw
        this.jaw.transform.rotation = quat.normalize(this._jawRot, this._jawRot);
    }
    else
      this._blendshapes[this.jawBSIndex].weight = this._facialBSW[4] * this.jawFactor;

  } 
  // Lipsync
  else if (!this._audio.paused){
    this.updateLipsync();
    
    this._blendshapes[this.smileBSIndex].weight = this._lipsyncBSW[1];
    this._blendshapes[this.mouthAirBSIndex].weight = this._lipsyncBSW[2];
    this._blendshapes[this.lipsClosedBSIndex].weight = this._lipsyncBSW[3];
    this._blendshapes[this.kissBSIndex].weight = this._lipsyncBSW[4] * 2.5;
    this._blendshapes[this.sadBSIndex].weight = this._lipsyncBSW[5];
        
    
    if(this.jawBSIndex == -1){
        quat.copy (this._jawRot, this._jawInitRotation);
        this._jawRot[3] += -this._lipsyncBSW[0] * 0.3; // jaw
        this.jaw.transform.rotation = quat.normalize(this._jawRot, this._jawRot);
    }
    else
      this._blendshapes[this.jawBSIndex].weight = this._lipsyncBSW[0] * 3.0;
    

  }
  // Facial interpolation (high face)
  if (this.FA || this._FacialLexemes.length != 0){
      this._blendshapes[this.browsDownBSIndex].weight = this._facialBSW[5] * this.browsDownFactor; // browsDown
      this._blendshapes[this.browsInnerUpBSIndex].weight = this._facialBSW[6] * this.browsInnerUpFactor; // browsInnerUp
      this._blendshapes[this.browsUpBSIndex].weight = this._facialBSW[7] * this.browsUpFactor; // browsUp
      this._blendshapes[this.eyeLidsBSIndex].weight = this._facialBSW[8]; // eyeLids
  }
  */
    
  // Eye blink
  var keys = Object.keys(this._facialBS);
  var blinkW = this._facialBS[keys[0]][this._eyeLidsBS[0][0]]
  if(blinkW&& this._Blink && this._blinking && blinkW == this._Blink.currentWeight) blinkW = this._Blink.initialWeight;
  if (this._blinking && this._eyeLidsBS.length){
    var weight = this._Blink.update(dt, blinkW);
    if (weight !== undefined)
    {
      var i = 0;
      for(var morph in this._morphDeformers)
      {
        for(var j = 0; j< this._eyeLidsBS[i].length; j++){
          
          this._facialBS[keys[0]][this._eyeLidsBS[i][j]] = this._facialBS[keys[1]][this._eyeLidsBS[i][j]] = weight;
        }
        i++;
      }
    }
    if (!this._Blink.transition)
      this._blinking = false;
  }

  for(var i = 0; i<this._morphDeformers["Body"].morphTargetInfluences.length; i++)
  {
    var e = null;
    for(var k in this.map)
    {
      if( i == this.map[k]["Body"])
        e = this.map[k]["Eyelashes"]
    }
    var w = this._facialBS["Body"][i];
    this._morphDeformers["Body"].morphTargetInfluences[i] = this._facialBS["Body"][i];
    if(e != null)
      this._morphDeformers["Eyelashes"].morphTargetInfluences[e] = this._facialBS["Eyelashes"][i];
  }

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
FacialController.prototype.newFA = function(faceData, shift){
  // Use BSW of the agent
  
  var BS = this._morphDeformers["Body_SSS"] || this._morphDeformers["Body"];

  for(var morph in this._facialBS)
  {
    for(var i = 0; i< this._facialBS[morph].length; i++)
        this._facialBS[morph][i] = this._morphDeformers[morph].morphTargetInfluences[i];

    
  }
  if(faceData.emotion)
  {
    /*var data = Object.assign({}, faceData);
    data.type = "faceLexeme";
    var lexemes = [];
    switch(faceData.emotion)
    {
      case "HAPPINESS":        
        lexemes = ["CHEEK_RAISER", "LIP_CORNER_PULLER"] //AU6+AU12
        break;
      case "SADNESS":
        lexemes = ["INNER_BROW_RAISER", "BROW_LOWERER", "DIMPLER"] //AU1+AU4+AU15     
        break;
      case "SURPRISE":
        lexemes = ["INNER_BROW_RAISER", "OUTER_BROW_RAISER", "UPPER_LID_RAISER", "JAW_DROP"] //AU1+AU2+AU5B+AU26     
        break;
      case "FEAR":
        lexemes = ["INNER_BROW_RAISER", "OUTER_BROW_RAISER", "BROW_LOWERER", "UPPER_LID_RAISER", "LID_TIGHTENER", "LIP_STRECHER", "JAW_DROP"] //AU1+AU2+AU4+AU5+AU7+AU20+AU26
        break;
      case "ANGER":
        lexemes = ["BROW_LOWERER", "UPPER_LID_RAISER", "LID_TIGHTENER", "LIP_TIGHTENER"] //AU4+AU5+AU7+AU23     
        break;
      case "DISGUST":
        lexemes = ["NOSE_WRINKLER", "LIP_CORNER_DEPRESSOR", "CHIN_RAISER"] //AU9+AU15+AU17     
        break;
      case "CONTEMPT":
        lexemes = ["LIP_CORNER_PULLER_RIGHT", "DIMPLER_RIGHT"] //RAU12+RAU14
        break;
      case "NEUTRAL":        
        lexemes = ["CHEEK_RAISER", "LIP_CORNER_PULLER",
        "INNER_BROW_RAISER", "BROW_LOWERER", "DIMPLER",
        "INNER_BROW_RAISER", "OUTER_BROW_RAISER", "UPPER_LID_RAISER", "JAW_DROP", 
        "INNER_BROW_RAISER", "OUTER_BROW_RAISER", "BROW_LOWERER", "UPPER_LID_RAISER", "LID_TIGHTENER", "LIP_STRECHER", "JAW_DROP",
        "BROW_LOWERER", "UPPER_LID_RAISER", "LID_TIGHTENER", "LIP_TIGHTENER",
        "NOSE_WRINKLER", "LIP_CORNER_DEPRESSOR", "CHIN_RAISER",
        "LIP_CORNER_PULLER_RIGHT", "DIMPLER_RIGHT"] //AU6+AU12
        data.amount= 1 - data.amount;
        break;
    }*/

    /*for(var i in lexemes)
    {
      data.lexeme = lexemes[i];
      this._FacialLexemes.push(new FacialExpr (data, shift, this._facialBS));
    }*/
    this.FA = new FacialExpr (faceData, shift, this._facialBS);
  }
    else if (faceData.valaro)
      this.FA = new FacialExpr (faceData, shift, this._facialBS);
  else if (faceData.lexeme)
  {
    this._FacialLexemes.push(new FacialExpr (faceData, shift, this._facialBS));
    
  }
  
}

// Update facial expressions
FacialController.prototype.faceUpdate = function(dt){
  
  if (this.FA){
    // Update FA with Val Aro
    this.FA.updateVABSW( this._facialBS , dt);

    // Remove object if transition finished
    if (!this.FA.transition){
      this.FA = null;
    }
  }
  
  // Update facial lexemes
  for (var i = 0; i < this._FacialLexemes.length; i++){
      if (this._FacialLexemes[i].transition)
        this._FacialLexemes[i].updateLexemesBSW(this._facialBS, dt);

  }
  
  // Clean facial lexemes
  for (var i = 0; i < this._FacialLexemes.length; i++){
    if (!this._FacialLexemes[i].transition){
        this._FacialLexemes.splice(i, 1);
    }
  }
  
  
  // Check for NaN errors
  for (var i = 0; i<this._facialBS.length; i++){
    if (isNaN(this._facialBS[i])){
      console.error("Updating facial expressions create NaN values! <this.faceUpdate>");
      this._facialBS[i] = 0;
    }
  }
  
}
FacialController.prototype.resetFace = function(){
  for(var part in this._facialBS)
    {
        for(var i = 0; i<this._facialBS[part].length; i++)
        {
          this._facialBS[part][i] = 0;
          this._morphDeformers[part].morphTargetInfluences[i] = 0;
        }
    }
}

// --------------------- GAZE ---------------------
// BML
// <gaze or gazeShift start ready* relax* end influence target influence offsetAngle offsetDirection>
// influence [EYES, HEAD, NECK, SHOULDER, WAIST, WHOLE, ...]
// offsetAngle relative to target
// offsetDirection (of offsetAngle) [RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT]
// target [CAMERA, RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT]

// "HEAD" position is added onStart

FacialController.prototype.gaze = function(gazeData, cmdId){

  gazeData.end = gazeData.end || 2.0;

  this.newGaze(gazeData, false);
  
}

FacialController.prototype.gazeShift = function(gazeData, cmdId){

  gazeData.end = gazeData.end || 1.0;

  this.newGaze(gazeData, true);
}


FacialController.prototype.newGaze = function(gazeData, shift, gazePositions, headOnly){

  // TODO: recicle gaze in gazeManager
  var keys = Object.keys(this._facialBS);
  var blinkW = this._facialBS[keys[0]][0]
  var eyelidsW = this._facialBS[keys[0]][this._eyeLidsBS[0][0]]
  var squintW = this._facialBS[keys[0]][this._squintBS[0][0]]
  gazeData.eyelidsWeight = eyelidsW; 
  gazeData.squintWeight = squintW; 
  gazeData.blinkWeight = blinkW; 

  this.gazeManager.newGaze(gazeData, shift, gazePositions, headOnly);
      
  /* var keys = Object.keys(this._facialBS);
  if(gazeData.offsetDirection.includes("DOWN"))
  
    this._facialBS[keys[0]][this._eyeLidsBS[0][0]] = 0.2;
  else
    this._facialBS[keys[0]][this._eyeLidsBS[0][0]] = 0;
  */
}

// --------------------- HEAD ---------------------
// BML
// <head start ready strokeStart stroke strokeEnd relax end lexeme repetition amount>
// lexeme [NOD, SHAKE]
// repetition cancels stroke attr
// amount how intense is the head nod? 0 to 1
FacialController.prototype.head = function(headData, cmdId)
{

    headData.end = headData.end || 2.0;

  this.newHeadBML(headData);

}

// New head behavior
FacialController.prototype.newHeadBML = function(headData){
  
  var lookAt = this.character.getObjectByName(this.headNode);//this._lookAtHeadComponent;
  if (lookAt){
    this.headBML = new HeadBML(headData, this.character.getObjectByName(this.headNode), lookAt.quaternion.clone(), lookAt.quaternion.clone()) 
                                /*lookAt.limit_vertical[0], lookAt.limit_horizontal[0]);*/
  }
}
// Update
FacialController.prototype.headBMLUpdate = function(dt){
  
  if (this.headBML){
    /* if (this.headBML.transition){
      this._lookAtHeadComponent.applyRotation = false;*/
      this.headBML.update(dt);
      return this.headBML.transition;
    /* } else
      this._lookAtHeadComponent.applyRotation = true;*/
  }
  return false;
}

// BML
// <headDirectionShift start end target>
// Uses gazeBML
FacialController.prototype.headDirectionShift = function(headData, cmdId){
  headData.end = headData.end || 2.0;
  
  headData.influence = "HEAD";
  this.newGaze(headData, true, null, true);
  
}

export { FacialController }