//@BehaviourPlanner
//Agent's communicative intentions specified using BML standard

//States
BehaviourPlanner.WAITING = 0;
BehaviourPlanner.PROCESSING = 1;
BehaviourPlanner.SPEAKING = 2;
BehaviourPlanner.LISTENING = 3;

function BehaviourPlanner() {
  this.reset();
}

BehaviourPlanner.prototype.reset = function () {
  this.conversation = "--- New dialogue---\n\n";
  this.state = BehaviourPlanner.WAITING;
  
  //For automatic state update
  this.stateTime = 0;
  this.nextBlockIn =  1 + Math.random() * 2;
  
  // Default facial state
  this.defaultValence = 0.4;
  this.currentArousal = 0;
  
  // Idle timings (blink and saccades)
  this.blinkIdle = 0.5 + Math.random()*6;
	this.blinkDur = Math.random()*0.5 + 0.15;
	this.blinkCountdown = 0;

	this.saccIdle = 0.5 + Math.random()*6;
	this.saccDur = Math.random() + 0.5;
	this.saccCountdown = 0;
}

//UPDATE
BehaviourPlanner.prototype.update = function(dt){

  this.stateTime += dt;
  
  // Automatic state update
  if (this.nextBlockIn < this.stateTime){
    this.stateTime = 0;
    return this.createBlock();
  }
  
  // Check if speech has finished to change to WAITING
  /*if (this.state == BehaviourPlanner.SPEAKING){
    if (BehaviourPlanner.BehaviorManager){
      if (BehaviourPlanner.BehaviorManager.lgStack.length == 0 && BehaviourPlanner.BehaviorManager.speechStack.length == 0)
        this.transition({control: BehaviourPlanner.WAITING});
    }
  }*/
  
  // Automatic blink and saccades
  return this.updateBlinksAndSaccades(dt);
}

//TRANSITION to nextState
BehaviourPlanner.prototype.transition = function(block){
  
  var nextState = block.control;
  
  if (nextState == this.state)
    return;
  
  var currentState = "waiting";
  
  switch(this.state){
    case BehaviourPlanner.WAITING:
      currentState = "waiting";
      break;
    case BehaviourPlanner.LISTENING:
      currentState = "listening";
      break;
      case BehaviourPlanner.SPEAKING:
      currentState = "speaking";
      break;
      case BehaviourPlanner.PROCESSING:
      currentState = "processing";
      break;
  }
  

  // Reset state time
  this.stateTime = 0;
  
  // TRANSITIONS
  switch(nextState){
  	
      // Waiting can only come after speaking
    case BehaviourPlanner.WAITING:
    	// Look at user for a while, then start gazing around
    	this.nextBlockIn = 2 + Math.random() * 4;
  		break;
  	
      // Can start speaking at any moment
    case BehaviourPlanner.LISTENING:
    	// Force to overwrite existing bml
    	block.composition = "MERGE";
    	/*if(this.state ==BehaviourPlanner.SPEAKING){
      	// Abort speech
      	this.abortSpeech();
    	}*/
    	// Look at user and default face
    	this.attentionToUser(block, true);
    	// Back-channelling
    	this.nextBlockIn = 0 +  Math.random()*2;
			break;
  
  		// Processing always after listening
    case BehaviourPlanner.PROCESSING:
    	this.nextBlockIn = 0;
  		break;
 	 		
      // Speaking always after processing
    case BehaviourPlanner.SPEAKING:
    	this.attentionToUser(block, true);
    	// Should I create random gestures during speech?
    	this.nextBlockIn = Math.random()*1;//2 + Math.random()*4;
  	break;
  }
  
  this.state = nextState;
  
}

//!!!!!!!!!!!!!!!!!!
/*BehaviourPlanner.prototype.abortSpeech = function(){
  // Cancel audio and lipsync in Facial
  if (BehaviourPlanner.Facial){
    var facial = BehaviourPlanner.Facial;
    if (!facial._audio.paused){
    	facial._audio.pause(); // Then paused is true and no facial actions
      // Go to neutral face? Here or somewhere else?
    }
  }
  // End all blocks in BMLManager
  if (BehaviourPlanner.BMLManager){
    var manager = BehaviourPlanner.BMLManager;
    for (var i =0 ; i < manager.stack.length; i++){
      manager.stack[i].endGlobalTime = 0;
    }
  }
}*/

//---------------------------AUTOMATIC------------------------------


//CREATEBLOCKs during a state (automatic)
BehaviourPlanner.prototype.createBlock = function(){
  
  var state = this.state;
  var block = {
    id: state, 
    composition: "MERGE"
  };
  
  switch(state)
  {
  // LISTENING
    case BehaviourPlanner.LISTENING:
      this.nextBlockIn = 1.5 + Math.random()*3;
      // head -> link with this.currentArousal
      if (Math.random() < 0.4)
      {
        block.head = {
          start: 0,
          end: 1.5 + Math.random()*2,
          lexeme: "NOD",
          amount: 0.05 + Math.random()*0.05,
          type:"head"
        }
      }

      // Esporadic raising eyebrows
      if (Math.random() < 0.5)
      {
        var start = Math.random();
        var end = start + 1 + Math.random();
        block.face = [{
          start: start,
          attackPeak: start + (end-start)*0.2,
          relax: start + (end-start)*0.5,
          end: end,
          lexeme: {
            lexeme: "BROW_RAISER", 
            amount: 0.1 + Math.random()*0.2
          },
          type:"face"
        },
          {
          start: start,
          attackPeak: start + (end-start)*0.2,
          relax: start + (end-start)*0.5,
          end: end,
          lexeme: {
            lexeme: "UPPER_LID_RAISER", 
            amount: 0.1 + Math.random()*0.2
        	},
          type:"face"
        }]
        
      }
      if(Math.random() < 0.2){
        var start = Math.random();
        var end = start + 1 + Math.random();
        var f = {
          start: start,
          attackPeak: start + (end-start)*0.2,
          relax: start + (end-start)*0.5,
          end: end,
          lexeme: {
            lexeme: "CHEEK_RAISER", 
            amount: 0.1 + Math.random()*0.2
        	},
          type:"face"
        }
        if(block.face)
          block.face.push(f)
        else
          block.face = f;
      }

      // Gaze should already be towards user

      break;
  
  // SPEAKING
    case BehaviourPlanner.SPEAKING:
      
      this.nextBlockIn = 2 + Math.random()*4;
      // Head
      if (Math.random() < 0.2){
        // block.head = {
        //   start: 0,
        //   end: 2.5 + Math.random()*1.5,
        //   lexeme: "TILT",
        //   amount: 0.05 + Math.random()*0.05,
        //   type:"head"
        // }
        // Deviate head slightly
        if (Math.random() < 0.85)
        {
          var start = Math.random();
          var offsetDirections = ["CAMERA","DOWNRIGHT", "DOWNLEFT", "LEFT", "RIGHT"]; // Upper and sides
          var randOffset = offsetDirections[Math.floor(Math.random() * offsetDirections.length)];
          block.headDirectionShift = {
            start: start,
            end: start + Math.random(),
            target: "CAMERA",
            offsetDirection: randOffset,
            offsetAngle: 1 + Math.random()*3,
            type:"headDirectionShift"
          }
        }
      }
      // Esporadic raising eyebrows
      if (Math.random() < 0.7)
      {
        var start = Math.random();
        var end = start + 1.2 + Math.random()*0.5;
        block.face = {
          start: start,
          attackPeak: start + (end-start)*0.2,
          relax: start + (end-start)*0.5,
          end: end,
          lexeme: {
            lexeme: "BROW_RAISER", 
            amount: 0.1 + Math.random()*0.2
          },
           type:"face"
        }
      }
      // Redirect gaze to user
      if (Math.random() < 0.7)
      {
        var start = Math.random();
        var end = start + 0.5 + Math.random()*1;
        block.gazeShift = {
          start: start,
          end: end,
          influence: "EYES",
          target: "CAMERA",
          type:"gazeShift"
        }
        block.composition = "MERGE";
      }

    	break;
  
  
  // PROCESSING
    case BehaviourPlanner.PROCESSING:
      this.nextBlockIn = 2 + Math.random() * 2;
      // gaze
      var offsetDirections = ["UPRIGHT", "UPLEFT", "LEFT", "RIGHT"]; // Upper and sides
      var randOffset = offsetDirections[Math.floor(Math.random() * offsetDirections.length)];
      if(Math.random() < 0.8)
      {
        block.gazeShift = {
          start: 0,
          end: 1 + Math.random(),
          influence: "EYES",
          target: "CAMERA",
          offsetDirection: randOffset,
          offsetAngle: 10 + 5*Math.random(),
          type:"gazeShift"
        }
      }

      // head nods
      if (Math.random() < 0.3)
      {
        // block.head = {
        //   start: 0,
        //   end: 1.5 + Math.random()*2,
        //   lexeme: Math.random() < 0.2 ? "TILT" : "NOD",
        //   amount: 0.05 + Math.random()*0.1,
        //   type:"head"
        // }
      }

      // frown
      if (Math.random() < 0.6)
      {
        block.face = {
          start: 0,
          end: 1 + Math.random(),
          lexeme: [
            {
              lexeme: "BROW_LOWERER", 
              amount: 0.2 + Math.random()*0.5
            }
          ],
          type:"face"
        }
      }

      // press lips
      if (Math.random() < 0.3)
      {
        var lexeme = {
          lexeme: "LIP_PRESSOR",
          amount: 0.1 + 0.3 * Math.random()
        };
        if(block.face)
          block.face.lexeme.push(lexeme)
        else
          block.face = {
            start: 0,
            end: 1 + Math.random(),
            lexeme: lexeme
        }
          block.face.type="face"
      }
      break;
  
  // WAITING
    case BehaviourPlanner.WAITING:
      
      this.nextBlockIn = 2 + Math.random() * 3;
      // gaze
      var offsetDirections = ["CAMERA","DOWN", "DOWNRIGHT", "DOWNLEFT", "LEFT", "RIGHT"]; // Upper and sides
      var randOffset = offsetDirections[Math.floor(Math.random() * offsetDirections.length)];
      block.gazeShift = {
        start: 0,
        end: 1 + Math.random(),
        target: "CAMERA",
        influence: Math.random()>0.5 ? "HEAD":"EYES",
        offsetDirection: offsetDirections[randOffset],
        offsetAngle: 5 + 5*Math.random(),
        type:"gazeShift"
      }

      // Set to neutral face (VALENCE-AROUSAL)
      //block.faceShift = {start: 0, end: 2, valaro: [0,0], type:"faceShift"};
      block.composition = "MERGE"
     	break;
  }
  return block;
}

// -------------------- NEW BLOCK --------------------
// New block arrives. It could be speech or control.
BehaviourPlanner.prototype.newBlock = function(block){
  
  // State
  if ( block.control ){
    this.transition(block);
  }

	// If non-verbal -> inside mode-selection.nonverbal
	if (block.nonVerbal){
		// Add gesture (check arousal of message)
    if (block.nonVerbal.constructor === Array){ // It is always an array in server
      for (var i = 0; i < block.nonVerbal.length; i++){ // TODO -> relate nonVerbal with lg
        var act = block.nonVerbal[i].dialogueAct;
        block.gesture = {lexeme: act, start: 0, end: 2, type:"gesture"};
      }
    }
    
	}
}

// Automatic blink and saccades
// http://hal.univ-grenoble-alpes.fr/hal-01025241/document
BehaviourPlanner.prototype.updateBlinksAndSaccades = function(dt){
  // Minimum time between saccades 150ms
  // Commonly occurring saccades 5-10 deg durations 30-40ms
  // Saccade latency to visual target is 200ms (min 100 ms)
  // Frequency?
  
  // 10-30 blinks per minute during conversation (every two-six seconds)
  // 1.4 - 14 blinks per min during reading
  
  var block = null;
   
  // Saccade
  this.saccCountdown += dt;
  if (this.saccCountdown > this.saccIdle){
    // Random direction
    var opts = ["RIGHT", "LEFT", "DOWN","DOWNRIGHT", "DOWNLEFT", "UP", "UPLEFT", "UPRIGHT"]; // If you are looking at the eyes usually don't look at the hair
    var randDir = opts[Math.floor(Math.random()*opts.length)];
    
    // Fixed point to saccade around?
    var target = "CAMERA"//"EYESTARGET";
    if (this.state == BehaviourPlanner.LISTENING) 
      target = "CAMERA";
        
    if (!block) 
      block = {};
    
    block.gaze = {
      start: 0,
      end: Math.random()*0.1+0.1,
      target: target, 
      influence: "EYES",
      offsetDirection: "CAMERA",
      offsetAngle: Math.random()*3 + 2,
      type:"gaze"
    }
    
    this.saccCountdown = this.saccDur;
    if (this.state ==BehaviourPlanner.LISTENING || this.state == BehaviourPlanner.SPEAKING)
      this.saccIdle = this.saccDur + 2 + Math.random()*6;
    else
  		this.saccIdle = this.saccDur + 0.5 + Math.random()*6;
  	
    this.saccDur = Math.random()*0.5 + 0.5;
  }
  
  return block;
}


BehaviourPlanner.prototype.attentionToUser = function(block, overwrite){
  // If gazeShift already exists, modify
	var end = 0.5 + Math.random();
	var startHead = 0;
  var startGaze = startHead + Math.random()*0.5; // Late start
  
	// gazeShift
	var gazeShift = {
    id: "gazeEnd",
		start: startGaze,
		end: end,
		influence: "EYES",
		target: "CAMERA",
    type:"gazeShift"
	}
  
	// headDirectionShift
	var offsetDirections = ["CAMERA","DOWN", "DOWNLEFT", "DOWNRIGHT"]; // Submissive? Listening?
  var randOffset = offsetDirections[Math.floor(Math.random() * offsetDirections.length)];
	var startDir = -Math.random()*0.3;
	var headDir = {
		start: startHead,
		end: end,
		target: "CAMERA",
    offsetDirection: "CAMERA",
    offsetAngle: 2 + 5*Math.random(),
    type:"headDirectionShift"
	}
  
  var faceVA = {
    start: startHead,
    end: end,
    valaro: [this.defaultValence, 0],
    type:"faceVA",
    shift : true
  }
  
  // Force and remove existing bml instructions
  if (overwrite)
  {
    //block.blink = blink;
    //block.faceVA = faceVA;
    block.gazeShift = gazeShift;
    block.headDirectionShift = headDir;
  } 
  else
  {
    //this.addToBlock(blink, block, "blink");
    //this.addToBlock(faceVA, block, "faceVA");
    this.addToBlock(gazeShift, block, "gazeShift");
    this.addToBlock(headDir, block, "headDirectionShift");
  }
}

BehaviourPlanner.prototype.addToBlock = function(bml, block, key){
  if (block[key])
  {
    // Add to array (TODO: overwrite, merge etc...)
    if (block[key].constructor === Array)
    {
      if (bml.constructor === Array)
        for (var i = 0; i<bml.length; i++)
          block[key].push(bml[i]);
      else
        block[key].push(bml);
    }
    // Transform object to array
    else {
      var tmpObj = block[key];
      block[key] = [];
      block[key].push(tmpObj);
      if (bml.constructor === Array)
        for (var i = 0; i<bml.length; i++)
          block[key].push(bml[i]);
       else
        block[key].push(bml);
    }
  } 
  // Doesn't exist yet
  else
    block[key] = bml;
  
}


// ---------------------------- NONVERBAL GENERATOR (for speech) ----------------------------
// Process language generation message
// Adds new bml instructions according to the dialogue act and speech
//BehaviourPlanner.prototype.processSpeechBlock = function (bmlLG, block, isLast){}

// Use longest word as prosody mark
//BehaviourPlanner.prototype.createBrowsUp = function (bmlLG){}

// Generate faceShifts at the end of speech
//BehaviourPlanner.prototype.createEndFace = function (bmlLG){}

// Create a head nod at the beggining
//BehaviourPlanner.prototype.createHeadNodStart = function (bmlLG){}

// Create gaze (one at start to look away and back to user)
//BehaviourPlanner.prototype.createGazeStart = function (bmlLG){}

// Look at the camera at the end
//BehaviourPlanner.prototype.createGazeEnd = function (bmlLG){}

// Change offsets of new bml instructions
//BehaviourPlanner.prototype.fixSyncStart = function (bml, offsetStart){}

// Add a pause between speeches
//BehaviourPlanner.prototype.addUtterancePause = function (bmlLG){}

export { BehaviourPlanner }