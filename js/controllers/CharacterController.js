//@ECA controller
import { GestureManager } from '../bml/BehaviourRealizer.js';
import { BehaviourPlanner } from '../bml/BehaviourPlanner.js';
import { BehaviourManager } from '../bml/BehaviourManager.js';
import { FacialController } from './FacialController.js';
//States
CharacterController.WAITING    = 0;
CharacterController.PROCESSING = 1;
CharacterController.SPEAKING   = 2;
CharacterController.LISTENING  = 3;

window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

function CharacterController(o) {

    this.time = 0;
    this.character = o.character;

    if (typeof BehaviourManager !== 'undefined')
  	    this.BehaviourManager = new BehaviourManager();
    else
        console.error("Manager not included");

    if(typeof BehaviourPlanner !== 'undefined')
    {
        this.BehaviourPlanner = new BehaviourPlanner();
        this.BehaviourPlanner.BehaviourManager = this.BehaviourManager;
    }
    else
        console.error("Planner not included");

    if(typeof FacialController !== 'undefined')
        this.facialController = new FacialController(o);
    else
        console.error("FacialController module not found");
    
    if(typeof TextToSpeech !== 'undefined')
        this.speechController = new TextToSpeech();
    else
      console.error("SpeechController module not found")
     
    if(typeof Poser !== 'undefined')
        this.poser = new Poser() ;
    else
      console.error("Poser module not found") 
    
    if(typeof GestureManager !== 'undefined')
        this.gestureManager = new GestureManager(this.poser) 
    else
      console.error("GestureManager module not found") 
    
    if(typeof Lipsync !== 'undefined')
    {
        this.lipsyncModule = new Lipsync();
        if(this.speechController)
            this.speechController._lipsync = this.lipsyncModule.lipsyncModule;
    }
    else
        console.error("Lipsync module not found")
    /*var playAnimation = new PlayAnimation();
    if(!playAnimation )
      console.error("PlayAnimation module not found") 
     else
      this.animationManager = new AnimationManager(playAnimation) ;*/
}

CharacterController.prototype.onStart = function(o)
{
  this.pendingResources = [];
  this.facialController.onStart(o);
}


CharacterController.prototype.onUpdate = function(dt, et)
{
	var newBlock = null;
 
    if (this.BehaviourPlanner)
        newBlock = this.BehaviourPlanner.update(dt);

   /* if (this.facialController)
        this.facialController.onUpdate(dt);*/
    if (this.BehaviourManager)
        this.BehaviourManager.update(this.processBML.bind(this), et);
 


    if(this.gestureManager)
        this.gestureManager.update(dt)
        
    if(this.animationManager)
        this.animationManager.update(dt)
    
    if (newBlock !== null && newBlock !== undefined) 
    {
        this.BehaviourManager.newBlock(newBlock, et);  
    }

    if(this.lipsyncModule)
        this.lipsyncModule.update();
}


// Process message
// Messages can come from inner processes. "fromWS" indicates if a reply to the server is required in BMLManager.js
CharacterController.prototype.processMsg = function(data, fromWS) {

  // Process block
  // Create new bml if necessary
  /*if (this.BehaviourPlanner)
  {

    //this.BehaviourPlanner.newBlock(msg);
    if(msg.speech)
      this.BehaviourPlanner.transition({control:this.SPEAKING})
      //this.processMsg(JSON.stringify({control:this.SPEAKING}));
      }
  if (!msg) {
    console.error("An undefined block has been created by BMLPlanner.", msg);
    return;
  }*/

  // Update to remove aborted blocks
  if (!this.BehaviourManager)
    return;

  this.BehaviourManager.update(this.processBML.bind(this), this.time);

  

  /*  // Add new block to stack
    if(data.constructor == Array)
    {
      for(var i = 0; i < data.length; i++)
      {
        var msg = data[i];
        if(msg.type == "info")
          continue;

        if(!msg.end &&msg.duration)
          msg.end = msg.start+msg.duration;
        var block = {};
        block[msg.type] = msg;
        this.BehaviourManager.newBlock(block);
      }
    }else
    { 
      if(data.type == "info")
        return;
      else
        this.BehaviourManager.newBlock(data, thiscene.time);
    }*/
    // Add new block to stack
    //this.BehaviourManager.newBlock(msg, thiscene.time);
  var data  = JSON.parse(data);
  if(data.type == "behaviours") data = data.data;
  // Add new block to stack
  var msg = {};
  if(data.constructor == Array)
  {
    var end =-1000;
    var start = 1000;
    for(var i = 0; i < data.length; i++)
    {
      
      if(data[i].type == "info")
        continue;

      if(!data[i].end &&data[i].duration)
      {
        data[i].end = data[i].start+data[i].duration;
        if(data[i].attackPeak) data[i].attackPeak +=data[i].start;
        if(data[i].ready) data[i].ready +=data[i].start;
        if(data[i].strokeStart) data[i].strokeStart +=data[i].start;
        if(data[i].stroke) data[i].stroke +=data[i].start;
        if(data[i].strokeEnd) data[i].strokeEnd +=data[i].start;
        if(data[i].relax) data[i].relax +=data[i].start;
      }
     // this.BehaviourManager.newBlock(data[i]);
   
      if(msg[data[i].type])
      {
        if(msg[data[i].type].constructor == Object)
        {
        	var currentData = Object.assign({},msg[data[i].type]);
          msg[data[i].type] = [currentData];
      	}
        msg[data[i].type].push(data[i]);
      }
      else
      	msg[data[i].type] = data[i];
      //msg = data[i];
     // this.BehaviourManager.newBlock(msg);
     if(data[i].end > end) end = data[i].end;
      if(data[i].start < start) start = data[i].start;
    }
    msg.start = start;
    msg.end = end;
    if(!msg.composition)
      msg.composition = "MERGE"
    this.BehaviourManager.newBlock(msg, this.time);
  }
  else if(data.constructor == Object)
  {
    msg = data;
    if(data.type == "state" || data.type == "control")
    {
      msg.control = this[data.parameters.state.toUpperCase()];
      this.BehaviourPlanner.transition(msg)
      return;
    }
    else if(data.type == "info")
        return;
    this.BehaviourManager.newBlock(msg, this.time);
  }
  
  if (fromWS)
    msg.fromWS = fromWS;

  console.log("Processing message: ", msg, this.time);

  // Input msg KRISTINA
  this.inputMSG = msg;

  // This is here for the GUI
  if (typeof this.msgCallback == "function") {
    //this.msgCallback(msg);
    var res = this.msgCallback(msg);
    if (res === false) {
      if (fromWS) {
       // this.ws.send(msg.id + ": true"); // HARDCODED
        console.log("(shortcut) Sending POST response with id:", msg.id);
      }
      return;
    }
  }

  // Client id -> should be characterId?
  if (msg.clientId !== undefined && !this.ws.id) {
    this.ws.id = msg.clientId;

    console.log("Client ID: ", msg.clientId);
    LS.infoText = "Client ID: " + msg.clientId;

    return;
  }

  // Load audio files
  if (msg.lg) {
    var hasToLoad = this.loadAudio(msg);
    if (hasToLoad) {
      this.pendingResources.push(msg);
      console.log("Needs to preload audio files.");
      return;
    }
  }

  if (!msg) {
    console.error("An undefined msg has been received.", msg);
    return;
  }

  // Process block
  // Create new bml if necessary
  if (this.BehaviourPlanner)
  {

    //this.BehaviourPlanner.newBlock(msg);
    if(msg.speech)
      this.BehaviourPlanner.transition({control:this.SPEAKING})
      //this.processMsg(JSON.stringify({control:this.SPEAKING}));
      }
  if (!msg) {
    console.error("An undefined block has been created by BMLPlanner.", msg);
    return;
  }

  // Update to remove aborted blocks
  if (!this.BehaviourManager)
    return;

  this.BehaviourManager.update(this.processBML.bind(this), this.time);

  if (!msg) {
    console.error("An undefined block has been created due to the update of BMLManager.", msg);
    return;
  }

  /*  // Add new block to stack
    if(data.constructor == Array)
    {
      for(var i = 0; i < data.length; i++)
      {
        var msg = data[i];
        if(msg.type == "info")
          continue;

        if(!msg.end &&msg.duration)
          msg.end = msg.start+msg.duration;
        var block = {};
        block[msg.type] = msg;
        this.BehaviourManager.newBlock(block);
      }
    }else
    { 
      if(data.type == "info")
        return;
      else
        this.BehaviourManager.newBlock(data, thiscene.time);
    }*/
    // Add new block to stack
    //this.BehaviourManager.newBlock(msg, thiscene.time);
}

// Process message
CharacterController.prototype.processBML = function(key, bml) {

    if (!this.facialController)
        return;

    var thatFacial = this.facialController;

    switch (key) {
        case "blink":
            thatFacial._blinking = true;
            thatFacial.newBlink(bml);
            break;
        case "gaze":
            if(bml.shift == undefined)
              bml.shift = false;
            thatFacial.newGaze(bml, bml.shift);
            break;
        case "gazeShift":
            thatFacial.newGaze(bml, true);
            break;
        case "head":
            thatFacial.newHeadBML(bml);
            break;
        case "headDirectionShift":
            thatFacial.headDirectionShift(bml);
            break;
        case "face":
            if(bml.shift == undefined)
            	bml.shift = false;
            thatFacial.newFA(bml, bml.shift);
            break;
        case "faceLexeme":
        		if(bml.shift == undefined)
              bml.shift = false;
            thatFacial.newFA(bml, bml.shift);
            break;
        case "faceFACS":
            thatFacial.newFA(bml, false);
            break;
        case "faceEmotion":
            if(bml.shift == undefined)
              bml.shift = false;
            thatFacial.newFA(bml, bml.shift);
            break;
        case "faceVA":
          if(bml.shift == undefined)
            bml.shift = false;
          thatFacial.newFA(bml, bml.shift);
          break;
        case "faceShift":
            thatFacial.newFA(bml, true);
            break;
        case "speech":
        	  console.log("TTS: " + bml.textToLipInfo.text)
            if (bml.textToLipInfo.phT)
              bml.textToLipInfo.phT = new Float32Array(Object.values(bml.textToLipInfo.phT));
            thatFacial.newTextToLip(bml.textToLipInfo)
        		//thatFacial.newLipSync(bml.text)
            break;
        case "gesture":
            this.gestureManager.newGesture(bml)   
        	//this.gesture(bml);
            break;
        case "posture":
            //this.posture(bml);
            break;
        case "pointing":
            break;
        case "animation":
          this.animationManager.newAnimation(bml)
          break;
        case "lg":
            thatFacial.lipsyncModule.loadSample(bml.url)
          //thatFacial.newLipSync()
            //thatFacial._visSeq.sequence = bml.sequence;
           // thatFacial._audio.src = bml.audioURL; // When audio loads it plays
            // All "lg" go through pending resources and are called when the audio is loaded.
            // If I assign again the audioURL is the audio already loaded?
            
           /* var CC = thiscene._root.getmodule("Captionsmodule");
            if (CC && !this.hideCaptions){
              	var split = 5.0;
              
                if (bml.duration <= split )
                    CC.addSentence(bml.text, CC.getTime(), CC.getTime() + bml.end);
              
              	else{
                  	bml.text.replace(".", " .").replace(",", " ,").split(" ");
                  
                  	var sentence =  [0,0,""], copy = null;
                		for(var w in bml.words){
                    		var word = bml.words[w];
                      	sentence[1] = word.end;	
                      	sentence[2] += " "+word.word;
                      	
                  			if( (sentence[1] - sentence[0])/split >= 1){
                        		copy = sentence.clone();
                    				CC.addSentence(copy[2], CC.getTime() + copy[0], CC.getTime() + copy[1]);
                   					sentence = [sentence[1],sentence[1],""];
                  			}
												
                		}
              	}

            }
                
						
            if(bml.metadata){
              this.lg = {metadata : bml.metadata,
                               start: bml.start,
                               end:bml.end,
                               valence:bml.valence,
                               arousal:bml.arousal};
              this.count = bml.end - bml.start;
              if(bml.metadata.FacialExpression){
                this.BMLManager.newBlock({"id":"face", "face":{ "start": bml.start, "attackPeak": ((bml.end - bml.start)/4), end: bml.end, "valaro": [bml.valence,bml.arousal]}, composition:"OVERWRITE"})
              }
                
            }*/
            break;
    }
}

// Preloads audios to avoid loading time when added to BML stacks
CharacterController.prototype.loadAudio = function(block){
  var output = false;
  if (block.lg.constructor === Array){
    for (var i = 0; i<block.lg.length; i++){
      if (!block.lg[i].audio){
        block.lg[i].audio = new Audio();
        block.lg[i].audio.src = block.lg[i].url;
        output = true;
      }
    }
  }
  else {
    if (!block.lg.audio){
      block.lg.audio = new Audio();
      block.lg.audio.src = block.lg.url;
      output = true;
    }
  }
  
  return output;    
}
export { CharacterController }