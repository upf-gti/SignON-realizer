// @BehaviourManager

// Message gets to BehaviourManager -> then to facial control -> then to BehaviorRealizer

// Needs to synchronize BML actions of the same block
// [MERGE,APPEND,REPLACE,OVERWRITE]
// Warnings and feedback
// wait, synchronize, constraints, before, after

function BehaviourManager() {

	// BML instruction keys
	this.bmlKeys = ["blink", "gaze", "gazeShift", "face", "faceShift", "head", "headDirectonShift", "lg", "gesture", "posture", "animation"];

	// BML stack
	this.blinkStack = [];
	this.gazeStack = [];
	this.faceStack = [];
	this.headStack = [];
	this.headDirStack = [];
	this.speechStack = [];
	this.gestureStack = [];
	this.pointingStack = [];
	this.postureStack = [];

	this.lgStack = [];
	this.animationStack = [];

	this.BMLStacks = [this.blinkStack, this.gazeStack, this.faceStack, this.headStack, this.headDirStack, this.speechStack, this.lgStack,
	this.gestureStack, this.pointingStack, this.postureStack, this.animationStack];

	// Block stack
	this.stack = [];
}

// TODO: PROVIDE FEEDBACK AND WARNINGS
BehaviourManager.prototype.update = function (actionCallback, time) {

	// Time now
	//var d = new Date();
	this.time = time;// || d.getSeconds() + 0.001*d.getMilliseconds();

	// Several blocks can be active (MERGE composition)
	for (var i = 0; i < this.stack.length; i++) {
		// If it is not active
		if (this.stack[i].isActive === undefined) {
			// Block starts
			if (this.stack[i].startGlobalTime <= this.time) {
				this.stack[i].isActive = true;
				// Feedback
				this.progressFeedback(this.stack[i].id, "start", this.time);
			}
		}
		// Check if has ended
		else if (this.stack[i].isActive) {
			if (this.stack[i].endGlobalTime <= this.time) {
				this.stack[i].isActive = false;
				// Feedback
				this.progressFeedback(this.stack[i].id, "end", this.time);
				// CALLBACK
				//LS.Globals.ws.send(cmdId + ": true");
				if (this.stack[i].fromWS) {
					//LS.Globals.ws.send(this.stack[i].id + ": true"); // HARDCODED
					console.log("Sending POST response with id:", this.stack[i].id);
				}
				// Remove
				this.removeFromStacks(this.stack[i]);
				this.stack.splice(i, 1);
				i--;
			}
		}
	}

	// Check active BML and blocks (from BMLStacks)
	for (var i = 0; i < this.BMLStacks.length; i++) {
		// Select bml instructions stack
		var stack = this.BMLStacks[i];
		for (var j = 0; j < stack.length; j++) {
			var bml = stack[j];
			// BML is not active
			if (bml.isActive === undefined) {
				// Set BML to active
				if (bml.startGlobalTime <= this.time) {
					bml.isActive = true;
					actionCallback(bml.key, bml); // CALL BML INSTRUCTION
				}
			}
			// BML has finished
			else if (bml.isActive) {
				if (bml.endGlobalTime <= this.time) {
					bml.isActive = undefined;
					// Remove from bml stack
					stack.splice(j, 1);
					j--;
				}
			}
		}
	}
}

BehaviourManager.prototype.newBlock = function (block, time) {

	if (!block) {
		return;
	}

	// Time now
	//var d = new Date();
	if (this.time == 0) {
		time = 0.001;
	}
	this.time = time;

	// TODO: require

	// Fix and Sychronize (set missing timings) (should substitute "start:gaze1:end + 1.1" by a number)
	this.fixBlock(block);
	// TODO: constraint (synchronize, after, before) and wait

	// Remove blocks with no content
	if (block.end == 0) {
		console.error("Refused block.\n", JSON.stringify(block));
		// Send POST response if the block si coming from websocket
		if (block.fromWS) {
			//LS.Globals.ws.send(block.id + ": true"); // HARDCODED
			console.log("Sending POST response with id:", block.id);
		}
		return;
	}

	// Add to stack
	this.addToStack(block);
	// Check timing errors
	this.check();
	//console.log("FIXED BLOCK.", JSON.stringify(block), block);
	//console.log(this.BMLStacks);
}

BehaviourManager.prototype.fixBlock = function (block) {
	// Define block start (in BML this is not specified, only in bml instructions, not in blocks)
	block.start = block.start || 0.0;
	// Check if it is a number
	block.start = this.checkSync(block.start, block);

	// Define timings and find sync attributes (defaults in percentage unless start and end)
	// Blink
	if (block.blink)
		block.blink = this.fixBML(block.blink, "blink", block, { start: 0, attackPeak: 0.25, relax: 0.25, end: 0.5 });

	// Gaze
	if (block.gaze)
		block.gaze = this.fixBML(block.gaze, "gaze", block, { start: 0, ready: 0.33, relax: 0.66, end: 2.0 });

	// GazeShift
	if (block.gazeShift)
		block.gazeShift = this.fixBML(block.gazeShift, "gazeShift", block, { start: 0, end: 2.0 });

	// Head
	if (block.head)
		block.head = this.fixBML(block.head, "head", block, { start: 0, ready: 0.15, strokeStart: 0.15, stroke: 0.5, strokeEnd: 0.8, relax: 0.8, end: 2.0 });

	// HeadDirection
	if (block.headDirectionShift)
		block.headDirectionShift = this.fixBML(block.headDirectionShift, "headDirectionShift", block, { start: 0, end: 2.0 });

	// Face
	if (block.face)
		block.face = this.fixBML(block.face, "face", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });
	// Face
	if (block.faceFACS)
		block.faceFACS = this.fixBML(block.faceFACS, "faceFACS", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });

	// Face
	if (block.faceLexeme)
		block.faceLexeme = this.fixBML(block.faceLexeme, "faceLexeme", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });

	// Face
	if (block.faceEmotion)
		block.face = this.fixBML(block.faceEmotion, "face", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });

	// Face VA
	if (block.faceVA)
		block.face = this.fixBML(block.faceVA, "face", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });

	// FaceShift
	if (block.faceShift)
		block.faceShift = this.fixBML(block.faceShift, "faceShift", block, { start: 0, end: 1 });

	// Speech (several instructions not implemented)
	if (block.speech)
		block.speech = this.fixBML(block.speech, "speech", block, { start: 0, end: 2.5 });

	// Language-generation
	if (block.lg)
		block.lg = this.fixBML(block.lg, "lg", block, { start: 0, end: 1 });

	// Posture
	if (block.posture)
		block.posture = this.fixBML(block.posture, "posture", block, { start: 0, ready: 0.3, strokeStart: 0.3, stroke: 0.4, strokeEnd: 0.6, relax: 0.7, end: 1.0 });

	// Gesture
	if (block.gesture)
		block.gesture = this.fixBML(block.gesture, "gesture", block, { start: 0, ready: 0.1, strokeStart: 0.2, stroke: 0.7, strokeEnd: 0.7, relax: 1.4, end: 1.5 });

	// Pointing
	if (block.pointing)
		block.pointing = this.fixBML(block.pointing, "pointing", block, { start: 0, ready: 0.3, strokeStart: 0.3, stroke: 0.4, strokeEnd: 0.6, relax: 0.7, end: 1.0 });

	// Animation
	if (block.animation)
		block.animation = this.fixBML(block.animation, "animation", block, { start: 0, end: 2.0 });

	// Find end of block
	block.end = this.findEndOfBlock(block);
}

BehaviourManager.prototype.fixBML = function (bml, key, block, sync) {
	// Error check
	if (!bml) {
		console.warn("BML instruction undefined or null:", key, bml);
		delete block[key];
		return;
	}

	// Several instructions inside
	if (bml.constructor === Array) {
		for (var i = 0; i < bml.length; i++)
			bml[i] = this.fixBML(bml[i], key, block, sync);
		return bml;
	}

	// Check if is it an object
	if (typeof bml !== "object" || bml === null)
		bml = {};

	// Define type (key)
	bml.key = key;

	// Define timings
	var keys = Object.keys(sync);

	// START
	// Check sync
	bml.start = this.checkSync(bml.start, block);
	// Define start
	bml.start = bml.start || 0.0;
	if (bml.start < 0) {
		console.warn("Negative starts are not permitted. Found in", key);
		bml.start = 0;
	}
	// END
	// Check sync
	bml.end = this.checkSync(bml.end, block);

	// If no "end", apply default end attribute
	if (bml.end === undefined)
		bml.end = sync.end + bml.start;

	// OTHER SYNC
	// If start and end are defined, fill other sync points.
	for (var i = 0; i < keys.length; i++) {
		// Avoid start and end
		if (keys[i] == "start" || keys[i] == "end") continue;

		// Check sync (returns the number if it is already defined)
		if (bml[keys[i]] !== undefined)
			bml[keys[i]] = this.checkSync(bml[keys[i]], block);
		// If undefined fill default sync points (represented in portions between 0-1)
		if (bml[keys[i]] === undefined)
			bml[keys[i]] = (bml.end - bml.start) * sync[keys[i]] + bml.start;
	}
	// TODO Check consistency?

	return bml;
}

BehaviourManager.prototype.checkSync = function (syncAttr, block, it) {

	// Check if undefined
	if (syncAttr === undefined || syncAttr !== syncAttr || syncAttr === null) {
		console.warn("Sync attr undefined or NaN.", syncAttr, it);
		return undefined;
	}

	// Limit recursive iterations
	if (it === undefined)
		it = 0;
	else if (it > 5) {
		console.error("Six iterations without finding syncAttr.", syncAttr, block, it);
		return undefined;
	}

	// Parse number
	var tNumber = parseFloat(syncAttr);

	// Needs sync
	if (isNaN(tNumber)) {
		tNumber = null;
		// Find sync value
		var str = syncAttr.replace(/\s+/g, '');
		str = str.split("+");
		var ids = str[0].split(":");
		// Two ids -> look inside block (gaze1:end)
		if (ids.length == 2)
			tNumber = this.findTime(ids[0], ids[1], block, it);
		// Three ids -> look inside block stack (bml1:gaze1:end) and compensate global times
		else if (ids.length == 3) {
			for (var i = 0; i < this.stack.length; i++) {
				if (this.stack[i].id == ids[0]) { // Find block
					tNumber = this.findTime(ids[1], ids[2], this.stack[i], it);
					// The number is a reference to another block
					// This number is not usable until the current block is placed according
					// to composition. To mark it, the global time stamp is found and set to
					// negative, in order to fix it later, once the current block is placed.
					if (!isNaN(tNumber)) {
						tNumber += parseFloat(this.stack[i].startGlobalTime); // Global timestamp
						tNumber *= -1; // Negative flag
					}
					break;
				}
			}
		}

		// If sync attr not found
		if (tNumber === null) {
			console.error("Sync attr not found.", syncAttr, block, it);
			return tNumber;
		}
		// Add offset
		if (str.length == 2)
			tNumber += parseFloat(str[1]) || 1 * Math.sign(parseFloat(tNumber)); // This last part is to compensate
		// the negative flag (ref to other blocks)
	}

	return tNumber;
}

BehaviourManager.prototype.findTime = function (id, syncName, block, it) {

	var result = null;
	// Check all keys
	var keys = Object.keys(block);

	// Clean spaces
	id = id.replace(/\s/g, "");
	syncName = syncName.replace(/\s/g, "");

	for (var i = 0; i < keys.length; i++) {
		// Array of bmls
		if (block[keys[i]].constructor === Array) {
			var arr = block[keys[i]];
			for (var j = 0; j < arr.length; j++) {
				if (arr[j].id == id) {
					result = arr[j][syncName];
				}
			}
		}
		// bml
		if (block[keys[i]].id == id) {
			result = block[keys[i]][syncName];
			break;
		}
	}

	// Check that result is valid
	if (result == null)
		console.error("Sync attr " + id + ":" + syncName + " not found. Setting default values.", block);
	// Sync attr is another sync reference
	else if (isNaN(result)) {
		console.log("Synchronization: looking for: ", result);
		it++;
		return this.checkSync(result, block, it)
	}
	// Sync attr found
	else
		return result;
}

BehaviourManager.prototype.findEndOfBlock = function (block) {

	var keys = Object.keys(block);
	var latestEnd = 0;

	for (var i = 0; i < keys.length; i++) {
		var bml = block[keys[i]];
		if (bml === null) { }
		//console.error("Empty bml instruction.", keys[i], block);
		else if (bml.end !== undefined)
			latestEnd = Math.max(bml.end, latestEnd);

		if (bml.constructor === Array) // several instructions inside class
			for (var j = 0; j < bml.length; j++) {
				if (!bml[j]) { }
				//console.error("Empty bml instruction.", keys[i], block)
				else if (bml[j].end !== undefined)
					latestEnd = Math.max(bml[j].end, latestEnd);
			}
	}

	return latestEnd;
}

BehaviourManager.prototype.addToStack = function (block) {

	if (Object.prototype.toString.call(block.composition) === '[object String]')
		block.composition = block.composition.toUpperCase();

	// OVERWRITE
	if (block.composition == "OVERWRITE") { // Doens't make sense, only for individual stacks, not whole
		// Substitute in stack

		block.startGlobalTime = this.time + block.start;
		block.endGlobalTime = this.time + block.end;

		// Add block to stack
		if (this.stack.length == 0) {
			this.stack.push(block);
		}
		else {
			var last = this.stack[this.stack.length - 1];
			if (block.endGlobalTime < last.endGlobalTime) {
				this.stack[this.stack.length - 1] = block;
				this.stack.push(last);
			}
			else
				this.stack.push(block);
		}
		// Add to bml stack (called at the end of function)
	}

	// APPEND
	else if (block.composition == "APPEND") {
		// No actions in the stack
		if (this.stack.length == 0) {
			block.startGlobalTime = this.time + block.start;
			block.endGlobalTime = this.time + block.end;
			this.stack[0] = block;
		}
		// Last action in the stack (if start != 0 waiting time?)
		else {
			block.startGlobalTime = this.stack[this.stack.length - 1].endGlobalTime + block.start;
			block.endGlobalTime = block.end + this.stack[this.stack.length - 1].endGlobalTime;
			this.stack.push(block);
		}
	}

	// REPLACE
	else if (block.composition == "REPLACE") {
		// No actions in the stack
		if (this.stack.length == 0) {
			block.startGlobalTime = this.time + block.start;
			block.endGlobalTime = this.time + block.end;
			this.stack[0] = block;
		}
		// Second action in the stack (if start != 0 waiting time?)
		else {
			block.startGlobalTime = this.stack[0].endGlobalTime;
			block.endGlobalTime = block.startGlobalTime + block.end;

			// Remove following blocks
			for (var i = 1; i < this.stack.length; i++)
				this.removeFromStacks(this.stack[i]);

			this.stack[1] = block;
		}
	}

	// MERGE (default)
	else {
		// No actions in the stack
		if (this.stack.length == 0) {
			block.startGlobalTime = this.time + block.start;
			block.endGlobalTime = this.time + block.end;
			this.stack[0] = block;
		}
		// Merge and add to BML stacks
		else { // Try to merge, if not, add "del" variable to bml
			if (block.blink)
				this.processIntoBMLStack(block.blink, this.blinkStack, this.time + block.start, block.composition);

			if (block.gaze)
				this.processIntoBMLStack(block.gaze, this.gazeStack, this.time + block.start, block.composition); // This could be managed differently (gazeManager in BMLRealizer.js)

			if (block.gazeShift)
				this.processIntoBMLStack(block.gazeShift, this.gazeStack, this.time + block.start, block.composition);

			if (block.face)
				this.processIntoBMLStack(block.face, this.faceStack, this.time + block.start, block.composition);

			if (block.faceLexeme)
				this.processIntoBMLStack(block.faceLexeme, this.faceStack, this.time + block.start, block.composition);

			if (block.faceFACS)
				this.processIntoBMLStack(block.faceFACS, this.faceStack, this.time + block.start, block.composition);
			if (block.faceVA)
				this.processIntoBMLStack(block.faceVA, this.faceStack, this.time + block.start, block.composition);

			if (block.faceShift)
				this.processIntoBMLStack(block.faceShift, this.faceStack, this.time + block.start, block.composition);

			if (block.head)
				this.processIntoBMLStack(block.head, this.headStack, this.time + block.start, block.composition);

			if (block.headDirectionShift)
				this.processIntoBMLStack(block.headDirectionShift, this.headDirStack, this.time + block.start, block.composition);

			if (block.speech)
				this.processIntoBMLStack(block.speech, this.speechStack, this.time + block.start, block.composition);

			if (block.posture)
				this.processIntoBMLStack(block.posture, this.postureStack, this.time + block.start, block.composition);

			if (block.gesture)
				this.processIntoBMLStack(block.gesture, this.gestureStack, this.time + block.start, block.composition);

			if (block.pointing)
				this.processIntoBMLStack(block.head, this.pointingStack, this.time + block.start, block.composition);

			if (block.lg)
				this.processIntoBMLStack(block.lg, this.lgStack, this.time + block.start, block.composition);

			if (block.animation)
				this.processIntoBMLStack(block.animation, this.animationStack, this.time + block.start, block.composition);
			//TODO - Send warning feedback

			// Clean block
			this.cleanBlock(block);

			// Add to block stack
			block.startGlobalTime = this.time + block.start;
			block.endGlobalTime = this.time + block.end;
			/*for (var i = 0; i < this.stack.length; i++){
				if (this.stack[i].startGlobalTime < block.startGlobalTime){
					var tmp = this.stack.splice(i+1,this.stack.length-1);
					this.stack.push(block);
					this.stack.concat(tmp);
		  			return;
				}		
			}*/

			// Add at the end (the last one should be always the latest)
			var last = this.stack[this.stack.length - 1];
			if (block.endGlobalTime < last.endGlobalTime) {
				this.stack[this.stack.length - 1] = block;
				this.stack.push(last);
				return;
			}
			this.stack.push(block);
			return;
		}
	}

	// Add to stacks
	this.addToBMLStack(block);
}

// Removes all bml instructions from stacks
BehaviourManager.prototype.removeFromStacks = function (block) {

	var keys = Object.keys(block);
	// Add delete variable in block to bml instructions
	for (var i = 0; i < keys.length; i++) { // Through bml instructions
		var bml = block[keys[i]];
		if (bml !== null || bml !== undefined) {
			// Is an array of bml instructions
			if (bml.constructor === Array)
				for (var j = 0; j < bml.length; j++)
					bml[j].del = true;

			if (typeof bml === "object")
				bml.del = true;
		}
	}

	// Remove from stacks bml with del
	for (var i = 0; i < this.BMLStacks.length; i++) { // Through list of stacks
		for (var j = 0; j < this.BMLStacks[i].length; j++) {// Through stack
			if (this.BMLStacks[i][j].del) { // Find del variable in stack
				this.BMLStacks[i][j].isActive = undefined; // If reusing object
				this.BMLStacks[i].splice(j, 1); // Remove from stack
				j--;
			}
		}
	}
}

BehaviourManager.prototype.cleanBlock = function (block) {

	var keys = Object.keys(block);
	for (var i = 0; i < keys.length; i++) {
		var bml = block[keys[i]];
		if (bml !== null || bml !== undefined) {
			// Is an array of bml instructions
			if (bml.constructor === Array)
				for (var j = 0; j < bml.length; j++)
					if (bml[j].del)
						delete block[keys[i]];

			if (bml.del)
				delete block[keys[i]];
		}
	}
}

// Add bml actions to stacks with global timings
BehaviourManager.prototype.addToBMLStack = function (block) {

	var globalStart = block.startGlobalTime;

	// Blink
	if (block.blink)
		this.processIntoBMLStack(block.blink, this.blinkStack, globalStart, block.composition);

	// Gaze
	if (block.gaze)
		this.processIntoBMLStack(block.gaze, this.gazeStack, globalStart, block.composition);
	if (block.gazeShift)
		this.processIntoBMLStack(block.gazeShift, this.gazeStack, globalStart, block.composition);

	// Head
	if (block.head)
		this.processIntoBMLStack(block.head, this.headStack, globalStart, block.composition);
	if (block.headDirectionShift)
		this.processIntoBMLStack(block.headDirectionShift, this.headDirStack, globalStart, block.composition);

	// Face
	if (block.faceLexeme)
		this.processIntoBMLStack(block.faceLexeme, this.faceStack, globalStart, block.composition);

	if (block.faceFACS)
		this.processIntoBMLStack(block.faceFACS, this.faceStack, globalStart, block.composition);

	if (block.face)
		this.processIntoBMLStack(block.face, this.faceStack, globalStart, block.composition);

	if (block.faceShift)
		this.processIntoBMLStack(block.faceShift, this.faceStack, globalStart, block.composition);

	// Speech
	if (block.speech)
		this.processIntoBMLStack(block.speech, this.speechStack, globalStart, block.composition);

	// Posture
	if (block.posture)
		this.processIntoBMLStack(block.posture, this.postureStack, globalStart, block.composition);

	// Gesture
	if (block.gesture)
		this.processIntoBMLStack(block.gesture, this.gestureStack, globalStart, block.composition);

	// Pointing
	if (block.pointing)
		this.processIntoBMLStack(block.pointing, this.pointingStack, globalStart, block.composition);

	// LG
	if (block.lg)
		this.processIntoBMLStack(block.lg, this.lgStack, globalStart, block.composition);

	// Animation
	if (block.animation)
		this.processIntoBMLStack(block.animation, this.animationStack, globalStart, block.composition);
}

// Add bml action to stack
BehaviourManager.prototype.processIntoBMLStack = function (bml, stack, globalStart, composition) {

	// Overwrite
	var overwrite = composition == "OVERWRITE";

	// Several instructions
	if (bml.constructor === Array) {
		for (var i = 0; i < bml.length; i++)
			this.processIntoBMLStack(bml[i], stack, globalStart, composition);
		return;
	}

	// Could be called directly? Should always return true
	let merge = composition=="MERGE" ? true : false;
	var merged = this.mergeBML(bml,stack,globalStart, overwrite, merge);
  bml.del = !merged;

	// First, we check if the block fits between other blocks, thus all bml instructions
	// should fit in the stack.
	if (!merged)
		console.warn("Could not add to " + bml.key + " stack. \n");// + "BML: ", 
	//JSON.stringify(bml), "\nSTACK: ", 
	//JSON.stringify(stack));
}


BehaviourManager.prototype.mergeBML = function(bml, stack, globalStart, overwrite, merge = false){
	var merged = false;
	
	// Refs to another block (negative global timestamp)
	if (bml.start < 0)
		bml.start = (-bml.start) - globalStart; // The ref timestamp should be always bigger than globalStart

	if (bml.end < 0)
		bml.end = (-bml.end) - globalStart;

	bml.startGlobalTime = globalStart + bml.start;
	bml.endGlobalTime = globalStart + bml.end;

	// Check errors
	if (bml.start < 0) console.error("BML start is negative", bml.start, bml.key, globalStart);
	if (bml.end < 0) console.error("BML end is negative", bml.end, bml.key, globalStart);

	// Modify all sync attributes to remove non-zero starts (offsets)
	// Also fix refs to another block (negative global timestamp)
	bml.end -= bml.start;

	var tmpStart = bml.start;
	if (bml.attackPeak)
		bml.attackPeak = this.mergeBMLSyncFix(bml.attackPeak, bml.start, globalStart);
	if (bml.ready)
		bml.ready = this.mergeBMLSyncFix(bml.ready, bml.start, globalStart);
	if (bml.strokeStart)
		bml.strokeStart = this.mergeBMLSyncFix(bml.strokeStart, bml.start, globalStart);
	if (bml.stroke)
		bml.stroke = this.mergeBMLSyncFix(bml.stroke, bml.start, globalStart);
	if (bml.strokeEnd)
		bml.strokeEnd = this.mergeBMLSyncFix(bml.strokeEnd, bml.start, globalStart);
	if (bml.relax)
		bml.relax = this.mergeBMLSyncFix(bml.relax, bml.start, globalStart);

	bml.start = 0;

	// Empty
	if (stack.length == 0) {
		stack[0] = bml;
		merged = true;
	}
	else {
		// Fits between
		if (stack.length > 1) {

			//append at the end
			if (bml.startGlobalTime >= stack[stack.length - 1].endGlobalTime)
				stack.push(bml);
			// fit on the stack?
			else
				for (var i = 0; i<stack.length-1; i++)
				{
					if(merged) break;
					// Does it fit?
					if (bml.startGlobalTime >= stack[i].endGlobalTime && bml.endGlobalTime <= stack[i + 1].startGlobalTime || i == 0 && bml.endGlobalTime < stack[i].startGlobalTime) {
						if (!merged) {
							tmp = stack.splice(i, stack.length);
							stack.push(bml);
							stack.concat(tmp);
							merged = true;
						}
					}
					// If it doesn't fit remove if overwrite
					else if (overwrite) {
						// Remove from bml stack
						stack.splice(i, 1);
						i--;
					}
					else if(merge){
						stack.push(bml);
						merged = true;
					}
				}
		}
		// End of stack (stack.length == 1)
		if (!merged || overwrite) {
			// End of stack
			if (stack[stack.length - 1].endGlobalTime <= bml.startGlobalTime) {
				if (!merged) {
					stack.push(bml);
					merged = true;
				}
			}
			else if (overwrite)
				stack.splice(stack.length - 1, 1);
			else if (bml.endGlobalTime < stack[0].startGlobalTime) {// Start of stack
				stack.push(bml);
				stack.reverse();
			}
		}
	}
	// After removing conflicting bml, add
	if (overwrite && !merged) {
		stack.push(bml);
		merged = true;
	}

	return merged;
}

// Fix ref to another block (negative global timestamp) and remove start offset
BehaviourManager.prototype.mergeBMLSyncFix = function (syncAttr, start, globalStart) {
	// Ref to another block
	if (syncAttr < 0) syncAttr = (-syncAttr) - globalStart;
	// Remove offset
	syncAttr -= start;

	// Check error
	if (syncAttr < 0)
		console.error("BML sync attribute is negative.", syncAttr, start, globalStart);

	return syncAttr;
}

// Checks that all stacks are ordered according to the timeline (they should be as they are insterted in order)
BehaviourManager.prototype.check = function () {

	if (this.errorCheck(this.blinkStack)) console.error("Previous error is in blink stack");
	if (this.errorCheck(this.gazeStack)) console.error("Previous error is in gaze stack");
	if (this.errorCheck(this.faceStack)) console.error("Previous error is in face stack");
	if (this.errorCheck(this.headStack)) console.error("Previous error is in head stack");
	if (this.errorCheck(this.headDirStack)) console.error("Previous error is in headDir stack");
	if (this.errorCheck(this.speechStack)) console.error("Previous error is in speech stack");
	if (this.errorCheck(this.postureStack)) console.error("Previous error is in posture stack");
	if (this.errorCheck(this.gestureStack)) console.error("Previous error is in gesture stack");
	if (this.errorCheck(this.pointingStack)) console.error("Previous error is in pointing stack");
	if (this.errorCheck(this.lgStack)) console.error("Previous error is in lg stack");
	if (this.errorCheck(this.animationStack)) console.error("Previous error is in animation stack");
}

BehaviourManager.prototype.errorCheck = function (stack) {
	// Check timings
	for (var i = 0; i < stack.length - 1; i++) {
		if (stack[i].endGlobalTime > stack[i + 1].startGlobalTime) {
			console.error("Timing error in stack: ", stack);
			return true;
		}
	}
}

// Provide feedback
BehaviourManager.prototype.progressFeedback = function (id, sync, time) {

	return;

	// Create the object only once
	if (!this.pFeedback)
		this.pFeedback = { blockProgress: {} };

	var fbk = this.pFeedback;
	fbk.blockProgress.id = id + ":" + sync;
	fbk.blockProgress.globalTime = time;
	//fbk.blockProgress.characterId = characterId;

	console.log(JSON.stringify(fbk));
}

export { BehaviourManager }