//@BehaviorRealizer
import '../../libs/gl-matrix-min.js'
import * as THREE from 'three';
let DEG2RAD = Math.PI/180;
let RAD2DEG = 180/Math.PI;
// --------------------- BLINK ---------------------
// BML
// <blink start attackPeak relax end amount>
// Scene inputs: eyeLidsBSW and facial expression eyeLidsBSW during updates

function Blink (blinkData, eyeLidsBSW){
  // Sync attributes
  this.start = blinkData.start || 0;
  this.end = blinkData.end || 0.5;
  this.attackPeak = blinkData.attackPeak || (this.end - this.start)*0.4 + this.start;
  this.relax = blinkData.relax || this.attackPeak;

  // Initial eyeLidsBSW
  this.initialWeight = eyeLidsBSW || 0;
  this.targetWeight = blinkData.amount || 0.75;

  // Transition
  this.transition = true;
  this.time = 0;
}


Blink.prototype.update = function(dt){

  this.time += dt;

  // Waiting to reach start
  if (this.time < this.start)
    return;
  var inter = 0;
  // Transition 1 (closing eyes)
  if (this.time < this.attackPeak){
    inter = (this.time-this.start)/(this.attackPeak-this.start);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;
    // Return value
    return this.initialWeight*(1-inter) + this.targetWeight * inter;
  }
  
  // Stay still during attackPeak to relax
  if (this.time > this.attackPeak && this.time < this.relax)
    return this.targetWeight;
  
  
  // Transition 2 (opening back)
  if (this.time < this.end){
    inter = (this.time-this.relax)/(this.end-this.relax);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter)*0.5 + 0.5;
    // Interpolate with scene eyeLidsBSW
    return this.initialWeight*(1-inter) + this.targetWeight * inter;
  }
  
  // End 
  if (this.time >= this.end){
    this.transition = false;
    return this.initialWeight;
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
// Scene inputs: sceneBSW

FacialExpr.prototype.sceneBSW;


// Variables for Valence Arousal
FacialExpr.prototype.initialVABSW = [];
FacialExpr.prototype.targetVABSW = [];

// Variables for Lexemes
FacialExpr.prototype.initialLexBSW = [];
FacialExpr.prototype.targetLexBSW = [];

// Psyche Interpolation Table
/*FacialExpr.prototype._pit = [0.000, 0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,
                            0.000,  1.000,  0.138,  1.00,  0.000,  0.675,  0.000,  0.056,  0.200,  0.116,  0.100,
                            0.500,  0.866,  0.000,  0.700,  0.000,  0.000,  0.000,  0.530,  0.000,  0.763,  0.000,
                            0.866,  0.500,  0.000,  1.000,  0.000,  0.000,  0.600,  0.346,  0.732,  0.779,  0.000,
                            1.000,  0.000,  0.065,  0.000,  0.344,  0.344,  0.700,  0.000,  0.000,  1.000,  -0.300,
                            0.866,  -0.500, 0.391,  0.570,  0.591,  0.462,  1.000,  0.000,  0.981,  0.077,  0.000,
                            0.500,  -0.866, 0.920,  0.527,  0.000,  0.757,  0.250,  0.989,  0.000,  0.366,  -0.600,
                            0.000,  -1.000, 0.527,  0.000,  0.441,  0.531,  0.000,  0.000,  1.000,  0.000,  0.600,
                            -0.707, -0.707, 1.000,  0.000,  0.000,  0.000,  0.500,  1.000,  0.000,  0.000,  0.600,
                            -1.000, 0.000,  0.995,  0.000,  0.225,  0.000,  0.000,  0.996,  0.000,  0.996,  0.200,
                            -0.707, 0.707,  0.138,  0.075,  0.000,  0.675,  0.300,  0.380,  0.050,  0.216,  0.300];*/

/* "valence", "arousal" ,"BLINK","CHEEK_RAISER", "LIP_CORNER_PULLER", "BROW_LOWERER", "DIMPLER", "OUTER_BROW_RAISER", "
UPPER_LID_RAISER", "JAW_DROP","LID_TIGHTENER", "LIP_STRECHER","NOSE_WRINKLER", "LIP_CORNER_DEPRESSOR", "CHIN_RAISER", "LIP_CORNER_PULLER_RIGHT", "DIMPLER_RIGHT"*/
/*FacialExpr.prototype._pit = [
  [0.95, 0.23 ,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0 ],//HAPPINESS
  [-0.81, -0.57, 0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0 ], //SADNESS
  [0.22, 0.98, 0,0,0,1,0,1,1,1,0,0,0,0,0,0,0,0 ], //SURPRISED
  [-0.25, 0.98 ,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0 ], //FEAR
  [-0.76, 0.64,0 , 0,0,0,1,0,1,0,1,0,1,0,0,0,0,0 ], //ANGER
  [-0.96, 0.23,0, 0,0,0,0,0,0,0,0,0,0,1,1,1,0,0 ], //DISGUST
  [-0.98, -0.21,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,1,1 ], //CONTEMPT
  [0, 0 ,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ] //NEUTRAL
  ]*/
FacialExpr.prototype.VALexemes = ["BLINK","CHEEK_RAISER", "LIP_CORNER_PULLER", "BROW_LOWERER", "DIMPLER", "OUTER_BROW_RAISER", "UPPER_LID_RAISER", "JAW_DROP","LID_TIGHTENER", "LIP_STRECHER","NOSE_WRINKLER", "LIP_CORNER_DEPRESSOR", "CHIN_RAISER", "LIP_CORNER_PULLER_RIGHT", "DIMPLER_RIGHT"]
FacialExpr.prototype._pit = [
  [//ANGRY 
    -0.76, 0.64, 0, 0, 0.37735849056603776, 0.37735849056603776, 0.660377358490566, 0.660377358490566, 0, 0, 0.006777392958909609, 0.006174350308024318, 0, 0, 0.008490566037735849, 0.008490566037735849, 0.3113207547169812, 0.3113207547169812, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.009433962264150943, 0.007983478260680202, 0.018497328267128684, 0, 0, 0.2655452832234524, 0.27559599407154056, 0.038135610804944806, 0.038135610804944806, 0.2358490566037736, 0.2358490566037736, 0, 0, 0, 0, 0
    ],
  [//HAPPY
    0.95, 0.23, 0, 0, -0.18916378536627232, -0.179660980579041, 0, 0, 0, 0, 0, 0, 0, 0, 0.24764010809164083, 0.24764010809164083, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.20502509409574698, 0, 0, 0, 0, 0, 0.7803277830403155, 0.8111380948254938, 0, 0, 0, 0, 0, 0, 0
    ],
  [//SAD
    -0.81, -0.57, 0, 0, 0, 0, 0, 0, 0.769674029541342, 0.8122890435372361, 0, 0, 0, 0, 0, 0, 0.5033301920670048, 0.46071517807111073, 0, 0.5565989595618721, 0, 0, 0, 0, 0, 0, 0, 0.3861389035782963, 0.02391128461319747, 0, 0, 0.5992139735577662, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ],
  [//SURPRISED
    0.22, 0.98, 0, 0, 0, 0, 0, 0, 0.2582938615906143, 0.21567884759472045, 0.3754851500793228, 0.3541776430813759, 0, 0, 0.5779064665598193, 0.5779064665598193, 0, 0, 0, 0, 0, 0, 0, 0, 0.3435238895824022, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2582938615906143, 0.26894761508958775, 0.13044881960293253, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ],
  [//SACRED
    -0.25, 0.98, 0, 0, 0.21567884759472045, 0.1943713405967733, 0.5, 0.5, 0.5246376990649517, 0.5, 0, 0, 0, 0, 0.15, 0.15, 0, 0, 0, 0, 0, 0, 0, 0, 0.3435238895824022, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2582938615906143, 0.26894761508958775, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ],
  [//DISGUSTED
    -0.96, 0.23, 0, 0, 0, 0, 0.42875391757419035, 0.49267643856803134, 0, 0, 0, 0, 0, 0, 0, 0, 0.23698635459266737, 0.15175632660087945, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.21567884759472045, 0, 0, 0.3104116803737398, 0.3541776430813759, 0, 0, 0.7, 0.7, 0, 0, 0, 0.4713689315700842, 0.3435238895824022
    ],
    [//CONTEMPT
      -0.98, -0.21, 0.1, 0.1, 0, 0, 0, 0, 0, 0, 0.24764010809164083, 0.26894761508958775, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.4981226368365037, 0, 0, 0, 0, 0, 0, 0, 0.10914131260498539, 0, 0, 0, 0, 0, 0, 0, 0
    ],
    [//NEUTRAL
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]
]

FacialExpr.prototype._p  = vec3.create();
FacialExpr.prototype._pA = vec3.create();


FacialExpr.prototype.lexemes = {LIP_CORNER_DEPRESSOR :0,
                                LIP_CORNER_DEPRESSOR_LEFT: 0,
                                LIP_CORNER_DEPRESSOR_RIGHT: 0,
                                LIP_CORNER_PULLER: 0,
                                LIP_CORNER_PULLER_LEFT: 0,
                                LIP_CORNER_PULLER_RIGHT: 0,
                                                                MOUTH_OPEN: 0,
                                LOWER_LIP_DEPRESSOR: 0,
                                CHIN_RAISER: 0,
                                LIP_PUCKERER: 0,
                                TONGUE_SHOW: 0,
                                LIP_STRECHER: 0,
                                LIP_FUNNELER: 0,
                                LIP_TIGHTENER: 0,
                                LIP_PRESSOR: 0,
                                BROW_LOWERER: 0,
                                BROW_LOWERER_LEFT: 0,
                                LOWER_RIGHT_BROW: 0,
                                LOWER_LEFT_BROW: 0,
                                INNER_BROW_RAISER: 0,
                                OUTER_BROW_RAISER: 0,
                                RAISE_LEFT_BROW: 0,
                                RAISE_RIGHT_BROW:0,
                                UPPER_LID_RAISER: 0,
                                LID_TIGHTENER: 0,
                                EYES_CLOSED: 0,
                                BLINK: 0,
                                WINK: 0,
                                NOSE_WRINKLER: 0,
                                UPPER_LIP_RAISER: 0,
                                DIMPLER: 0,
                                JAW_DROP: 0,
                                MOUTH_STRETCH: 0};


// Blend shapes indices
FacialExpr.prototype.LIP_CORNER_DEPRESSOR = "14&15"; // AU15 sad
FacialExpr.prototype.LIP_CORNER_DEPRESSOR_LEFT = "14"; // LAU15 sad
FacialExpr.prototype.LIP_CORNER_DEPRESSOR_RIGHT = "15"; // RAU15 sad

FacialExpr.prototype.LIP_CORNER_PULLER = "41&42"; // AU12 happy
FacialExpr.prototype.LIP_CORNER_PULLER_LEFT = "41"; // LAU12 happy
FacialExpr.prototype.LIP_CORNER_PULLER_RIGHT = "42"; // RAU12 happy
//FacialExpr.prototype.OPEN_LIPS = 2; // kiss? or small open jaw?
FacialExpr.prototype.PRESS_LIPS = "14&15&32"; // lips pressed
FacialExpr.prototype.MOUTH_OPEN = "35"; // jaw
FacialExpr.prototype.LOWER_LIP_DEPRESSOR = "26&27"; // AU16
FacialExpr.prototype.CHIN_RAISER = "36"; // AU17 mouth up
FacialExpr.prototype.LIP_PUCKERER = "33&34"; // AU18 mouth narrow
FacialExpr.prototype.TONGUE_SHOW = "45"; // AU19
FacialExpr.prototype.LIP_STRECHER = "14&15&32"; // AU20
FacialExpr.prototype.LIP_FUNNELER = "37&38"; // AU22
FacialExpr.prototype.LIP_TIGHTENER = "30&31"; // AU23
FacialExpr.prototype.LIP_PRESSOR = "25&28&46"; // AU24

FacialExpr.prototype.BROW_LOWERER = "2&3&4&5"; // AU4 
FacialExpr.prototype.BROW_LOWERER_LEFT = "2&4"; // 
FacialExpr.prototype.LOWER_RIGHT_BROW = "3"; // brows down
FacialExpr.prototype.LOWER_BROWS = "4&5";

FacialExpr.prototype.INNER_BROW_RAISER = "6&7"; // AU1 rows rotate outwards
FacialExpr.prototype.OUTER_BROW_RAISER = "8&9"; // AU2 brows up (right)
FacialExpr.prototype.RAISE_LEFT_BROW = "8"; // left brow up
FacialExpr.prototype.RAISE_RIGHT_BROW = "9"; // right brow up
FacialExpr.prototype.RAISE_BROWS =  "8&9"; //  brow up

FacialExpr.prototype.UPPER_LID_RAISER = "12&13"; // AU5 negative eyelids closed /wide eyes
FacialExpr.prototype.CHEEK_RAISER = "43&44"; // AU6 squint
FacialExpr.prototype.LID_TIGHTENER = "43&44"; // AU44 squint
FacialExpr.prototype.EYES_CLOSED = "0&1"; // AU43 eyelids closed
FacialExpr.prototype.BLINK = "0&1"; // AU45 eyelids closed
FacialExpr.prototype.WINK = "0"; // AU46   

FacialExpr.prototype.NOSE_WRINKLER = "39&40"; // AU9
FacialExpr.prototype.UPPER_LIP_RAISER = "48&49"; // AU10
FacialExpr.prototype.DIMPLER = "-43&-44&25"; // AU14
FacialExpr.prototype.DIMPLER_LEFT = "-43&25"; // LAU14
FacialExpr.prototype.DIMPLER_RIGHT = "-44&25"; // RAU14
FacialExpr.prototype.JAW_DROP = "22"; // AU26
FacialExpr.prototype.MOUTH_STRETCH = "35"; // AU27

/*FacialExpr.prototype.AUs = {
  
8	Lips toward each other	orbicularis oris

11	Nasolabial deepener	zygomaticus minor

13	Sharp lip puller	levator anguli oris (also known as caninus)


21	Neck tightener	platysma


25	Lips part	depressor labii inferioris, or relaxation of mentalis or orbicularis oris
28	Lip suck
};*/

// Constructor
function FacialExpr (faceData, shift, sceneBSW){
  
  // Scene variables
  if (sceneBSW)
    this.sceneBSW = sceneBSW;

  // Init face valaro
  if (faceData.valaro){
    this.initFaceValAro(faceData, shift);
    return;
  }
  else if(faceData.emotion){
    switch(faceData.emotion)
    {
      case "ANGER":        
        faceData.valaro = this._pit[0].slice(0,2);
        break;
      case "HAPPINESS":
        faceData.valaro = this._pit[1].slice(0,2);
        break;
      case "SADNESS":
        faceData.valaro = this._pit[2].slice(0,2);   
        break;
      case "SURPRISE":
        faceData.valaro = this._pit[3].slice(0,2);
        break;
      case "FEAR":
        faceData.valaro = this._pit[4].slice(0,2);
        break;
      case "DISGUST":
        faceData.valaro = this._pit[5].slice(0,2);
        break;
      case "CONTEMPT":
        faceData.valaro = this._pit[6].slice(0,2);
        break;
      case "NEUTRAL":        
        faceData.valaro = this._pit[7].slice(0,2);
        
        break;
    }
    this.initFaceValAro(faceData, shift);
    return;
  }

  // Init face lexemes 
  if (faceData.lexeme){
    // faceLexeme
    if (typeof(faceData.lexeme) == "string") //(lexeme = "STRING")
      this.initFaceLexeme(faceData, shift, [faceData])
    // One lexeme object inside face/faceShift (faceData.lexeme = {lexeme:"RAISE_BROWS"; amount: 0.1})
    else if (typeof(faceData.lexeme) == "object" && faceData.lexeme.length === undefined)
      this.initFaceLexeme(faceData, shift,  [faceData.lexeme]);
    // Several lexemes inside face/faceShift (faceData.lexeme = [{}, {}]...)
    else if (typeof(faceData.lexeme) == "object" && faceData.lexeme.length !== undefined)
      this.initFaceLexeme(faceData, shift, faceData.lexeme);
        
    return;
  }
  


}


FacialExpr.prototype.initFaceValAro = function(faceData, shift){
  // Sync
  this.start = faceData.start || 0.0;
  this.end = faceData.end;
  
  if (!shift){
    this.attackPeak = faceData.attackPeak || (this.end-this.start)*0.25 + this.start;
    this.relax = faceData.relax || (this.end - this.attackPeak)/2 + this.attackPeak;
  } else {
    this.attackPeak = faceData.attackPeak || this.end;
    this.end = 0.0//faceData.end || faceData.attackPeak || 0.0;
    
    this.relax = 0;
  }

  // Valence and arousal
  this.valaro = faceData.valaro || [0.1, 0.1];
  // Normalize
  var magn = vec2.length(this.valaro);
  if (magn > 1){
    this.valaro[0]/= magn;
    this.valaro[1]/= magn;
  }


  // Initial blend shapes
  /*if (this.sceneBSW[FacialExpr.BODY_NAME])
    for (var i = 0; i< this.sceneBSW[FacialExpr.BODY_NAME].length; i++){

      if(!this.initialVABSW.length) 
        this.initialVABSW.push(this.sceneBSW[FacialExpr.BODY_NAME][i]);
      else 
        this.initialVABSW[i] = this.sceneBSW[FacialExpr.BODY_NAME][i];
      if(!this.targetVABSW.length) 
        this.targetVABSW.push(this.sceneBSW[FacialExpr.BODY_NAME][i]);
      else this.targetVABSW[i] = this.sceneBSW[FacialExpr.BODY_NAME][i];
    }
    */  
  // Target blend shapes
  this.VA2BSW(this.valaro, this.targetVABSW);
  
  
  // Start
  this.transition = true;
  this.time = 0;

}
FacialExpr.BODY_NAME = "Body";
// There can be several facelexemes working at the same time then? lexemes is an array of lexeme objects
FacialExpr.prototype.initFaceAU = function(faceData, shift, lexemes){
  FacialExpr.BODY_NAME = this.sceneBSW["Body_SSS"] ? "Body_SSS" : "Body";
  // Sync
  this.start = faceData.start || 0.0;
  this.end = faceData.end;
  
  if (!shift){
    this.attackPeak = faceData.attackPeak || (this.end-this.start)*0.25 + this.start;
    this.relax = faceData.relax || (this.end - this.attackPeak)/2 + this.attackPeak;
  } else {
    this.end = faceData.end || faceData.attackPeak || 0.0;
    this.attackPeak = faceData.attackPeak || this.end;
    this.relax = 0;
  }

  // Initial blend shapes and targets
  if (this.sceneBSW){
    // Choose the ones to interpolate
    this.indicesLex = [];
    this.initialLexBSW = [];
    this.targetLexBSW = [];

    var j = 0;
    for (var i = 0; i<lexemes.length; i++){
      

      var index = this[lexemes[i].au]; // "this.RAISE_BROWS = 1" for example
      if(index == undefined)
      {	
        console.err("Lexeme not found")
          return;
      }
      index = index.split("&");
      // WIDEN_EYES correction
      if (lexemes[i].lexeme == "UPPER_LID_RAISER")
        lexemes[i].amount *= -0.3;
      
      // If lexeme string is not defined or wrong, do not add
      if (index !== undefined){
        // Indices
        this.indicesLex[j] = index;
        this.initialLexBSW[j] = [];
        this.targetLexBSW[j] = [];
        
        for(var idx in index)
        {
          // Initial
          var sign = 1;
          if(idx.includes("-"))
          {
            sign = -1;
            idx = idx.replace("-","");
          }
          this.initialLexBSW[j][idx] = this.sceneBSW[FacialExpr.BODY_NAME][index[idx]];
          // Target
          this.targetLexBSW[j][idx] = (lexemes[i].amount !== undefined) ? lexemes[i].amount*sign || faceData.amount*sign : 0;
        }
        

        j++;
      } else
        console.warn("Facial lexeme not found:", lexemes[i].lexeme, ". Please refer to the standard.");
    }
  }


  // Start
  this.transition = true;
  this.time = 0;

}

// There can be several facelexemes working at the same time then? lexemes is an array of lexeme objects
FacialExpr.prototype.initFaceLexeme = function(faceData, shift, lexemes){
  // Sync
  FacialExpr.BODY_NAME = this.sceneBSW["Body_SSS"] ? "Body_SSS" : "Body";
  this.start = faceData.start || 0.0;
  this.end = faceData.end;
  
  if (!shift){
    this.attackPeak = faceData.attackPeak || (this.end-this.start)*0.25 + this.start;
    this.relax = faceData.relax || (this.end - this.attackPeak)/2 + this.attackPeak;
  } else {
    this.end = faceData.end || faceData.attackPeak || 0.0;
    this.attackPeak = faceData.attackPeak || this.end;
    this.relax = 0;
  }

  // Initial blend shapes and targets
  if (this.sceneBSW){
    // Choose the ones to interpolate
    this.indicesLex = [];
    this.initialLexBSW = [];
    this.targetLexBSW = [];

    var j = 0;
    for (var i = 0; i<lexemes.length; i++){
      // To upper case
      lexemes[i].lexeme = stringToUpperCase(lexemes[i].lexeme, "Face lexeme", "NO_LEXEME");

      var index = this[lexemes[i].lexeme]; // "this.RAISE_BROWS = 1" for example
      if(index == undefined)
          debugger;
      index = index.split("&");
      // WIDEN_EYES correction
      if (lexemes[i].lexeme == "WIDEN_EYES")
        lexemes[i].amount *= -0.3;
      
      // If lexeme string is not defined or wrong, do not add
      if (index !== undefined){
        // Indices
        this.indicesLex[j] = index;
        this.initialLexBSW[j] = [];
        this.targetLexBSW[j] = [];
        
        for(var idx in index)
        {
          // Initial
          this.initialLexBSW[j][idx] = this.sceneBSW[FacialExpr.BODY_NAME][index[idx]];
            // Target
            this.targetLexBSW[j][idx] = (lexemes[i].amount !== undefined) ? lexemes[i].amount || faceData.amount : 0;
        }
        

        j++;
      } else
        console.warn("Facial lexeme not found:", lexemes[i].lexeme, ". Please refer to the standard.");
    }
  }


  // Start
  this.transition = true;
  this.time = 0;

}




FacialExpr.prototype.updateVABSW = function(interVABSW, dt){

  // Immediate change
  if (this.attackPeak == 0 && this.end == 0 && this.time == 0){
    /*for (var i = 0; i < this.indicesVA.length; i++)
    {*/
      //for(var j = 0; j < this.indicesVA[i].length; j++)
      
        //interVABSW[FacialExpr.BODY_NAME][this.indicesVA[i][j]] = this.targetVABSW[i][j];
    /*}*/
    for(var j in this.targetVABSW)
        interVABSW[FacialExpr.BODY_NAME][j] = this.targetVABSW[j];
    // Increase time and exit
    this.time +=dt;
    return;
  }
  // Immediate change (second iteration)
  if (this.attackPeak == 0 && this.end == 0){
    this.transition = false;
    return;
  }

  // Time increase
  this.time += dt;

  // Wait for to reach start time
  if (this.time < this.start)
    return;

  // Stay still during attackPeak to relax
  if (this.time > this.attackPeak && this.time < this.relax)
    return;
  
  var inter = 0;
  // Trans 1
  if (this.time < this.attackPeak){
    inter = (this.time-this.start)/(this.attackPeak-this.start);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;
    //inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5; // to increase curve, keep adding cosines
    // Interpolation
    /*for (var i = 0; i < this.indicesVA.length; i++)
    {
      for(var j = 0; j < this.indicesVA[i].length; j++)
        interVABSW[FacialExpr.BODY_NAME][this.indicesVA[i][j]] = this.initialVABSW[i][j]*(1-inter) + this.targetVABSW[i][j]*inter;
    }*/
    for(var j in this.targetVABSW)
        interVABSW[FacialExpr.BODY_NAME][j] = this.initialVABSW[j]*(1-inter) + this.targetVABSW[j]*inter;
  }
  
  // Trans 2
  if (this.time > this.relax && this.relax >= this.attackPeak){
    inter = (this.time-this.relax)/(this.end-this.relax);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter)*0.5 + 0.5;
    // Interpolation
    /*for (var i = 0; i < this.indicesVA.length; i++)
    {
      for(var j = 0; j < this.indicesVA[i].length; j++)
        interVABSW[FacialExpr.BODY_NAME][this.indicesVA[i][j]] = this.initialVABSW[i][j]*(1-inter) + this.targetVABSW[i][j]*inter;
    }*/
    for(var j in this.targetVABSW)
        interVABSW[FacialExpr.BODY_NAME][j] = this.initialVABSW[j]*(1-inter) + this.targetVABSW[j]*inter;
  }
  
  // End
  if (this.time > this.end)
    this.transition = false;

  
}




FacialExpr.prototype.updateLexemesBSW = function(interLexBSW, dt){

  // Immediate change
  if (this.attackPeak == 0 && this.end == 0 && this.time == 0){
    for (var i = 0; i < this.indicesLex.length; i++)
      for(var j = 0; j < this.indicesLex[i].length; j++)
        interLexBSW[this.indicesLex[i][j]] = this.targetLexBSW[i][j];
    
    // Increase time and exit
    this.time +=dt;
    return;
  }
  

  // Time increase
  this.time += dt;

  // Wait for to reach start time
  if (this.time < this.start)
    return;

  // Stay still during attackPeak to relax
  if (this.time > this.attackPeak && this.time < this.relax){
    for (var i = 0; i < this.indicesLex.length; i++)
    {
        for(var j = 0; j < this.indicesLex[i].length; j++)
          interLexBSW[FacialExpr.BODY_NAME][this.indicesLex[i][j]] = this.targetLexBSW[i][j];
    }
    return;
  }
  
  var inter = 0;
  // Trans 1
  if (this.time < this.attackPeak){
    inter = (this.time-this.start)/(this.attackPeak-this.start);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;
    //inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5; // to increase curve, keep adding cosines
    // Interpolation
    for (var i = 0; i < this.indicesLex.length; i++)
      for(var j = 0; j < this.indicesLex[i].length; j++)
              interLexBSW[FacialExpr.BODY_NAME][this.indicesLex[i][j]] = this.initialLexBSW[i][j]*(1-inter) + this.targetLexBSW[i][j]*inter;
    
  }

  
  // Trans 2
  if (this.time > this.relax && this.relax >= this.attackPeak){
    inter = (this.time-this.relax)/(this.end-this.relax);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter)*0.5 + 0.5;
    // Interpolation
    for (var i = 0; i < this.indicesLex.length; i++)
      for(var j = 0; j < this.indicesLex[i].length; j++)
          interLexBSW[FacialExpr.BODY_NAME][this.indicesLex[i][j]] = this.initialLexBSW[i][j]*(1-inter) + this.targetLexBSW[i][j]*inter;
    
  }
  
  
  // End
  if (this.time > this.end)
  {
    this.transition = false;
  }
}


FacialExpr.prototype.precomputeVAWeights = function(gridsize){
  var points = this.points;
  var num_points = points.length;
  var pos = vec2.create();
  var circular = true;
  this._values_changed = false;
  this._version++;
  
  var total_nums = 2 * gridsize * gridsize;
  if(!this._precomputed_weights || this._precomputed_weights.length != total_nums )
    this._precomputed_weights = new Float32Array( total_nums );
  var values = this._precomputed_weights;
  this._precomputed_weights_gridsize = gridsize;

  for(var y = 0; y < gridsize; ++y)
    for(var x = 0; x < gridsize; ++x)
    {
      var nearest = -1;
      var min_dist = 100000;
      for(var i = 0; i < num_points; ++i)
      {
        pos[0] = x / gridsize;
        pos[1] = y / gridsize;
        if(circular)
        {
          pos[0] = pos[0] * 2 - 1;
          pos[1] = pos[1] * 2 - 1;
        }

        var dist = vec2.distance( pos, points[i].pos );
        if( dist > min_dist )
          continue;
        nearest = i;
        min_dist = dist;
      }

      values[ x*2 + y*2*gridsize ] = nearest;
      values[ x*2 + y*2*gridsize + 1] = min_dist;
    }

  return values;
}



FacialExpr.prototype.VA2BSW = function(valAro, facialBSW){
  
  var maxDist = 0.8;
  var gridsize = 100;
  //var blendValues = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; // Memory leak, could use facialBSW and set to 0 with a for loop
  var bNumber = 18;
  var blendValues = [];
  blendValues.length = this._pit[0].length - 2;
  blendValues.fill(0);

  this._p[0] = valAro[0];
  this._p[1] = valAro[1];
  this._p[2] = 0; // why vec3, if z component is always 0, like pA?
  var pos = vec2.create();
  pos.set(valAro);
  this._pA[2] = 0;
  this.points = [];
  for (var count = 0; count < this._pit.length; count++){
    this._pA[0] = this._pit[count][0];
    this._pA[1] = this._pit[count][1];
    var point = vec2.create();
    point.set([this._pA[0], this._pA[1]]);
    this.points.push({pos: point})

    /*var dist = vec3.dist(this._pA, this._p);
    dist = maxDist - dist;

    // If the emotion (each row is an emotion in pit) is too far away from the act-eval point, discard
    if (dist > 0){
      for (var i = 0; i < bNumber-2; i++){
        blendValues[i] += this._pit[count][i+2] * dist;
      }
    }*/
  }
  //precompute VA points weight in the grid
  var values = this._precomputed_weights;
  if(!values || this._values_changed )
    values = this.precomputeVAWeights(gridsize);

  var pos2 = vec2.create();
  var circular = true;
  var weights = [];
  weights.length = this._pit.length;
  weights.fill(0);
  //weights = blendValues
  var total_inside = 0;
  for(var y = 0; y < gridsize; ++y)
    for(var x = 0; x < gridsize; ++x)
    {
      pos2[0] = x / gridsize;
      pos2[1] = y / gridsize;
      if(circular)
      {
        pos2[0] = pos2[0] * 2 - 1;
        pos2[1] = pos2[1] * 2 - 1;
      }
      var data_pos = x*2 + y * gridsize*2;
      var point_index = values[ data_pos ];
      var is_inside = vec2.distance( pos2, pos ) < (values[ data_pos + 1] + 0.001); //epsilon
      if(is_inside)
      {
        weights[ point_index ] += 1;
        total_inside++;
      }
    }
  for(var i = 0; i < weights.length; ++i)
  {
    weights[i] /= total_inside;
    for (var j = 0; j < blendValues.length; j++){
      blendValues[j] += this._pit[i][j+2] * weights[i];
    }
    //this.weights_obj[ this.points[i].name ] = weights[i];
  }
  this.initialVABSW = {};
  this.targetVABSW = {};

  for (var j = 0; j < blendValues.length; j++){
    this.initialVABSW[j] = this.sceneBSW[FacialExpr.BODY_NAME][j];
    this.targetVABSW[j] = blendValues[j];
  }
  /* this.indicesVA = [];
  this.initialVABSW = {};
  this.targetVABSW = {};
  var j = 0;
  for(var i=0; i< this.VALexemes.length; i++)
  {
    var index = this[this.VALexemes[i]].split("&");
  
    if (index !== undefined)
    {
      // Indices
      this.indicesVA[j] = index;
      /* this.initialVABSW[j] = {};
      this.targetVABSW[j] = [];*/
    /*  for(var idx in index)
      {
        // Initial
        var sign = 1;
        if(index[idx].includes("-"))
        {
          sign = -1;
          var ii = this.indicesVA.indexOf(idx);
          index[idx] = index[idx].replace("-","");
          this.indicesVA[j] = index[idx];
        }
        
        this.initialVABSW[index[idx]] = this.sceneBSW[FacialExpr.BODY_NAME][index[idx]];
        // Target
        if(this.targetVABSW[index[idx]]!=undefined)
          this.targetVABSW[index[idx]] += sign*blendValues[i];
        else
          this.targetVABSW[index[idx]] = sign*blendValues[i];
      }
    }
    j++
  }*/

}


FacialExpr.prototype.VA2BSW_old = function(valAro, facialBSW){
  
  maxDist = 0.8;

  var blendValues = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; // Memory leak, could use facialBSW and set to 0 with a for loop
  var bNumber = 18;
  
  this._p.x = valAro[0];
  this._p.y = valAro[1];
  this._p.z = 0; // why vec3, if z component is always 0, like pA?

  this._pA[2] = 0;
  
  for (var count = 0; count < this._pit.length; count++){
    this._pA.x = this._pit[count].x;
    this._pA.y = this._pit[count].y;


    var dist = this._pA.distanceTo(this._p);
    dist = maxDist - dist;

    // If the emotion (each row is an emotion in pit) is too far away from the act-eval point, discard
    if (dist > 0){
      for (var i = 0; i < bNumber-2; i++){
        blendValues[i] += this._pit[count][i+2] * dist;
      }
    }
  }

  this.indicesVA = [];
  this.initialVABSW = [];
  this.targetVABSW = [];
  var j = 0;
  for(var i=0; i< this.VALexemes.length; i++)
  {
    var index = this[this.VALexemes[i]].split("&");
  
    if (index !== undefined)
    {
      // Indices
      this.indicesVA[j] = index;
      this.initialVABSW[j] = [];
      this.targetVABSW[j] = [];
      for(var idx in index)
      {
        // Initial
        var sign = 1;
        if(idx.includes("-"))
        {
          sign = -1;
          var ii = this.indicesVA.indexOf(idx);
          idx = idx.replace("-","");
          this.indicesVA[ii] = idx;
        }
        this.initialVABSW[j][idx] = this.sceneBSW[FacialExpr.BODY_NAME][index[idx]];
        // Target
        this.targetVABSW[j][idx] = sign*blendValues[i];
      }
    }
    j++
  }
  //this.sceneBSW[FacialExpr.BODY_NAME][index[idx]]
  
/*
  index = this["LIP_CORNER_PULLER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[1];
        }
  }
  index = this["INNER_BROW_RAISER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[2];
        }
  }
  index = this["BROW_LOWERER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[3];
        }
  }
  index = this["DIMPLER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[4];
        }
  }
  index = this["OUTER_BROW_RAISER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[5];
        }
  }
  index = this["UPPER_LID_RAISER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[6];
        }
  }
  index = this["JAW_DROP"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[7];
        }
  }
  index = this["LID_TIGHTENER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[8];
        }
  }
  index = this["LIP_STRECHER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[9];
        }
  }
  index = this["NOSE_WRINKLER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[10];
        }
  }
  index = this["LIP_CORNER_DEPRESSOR"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[11];
        }
  }
  index = this["CHIN_RAISER"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[12];
        }
  }
  index = this["LIP_CORNER_PULLER_RIGHT"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[13];
        }
  }
  index = this["DIMPLER_RIGHT"].split("&");
  if (index !== undefined){
    for(var idx in index)
        {
          facialBSW[index[idx]] = blendValues[14];
        }
  }*/
  // Store blend values
  /*facialBSW [ 0 ] = blendValues[0]; // CHEEK_RAISER
  facialBSW [ 1 ] = blendValues[1]; // LIP_CORNER_PULLER
  facialBSW [ 2 ] = blendValues[2]; // INNER_BROW_RAISER
  facialBSW [ 3 ] = blendValues[3]; // BROW_LOWERER
  
  facialBSW [4]  = blendValues[4]; // DIMPLER

  facialBSW [5] = blendValues[5]; // OUTER_BROW_RAISER
  facialBSW [6] = blendValues[6]; // UPPER_LID_RAISER
  facialBSW [7] = blendValues[7]; // JAW_DROP
  facialBSW [8] = blendValues[8]; // LID_TIGHTENER
  facialBSW [9] = blendValues[9]; // LIP_STRECHER
  facialBSW [10] = blendValues[10]; // NOSE_WRINKLER
  facialBSW [11] = blendValues[11]; // LIP_CORNER_DEPRESSOR
  facialBSW [12] = blendValues[12]; // CHIN_RAISER
  facialBSW [13] = blendValues[13]; // LIP_CORNER_PULLER_RIGHT
  facialBSW [15] = blendValues[14]; // DIMPLER_RIGHT
*/
}





// --------------------- GAZE (AND HEAD SHIFT DIRECTION) ---------------------
// BML
// <gaze or gazeShift start ready* relax* end influence target offsetAngle offsetDirection>
// influence [EYES, HEAD, NECK, SHOULDER, WAIST, WHOLE, ...]
// offsetAngle relative to target
// offsetDirection (of offsetAngle) [RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT]
// target [CAMERA, RIGHT, LEFT, UP, DOWN, UPRIGHT, UPLEFT, DOWNLEFT, DOWNRIGHT]
// Scene inputs: gazePositions (head and camera), lookAt objects


// Gaze manager (replace BML)
GazeManager.prototype.gazePositions = {
  "RIGHT": [60, 125, 400], "LEFT": [-80, 125, 400],
  "UP": [-10, 200, 400], "DOWN": [-10, 105, 400],
  "UPRIGHT": [60, 200, 400], "UPLEFT": [-80, 200, 400],
  "DOWNRIGHT": [60, 105, 400], "DOWNLEFT": [-80, 105, 400],
  "CAMERA": [-10, 125, 400]
};
Gaze.prototype.gazeBS = {
  "RIGHT": {squint:0, eyelids:0}, "LEFT": {squint:0, eyelids:0},
  "UP": {squint:0.3, eyelids:0}, "DOWN": {squint:0, eyelids:0.5},
  "UPRIGHT": {squint:0.3, eyelids:0}, "UPLEFT": {squint:0.3, eyelids:0},
  "DOWNRIGHT": {squint:0, eyelids:0.5}, "DOWNLEFT": {squint:0, eyelids:0.5},
  "CAMERA": {squint:0, eyelids:0}, "EYESTARGET": {squint:0, eyelids:0}, "HEADTARGET": {squint:0, eyelids:0},"NECKTARGET": {squint:0, eyelids:0}
};

// Constructor (lookAt objects and gazePositions)
function GazeManager (lookAtNeck, lookAtHead, lookAtEyes, gazePositions){
  // Gaze Actions (could create here inital gazes and then recycle for memory efficiency)
  this.gazeActions = [3];

  // Gaze positions
  this.gazePositions = gazePositions || this.gazePositions;

  // LookAt objects
  this.lookAtNeck = lookAtNeck;
  this.lookAtHead = lookAtHead;
  this.lookAtEyes = lookAtEyes;
}

// gazeData with influence, sync attr, target, offsets...
GazeManager.prototype.newGaze = function(gazeData, shift, gazePositions, headOnly){

  // Gaze positions
  this.gazePositions = gazePositions || this.gazePositions;
  
  // Influence check, to upper case

  gazeData.influence = stringToUpperCase(gazeData.influence, "Gaze influence", "HEAD");

  
  // Overwrite gaze actions
  switch (gazeData.influence){
    case "NECK":
      this.gazeActions[2] = new Gaze(gazeData, shift, this.lookAtNeck, this.gazePositions);
    case "HEAD":
      this.gazeActions[1] = new Gaze(gazeData, shift, this.lookAtHead, this.gazePositions);
    case "EYES":
      if (!headOnly)
          this.gazeActions[0] = new Gaze(gazeData, shift, this.lookAtEyes, this.gazePositions);
    }
  

}

GazeManager.prototype.update = function(dt){
    
  // Gaze actions update
  for (var i = 0; i<this.gazeActions.length; i++)
  {
    /*var eyelidsW = 0;
      var squintW = 0;*/
    // If gaze exists (could inizialize empty gazes)
    if (this.gazeActions[i]){
      if (this.gazeActions[i].transition)
      {
        if(i==0 )//&& this.gazeActions[i].offsetDirection.includes("DOWN"))
          var eyes = true
        else
          var eyes = false
        
          this.gazeActions[i].update(dt, eyes);//update eyelids weight!!!!!!!!!!
        var eyelidsW = this.gazeActions[i].eyelidsW;
        var squintW = this.gazeActions[i].squintW;
        var blinkW = this.gazeActions[i].blinkW;
      }
    }
    }
  return {eyelids:eyelidsW, squint: squintW};
}







// Memory allocation
Gaze.prototype._tempV = new THREE.Vector3();
Gaze.prototype._tempQ = new THREE.Quaternion();
Gaze.prototype.targetP = new THREE.Vector3();


// --------------------- GAZE (AND HEAD SHIFT DIRECTION) ---------------------
// Constructor
function Gaze (gazeData, shift, lookAt, gazePositions){

  // Init gazeData
  this.initGazeData(gazeData, shift);

  // Gaze positions
  if (gazePositions)
      this.gazePositions = gazePositions;

  // Scene variables
  this.cameraEye = gazePositions["CAMERA"] || new THREE.Vector3();
  this.headPos = gazePositions["HEAD"] || new THREE.Vector3();
  this.lookAt = lookAt;
  
  this.eyelidsFinW = 0;
  //this.lookAtNeck = lookAtNeck;
  //this.lookAtHead = lookAtHead;
  //this.lookAtEyes = lookAtEyes;
  
}




Gaze.prototype.initGazeData = function(gazeData, shift){
  
  this.eyelidsW = gazeData.eyelidsWeight|| 0;
  this.eyelidsInitW = gazeData.eyelidsWeight|| 0;
  this.squintW = gazeData.squintWeight|| 0;
  this.squintInitW = gazeData.squintWeight|| 0;
  this.squintFinW = gazeData.squintWeight|| 0;
  this.blinkW = gazeData.eyelidsWeight|| 0;
  this.blinkInitW = gazeData.eyelidsWeight|| 0;
  this.blinkFinW = gazeData.eyelidsWeight|| 0;
  // Sync
  this.start = gazeData.start || 0.0;
  this.end = gazeData.end || 2.0;
  if (!shift){
    this.ready = gazeData.ready || this.start + (this.end - this.start)/3;
    this.relax = gazeData.relax || this.start + 2*(this.end - this.start)/3;
  } else {
    this.ready = this.end;
    this.relax = 0;
  }
  
  
  // Offset direction
  this.offsetDirection =stringToUpperCase(gazeData.offsetDirection, "Gaze offsetDirection", "RIGHT");
    
  // Target
      this.target = stringToUpperCase(gazeData.target, "Gaze target", "CAMERA");
  if (this.target == "FRONT") this.target = "CAMERA";
  
  // Angle
  this.offsetAngle = gazeData.offsetAngle || 0.0;
  
  // Start
  this.transition = true;
  this.time = 0;
  

  // Extension - Dynamic
  this.dynamic = gazeData.dynamic || false;

}





Gaze.prototype.update = function(dt , atEyes){
  
  // Define initial values
  if (this.time == 0)
    this.initGazeValues(atEyes);
  
  // Time increase
  this.time +=dt;
  // Wait for to reach start time
  if (this.time < this.start)
    return;
  // Stay still during ready to relax
  if (this.time > this.ready && this.time < this.relax)
    return;
  
  // Extension - Dynamic (offsets do not work here)
  if (this.dynamic){
    this.EndP.copy(this.gazePositions[this.target]);
    //console.log(this.gazePositions[this.target]);
  }
  
  //console.log(this.influence, this.neckInP, this.neckEndP, this.headInP, this.headEndP, this.eyesInP, this.eyesEndP);
  var inter = 0;
  // Trans 1
  if (this.time < this.ready){
    inter = (this.time-this.start)/(this.ready-this.start);

    
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;
    
    if(atEyes)
    {
      this.eyelidsW =this.eyelidsInitW*(1-inter)+this.eyelidsFinW*(inter); 
      this.squintW =this.squintInitW*(1-inter)+this.squintFinW*(inter); 
      
    }
    // inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5; // to increase curve, keep adding cosines
    // lookAt pos change
    this.InP.lerp(this.EndP, inter);
    this.lookAt.position.copy( this.InP)

    this.lookAt.mustUpdate = true;
  }
  
  // Trans 2
  if (this.time > this.relax && this.relax >= this.ready){
    inter = 1 - (this.time-this.relax)/(this.end-this.relax);

    // Cosine interpolation
    inter = Math.cos(Math.PI*inter + Math.PI)*0.5 + 0.5;
    if(atEyes)
    {
      
      this.eyelidsW =this.eyelidsInitW*(1-inter)+this.eyelidsFinW*(inter); 
      this.squintW =this.squintInitW*(1-inter)+this.squintFinW*(inter); 
      
    }
    // lookAt pos change
    //vec3.lerp( this.lookAt.transform.position , this.InP, this.EndP, inter);
    this.InP.lerp(this.EndP, inter);
    this.lookAt.position.copy(this.InP)

    this.lookAt.mustUpdate = true;

  }
  
    //console.log(this.eyelidsW)

  // End
  if (this.time > this.end){
    /*if(atEyes)
    {
      
        this.eyelidsW =this.eyelidsInitW*(inter)+this.eyelidsFinW*(1-inter); 
      this.squintW =this.squintInitW*(inter)+this.squintFinW*(1-inter); 
      this.blinkW =this.blinkInitW*(inter)+this.blinkFinW*(1-inter); 
    }*/
    if(!this.dynamic)
        this.transition = false;
    // Extension - Dynamic
    else{
        this.lookAt.position.copy( this.EndP); 
    }
  }
    
  
  
  
  
}


Gaze.prototype.initGazeValues = function(isEyes){
  
  
  // Find target position (copy? for following object? if following object and offsetangle, need to recalculate all the time!)
  if (this.gazePositions)
    if (this.gazePositions[this.target]){
      if(this.target == "CAMERA")
      {
        // this.gazePositions[this.target][0]-=2;
        var pos = new THREE.Vector3();
        pos.copy(this.gazePositions[this.target])
       // pos.x = 400;
        if(this.influence == "HEAD" && this.target == "CAMERA"){
          pos.x -= pos.x 
        }
       /* if(isEyes)
          pos.y += 5;
        else
          pos.y -= 8;*/
      }
      this.targetP.copy(this.gazePositions[this.target]);
    }else
      this.targetP.set(0, 110, 400);
  else
    this.targetP.set(0, 110, 400);
  
  
  // Angle offset
  // Define offset angles (respective to head position?)
  // Move to origin
  var v = this._tempV;
  var q = this._tempQ;
  var v = this.targetP.sub(this.headPos);
  var magn = v.length();
  v.normalize();
  this.eyelidsFinW = this.gazeBS[this.target].eyelids;
  this.squintFinW = this.gazeBS[this.target].squint;
  // Rotate vector and reposition
  switch (this.offsetDirection){
    case "UPRIGHT":
     /* quat.setAxisAngle(q, v, -25*DEG2RAD);//quat.setAxisAngle(q, v, -45*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);*/
      q.setFromAxisAngle(v, -25*DEG2RAD);
      v.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), this.offsetAngle*DEG2RAD);
      v.applyQuaternion(q);

      if(isEyes)
      {
          this.squintFinW*=Math.abs(this.offsetAngle/30)
      }
      break;
    case "UPLEFT":
      /*quat.setAxisAngle(q, v, -75*DEG2RAD);//quat.setAxisAngle(q, v, -135*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);*/
      q.setFromAxisAngle(v, -75*DEG2RAD);
      v.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), this.offsetAngle*DEG2RAD);
      v.applyQuaternion(q);
      if(isEyes)
      {

        this.squintFinW*=Math.abs(this.offsetAngle/30)
      }
      break;
    case "DOWNRIGHT":
     /* quat.setAxisAngle(q, v, 25*DEG2RAD);//quat.setAxisAngle(q, v, 45*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);*/
      q.setFromAxisAngle(v, -25*DEG2RAD);
      v.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), this.offsetAngle*DEG2RAD);
      v.applyQuaternion(q);
      if(isEyes)
      {
        this.eyelidsFinW*=Math.abs(this.offsetAngle/30)
      }
      
      break;
    case "DOWNLEFT":
     /* quat.setAxisAngle(q, v, 75*DEG2RAD);//quat.setAxisAngle(q, v, 135*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);*/
      q.setFromAxisAngle(v, 75*DEG2RAD);
      v.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), this.offsetAngle*DEG2RAD);
      v.applyQuaternion(q);
      if(isEyes)
      {
        this.eyelidsFinW*=Math.abs(this.offsetAngle/30)
      }
      break; 
    case "RIGHT":
      //vec3.rotateY(v,v,this.offsetAngle*DEG2RAD);
      v.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), this.offsetAngle*DEG2RAD);
      /*if(isEyes)
      {
        this.eyelidsFinW = 0
        this.squintFinW = 0
      }*/
      break;
    case "LEFT":
      //vec3.rotateY(v,v,-this.offsetAngle*DEG2RAD);
      v.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), -this.offsetAngle*DEG2RAD);
      /*if(isEyes)
      {
        this.eyelidsFinW = 0
        this.squintFinW = 0
      }*/
      break;
    case "UP":
      /*quat.setAxisAngle(q, v, -45*DEG2RAD);//quat.setAxisAngle(q, v, -90*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);*/
      q.setFromAxisAngle(v, -45*DEG2RAD);
      v.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), this.offsetAngle*DEG2RAD);
      v.applyQuaternion(q);
      if(isEyes)
      {
        //this.eyelidsFinW = 0
        this.squintFinW*=Math.abs(this.offsetAngle/30)
      }
      break;
    case "DOWN":
     /* quat.setAxisAngle(q, v, 45*DEG2RAD);//quat.setAxisAngle(q, v, 90*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);*/
      q.setFromAxisAngle(v, 45*DEG2RAD);
      v.applyAxisAngle(new THREE.Vector3( 0, 1, 0 ), this.offsetAngle*DEG2RAD);
      v.applyQuaternion(q);
      if(isEyes)
      {
  
        this.eyelidsFinW*=Math.abs(this.offsetAngle/30)
      }
      break;
  }
  // Move to head position and save modified target position

  /*vec3.scale(v,v,magn);
  vec3.add(v,v,this.headPos);
  vec3.copy(this.targetP,v);*/
  v.addScaledVector(v,magn);
  v.addVectors(v,this.headPos);
  this.targetP.copy(v)

  if (!this.lookAt || !this.lookAt.position)
    return console.log("ERROR: lookAt not defined ", this.lookAt);
  
  // Define initial and end positions
  this.InP = this.lookAt.position.clone();
  this.EndP =  this.targetP.clone(); // why copy? targetP shared with several?
  
}

// --------------------- HEAD ---------------------
// BML
// <head start ready strokeStart stroke strokeEnd relax end lexeme repetition amount>
// lexeme [NOD, SHAKE, TILT]
// repetition cancels stroke attr
// amount how intense is the head nod? 0 to 1

// head nods will go slightly up -> position = ready&stroke_start and  stroke_end&relax
// Should work together with gaze. Check how far is from the top-bottom angle limits or right-left angle limits
// Scene inputs: head bone node, neutral rotation and lookAtComponent rotation
// Combination of gaze and lookAtComponent:
//if (this.headBML.transition){
//  this._lookAtHeadComponent.applyRotation = false;
//  this.headBML.update(dt);
//} else
//  this._lookAtHeadComponent.applyRotation = true;


// Constructor
// headNode is to combine gaze rotations and head behavior
function HeadBML(headData, headNode, neutralRotation, lookAtRot, limVert, limHor){

  
  // Rotation limits (from lookAt component for example)
  this.limVert = Math.abs(limVert) || 20;
  this.limHor = Math.abs(limHor) || 30;
  
  // Init variables
  this.initHeadData(headData);

  // Scene variables
  this.headNode = headNode;
  this.neutralRotation = neutralRotation;
  this.lookAtRot = lookAtRot;
  
}


// Init variables
HeadBML.prototype.initHeadData = function(headData){
  
  headData.lexeme = stringToUpperCase(headData.lexeme, "Head lexeme", "NOD");
  
  // Lexeme, repetition and amount
    this.lexeme = headData.lexeme || "NOD";
    this.amount = headData.amount || 0.2;

    // Maximum rotation amplitude
  if (this.lexeme == "NOD")
        this.maxDeg = this.limVert * 2;
  else
    this.maxDeg = this.limHor * 2;



    // Sync start ready strokeStart stroke strokeEnd relax end
    this.start = headData.start || 0;
    this.end = headData.end || 2.0;


    this.ready = headData.ready || this.strokeStart || (this.stroke-this.start)/2 || this.end/4;

    this.strokeStart = headData.strokeStart || this.ready;

    // No repetition
    if (!headData.repetition){
        this.stroke = headData.stroke || (this.strokeStart + this.strokeEnd)/2 || this.end/2;
        this.strokeEnd = headData.strokeEnd || headData.relax || (this.stroke + this.end)/2 || this.end*3/4;
        this.relax = headData.relax || this.strokeEnd;
    }
    // Repetition (stroke and strokeEnd will be redefined when updating)
    else {
        this.strokeEnd = headData.strokeEnd || headData.relax || this.end*3/4;
        this.relax = headData.relax || this.strokeEnd;
        // Repetition count
        this.repetition = headData.repetition;
        this.repeatedIndx = 0;
        
        // Modify stroke and strokeEnd
        this.strokeEnd = this.strokeStart + (this.strokeEnd - this.strokeStart)/(1 + this.repetition)
        this.stroke = (this.strokeStart + this.strokeEnd)/2;
    }



    // Start
    this.transition = true;
    this.phase = 0;
    this.time = 0;

}

HeadBML.prototype.update = function (dt){
  
  this.headNode.mustUpdate = true;
  
  // Define initial values
  if (this.time == 0){
        this.initHeadValues();
    //this.headNode.getComponent("Target").enabled = false;
  }
  
    // Time increase
  this.time +=dt;
  var headRotation = this.headNode.quaternion.clone();
  var inter = 0;
  // Wait for to reach start time
  if (this.time < this.start)
      return;

  // Ready
  else if (this.time < this.ready)
  {
    inter = (this.time-this.start)/(this.ready-this.start);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;

    // Should store previous rotation applied, so it is not additive
    if (!this.prevDeg)
      this.prevDeg = 0;
    var angle = inter*this.readyDeg - this.prevDeg;
    this.prevDeg = inter*this.readyDeg;
    // Apply rotation
    if (this.lexeme == "NOD")
      headRotation.setFromAxisAngle ( new THREE.Vector3(1,0,0),  -angle*DEG2RAD );
        //this.lookAtRot.transform.position[1]-=angle;
    
     // quat.rotateX(headRotation, headRotation,  -angle*DEG2RAD); // neg is up?
    else if (this.lexeme == "SHAKE")
      headRotation.setFromAxisAngle ( new THREE.Vector3(0,1,0),  -angle*DEG2RAD );
      //this.lookAtRot.transform.position[0]-=angle;
      //quat.rotateX(headRotation, headRotation,  -
      //quat.rotateY(headRotation, headRotation,  -angle*DEG2RAD);
     
    else if (this.lexeme == "TILT")
      headRotation.setFromAxisAngle ( new THREE.Vector3(0,0,1),  -angle*DEG2RAD );
      //quat.rotateZ(headRotation, headRotation,  -angle*DEG2RAD);
      headRotation.multiply(this.lookAtRot)
  }

  // StrokeStart
  else if (this.time > this.ready && this.time < this.strokeStart)
      return;
  

  // Stroke (phase 1)
  else if (this.time > this.strokeStart && this.time < this.stroke){
   
    inter = (this.time-this.strokeStart)/(this.stroke-this.strokeStart);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;

    // Should store previous rotation applied, so it is not additive
    if (this.phase == 0){
      this.prevDeg = 0;
      this.phase = 1;
    }

    var angle = inter*this.strokeDeg - this.prevDeg;
    this.prevDeg = inter*this.strokeDeg;
    // Apply rotation
    if (this.lexeme == "NOD")
      headRotation.setFromAxisAngle( new THREE.Vector3(1,0,0), angle*DEG2RAD);
        //this.lookAtRot.transform.position[1]+=angle;
       // headRotation.rotateX( headRotation,  angle*DEG2RAD); // neg is up?
       
    else if (this.lexeme == "SHAKE")
      headRotation.setFromAxisAngle( new THREE.Vector3(0,1,0), angle*DEG2RAD);
      //this.lookAtRot.transform.position[0]+=angle;
      //headRotation.rotateY( headRotation,  angle*DEG2RAD);
    else if (this.lexeme == "TILT")
      headRotation.setFromAxisAngle( new THREE.Vector3(0,0,1), angle*DEG2RAD);
      //headRotation.rotateZ(headRotation,  angle*DEG2RAD);
      headRotation.multiply(this.lookAtRot)
  }


  // Stroke (phase 2)
  else if (this.time > this.stroke && this.time < this.strokeEnd)
  {
    inter = (this.time-this.stroke)/(this.strokeEnd-this.stroke);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;

    // Should store previous rotation applied, so it is not additive
    if (this.phase == 1){
      this.prevDeg = 0;
      this.phase = 2;
    }

    var angle = inter*this.strokeDeg - this.prevDeg;
    this.prevDeg = inter*this.strokeDeg;
    // Apply rotation
    if (this.lexeme == "NOD")
      headRotation.setFromAxisAngle( new THREE.Vector3(1,0,0), -angle*DEG2RAD);
        //this.lookAtRot.transform.position[1]-=angle;
      //headRotation.rotateX( headRotation,  -angle*DEG2RAD); // neg is up?
    else if (this.lexeme == "SHAKE")
      headRotation.setFromAxisAngle( new THREE.Vector3(0,1,0), -angle*DEG2RAD);
    //this.lookAtRot.transform.position[0]-=angle;
      //headRotation.rotateY( headRotation,  -angle*DEG2RAD);
    else if (this.lexeme == "TILT")
      headRotation.setFromAxisAngle( new THREE.Vector3(0,0,1), -angle*DEG2RAD);
      //headRotation.rotateZ( headRotation,  -angle*DEG2RAD);
      headRotation.multiply(this.lookAtRot)
  }


  // Repetition -> Redefine strokeStart, stroke and strokeEnd
  else if (this.time > this.strokeEnd && this.repeatedIndx != this.repetition){
      this.repeatedIndx++;
      var timeRep = (this.strokeEnd - this.strokeStart);

      this.strokeStart = this.strokeEnd;
      this.strokeEnd += timeRep;
      this.stroke = (this.strokeEnd + this.strokeStart)/2;

      this.phase = 0;
      return;
  }


  // StrokeEnd (no repetition)
  else if (this.time > this.strokeEnd && this.time < this.relax)
  {
    //this.headNode.getComponent("Target").enabled = true;
        return;
  }
    


  // Relax -> Move towards lookAt final rotation
  else if (this.time > this.relax && this.time <= this.end){
    inter = (this.time-this.relax)/(this.end-this.relax);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;

    headRotation.slerp(this.lookAtRot, inter); // Why 0.1?
      // Should store previous rotation applied, so it is not additive
     /* if (this.phase == 2){
          this.prevDeg = 0;
          this.phase = 3;
      }

      var angle = inter*this.readyDeg - this.prevDeg;
      this.prevDeg = inter*this.readyDeg;*/
      // Apply rotation
      // Apply rotation
   /* if (this.lexeme == "NOD")
      headRotation.setFromAxisAngle( new THREE.Vector3(1,0,0), angle*DEG2RAD);
      
    else if (this.lexeme == "SHAKE")
      headRotation.setFromAxisAngle( new THREE.Vector3(0,1,0), angle*DEG2RAD);
    
    else if (this.lexeme == "TILT")
      headRotation.setFromAxisAngle( new THREE.Vector3(0,0,1), angle*DEG2RAD);
    */
  
  }

  // End
  else if (this.time > this.end)
  {
   
    this.transition = false
    return;
    //this.headNode.getComponent("Target").enabled = true;
  }    
  // Progressive lookAt effect
  /*inter = (this.time-this.start)/(this.end-this.start);
  // Cosine interpolation
  inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;
  headRotation.slerp( this.lookAtRot, inter*0.1);*/


  //this.headNode.applyQuaternion(headRotation);

  this.headNode.setRotationFromQuaternion(headRotation);

}


HeadBML.prototype.initHeadValues = function(){
    
    // Head initial rotation
    this.inQ = this.headNode.quaternion.clone();

    // Compare rotations to know which side to rotate
    // Amount of rotation
    var neutralInv = this.neutralRotation.clone().invert();
    var rotAmount = neutralInv.clone();
    rotAmount.multiply(this.inQ);
    var eulerRot = new THREE.Euler().setFromQuaternion( rotAmount );

    
    // X -> right(neg) left(pos)
    // Z -> up(neg) down(pos)

    // in here we choose which side to rotate and how much according to limits
    // the lookAt component should be stopped here (or set to not modify node, only final lookAt quat output)

    // NOD
  if (this.lexeme == "NOD"){
    // nod will always be downwards

    // a final quaternion slerping between initial rotation and final rotation (with lookAt)
        // apply directly to the slerp lookAt. limits will be passed, but it doesn't make sense that the head looks downward when making a nod? Maybe add hard limits? or something similar?
  
    // get ready/strokeStart position
    this.strokeDeg = this.amount * this.maxDeg;
    // Define rot init
    //this.readyDeg = Math.abs(Math.log10(this.amount*10)) * this.maxDeg * 0.2; // 20% of rotation approx
      this.readyDeg = this.strokeDeg * 0.2;
    
    // If the stroke rotation passes the limit, change readyDeg
    if (eulerRot.z*RAD2DEG + this.strokeDeg > this.limVert)
      this.readyDeg = this.strokeDeg - this.limVert + eulerRot.z*RAD2DEG;
  }
  // SHAKE
  else if (this.lexeme == "SHAKE"){
    // Define ready/strokeStart position
    this.strokeDeg = this.amount * this.maxDeg;
    //this.readyDeg = Math.abs(Math.log10(this.amount*10)) * this.maxDeg * 0.3;
    this.readyDeg = this.strokeDeg * 0.2;
    
    // Sign (left rigth)
    this.RorL = Math.sign(eulerRot.y)? Math.sign(eulerRot.y) : 1;
    this.readyDeg *= -this.RorL;
    this.strokeDeg *= -this.RorL;
  }
  // TILT?
  else if (this.lexeme == "TILT"){
    this.strokeDeg = this.amount * 20;
    //this.readyDeg = Math.abs(Math.log10(this.amount*10)) * 10 * 0.3;
    this.readyDeg = this.strokeDeg * 0.2;
  }
  
}
// Turn to upper case and error check
var stringToUpperCase = function(item, textItem, def){
  // To upper case
  if (Object.prototype.toString.call(item) === '[object String]')
    return item.toUpperCase();
  else{ // No string
    //console.warn(textItem + " not defined properly.", item);
    return def;
  }
}

function GestureManager(poser)
{
  this.poser = poser;
  
}
GestureManager.prototype.newGesture = function(gestureData)
{
  this.initGestureData(gestureData);
  
}
// Init variables
GestureManager.prototype.initGestureData = function(gestureData){
  
  this.lexeme = gestureData.lexeme.toLowerCase();
  this.gesture= this.poser._poses_by_name[this.lexeme];
  
  // Lexeme, repetition and amount
  this.amount = gestureData.amount || 0.5;

    // Maximum weight
  this.maxW = 1;
  this.minW = 0;
  // Sync start ready strokeStart stroke strokeEnd relax end
  this.start = gestureData.start || 0;
  this.end = gestureData.end || 2.0;


  this.ready = gestureData.ready || this.strokeStart || (this.stroke-this.start)/2 || this.end/4;

  this.strokeStart = gestureData.strokeStart || this.ready;

  // No repetition
  if (!gestureData.repetition){
      this.stroke = gestureData.stroke || (this.strokeStart + this.strokeEnd)/2 || this.end/2;
      this.strokeEnd = gestureData.strokeEnd || gestureData.relax || (this.stroke + this.end)/2 || this.end*3/4;
      this.relax = gestureData.relax || this.strokeEnd;
  }
  // Repetition (stroke and strokeEnd will be redefined when updating)
  else {
      this.strokeEnd = gestureData.strokeEnd || gestureData.relax || this.end*3/4;
      this.relax = gestureData.relax || this.strokeEnd;
      // Repetition count
      this.repetition = gestureData.repetition;
      this.repeatedIndx = 0;
      
      // Modify stroke and strokeEnd
      this.strokeEnd = this.strokeStart + (this.strokeEnd - this.strokeStart)/(1 + this.repetition)
      this.stroke = (this.strokeStart + this.strokeEnd)/2;
  }



  // Start
  this.transition = true;
  this.phase = 0;
  this.time = 0;

}

GestureManager.prototype.update = function (dt){
  
  if(!this.gesture)
    return;
  // Define initial values
  /*  if (this.time == 0){
        this.initHeadValues();
  }*/
  this.time+=dt;
  var inter = 0;
  // Wait for to reach start time
  if (this.time < this.start)
    return;


  // Ready
  else if (this.time < this.ready){
    inter = (this.time-this.start)/(this.ready-this.start);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;

    this.gesture.weight = this.gesture.weight*(1-inter) + this.amount*inter;

  }

  // Stroke (phase 1)
  else if (this.time > this.strokeStart && this.time < this.stroke){
    inter = (this.time-this.strokeStart)/(this.stroke-this.strokeStart);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;

    // Should store previous rotation applied, so it is not additive
    this.gesture.weight = this.gesture.weight*(1-inter) + this.amount*inter;
  }


  // Stroke (phase 2)
  else if (this.time > this.stroke && this.time < this.strokeEnd){
    inter = (this.time-this.stroke)/(this.strokeEnd-this.stroke);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;

    this.gesture.weight = this.gesture.weight*(1-inter) - this.amount*inter;
  }


  // Repetition -> Redefine strokeStart, stroke and strokeEnd
  else if (this.time > this.strokeEnd && this.repeatedIndx != this.repetition){
    this.repeatedIndx++;
    var timeRep = (this.strokeEnd - this.strokeStart);

    this.strokeStart = this.strokeEnd;
    this.strokeEnd += timeRep;
    this.stroke = (this.strokeEnd + this.strokeStart)/2;

    this.phase = 0;
    return;
  }

  // StrokeEnd (no repetition)
  else if (this.time > this.strokeEnd && this.time < this.relax)
  {
    //this.headNode.getComponent("Target").enabled = true;
    
    return;
  }

  // Relax -> Move towards lookAt final rotation
  else if (this.time > this.relax && this.time < this.end){
    inter = (this.time-this.relax)/(this.end-this.relax);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;
    this.gesture.weight = this.gesture.weight*(1-inter) + this.amount*(inter);
  }

  // End
  else if (this.time > this.end)
  {
  // this.headNode.getComponent("Target").enabled = true;
    this.transition = false;
  }

  // Progressive lookAt effect
/*  inter = (this.time-this.start)/(this.end-this.start);
  // Cosine interpolation
  inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;
  this.gesture.weight = this.amount*inter;*/

}



// --------------------- LIPSYNC MODULE --------------------

// Switch to https if using this script
if (window.location.protocol != "https:")
    window.location.href = "https:" + window.location.href.substring(window.location.protocol.length);


// Audio context
if (!Lipsync.AContext)
Lipsync.AContext = new AudioContext();


// Audio sources


Lipsync.prototype.refFBins = [0, 500, 700,3000, 6000];


// Constructor
function Lipsync(threshold, smoothness, pitch) {

  // Freq analysis bins, energy and lipsync vectors
  this.energy = [0,0,0,0,0,0,0,0];
  this.BSW = [0,0,0]; //kiss,lipsClosed,jaw

  // Lipsync parameters
  this.threshold = threshold || 0.0;
  this.dynamics = 30;
  this.maxDB = -30;
  
  this.smoothness = smoothness || 0.6;
  this.pitch = pitch || 1;
  // Change freq bins according to pitch
  this.fBins = [];
  this.defineFBins(this.pitch);

  // Initialize buffers
  this.init();
  
  // Output .csv (debug)
  //this.outstr = "time, e0, e1, e2, e3, bs_kiss, bs_lips_closed, bs_jaw\n";

  this.working = false;
}





// Start mic input
Lipsync.prototype.start = function(URL){
  // Restart
  this.stopSample();
  
  thatLip = this;
  if (URL === undefined){
    /* navigator.getUserMedia({audio: true}, function(stream) {
      thatLip.stream = stream;
      thatLip.sample = thatLip.context.createMediaStreamSource(stream);
      thatLip.sample.connect(thatLip.analyser);
      console.log("Mic sampling rate:", thatLip.context.sampleRate);
      thatLip.analyser.disconnect();
      thatLip.gainNode.disconnect();
      thatLip.working = true;
    }, function(e){console.error("ERROR: get user media: ", e);});*/
    
  }
  else
    this.loadSample(URL);
  
}



Lipsync.prototype.loadSample = function(inURL){
  var URL = LS.RM.getFullURL (inURL);
  
  if (LGAudio.cached_audios[URL] && URL.indexOf("blob:") == -1) {
        this.stopSample();
        this.sample = Lipsync.AContext.createBufferSource();
        this.sample.buffer = LGAudio.cached_audios[URL];
        this.playSample();
  }
  else{
    
    var request = new XMLHttpRequest();
    request.open('GET', URL, true);
    request.responseType = 'arraybuffer';

    var that = this;
    request.onload = function(){
      that.context.decodeAudioData(request.response,
        function(buffer){
          LGAudio.cached_audios[URL] = buffer;
          that.stopSample();
          that.sample = Lipsync.AContext.createBufferSource();
          that.sample.buffer = buffer;
          console.log("Audio loaded");
          that.playSample();
        }, function(e){ console.log("Failed to load audio");});
    };

    request.send();
  }
}


Lipsync.prototype.playSample = function(){

  // Sample to analyzer
  this.sample.connect (this.analyser);
  // Analyzer to Gain
  this.analyser.connect(this.gainNode);
  // Gain to Hardware
  this.gainNode.connect(this.context.destination);
  // Volume
  this.gainNode.gain.value = 1;
  console.log("Sample rate: ", this.context.sampleRate);
  that = this;
  this.working = true;
  this.sample.onended = function(){that.working = false;};
  // start
  this.sample.start(0);
  //this.sample.loop = true;
  
  // Output stream (debug)
  //this.timeStart = thiscene.time;
  //this.outstr = "time, e0, e1, e2, e3, bs_kiss, bs_lips_closed, bs_jaw\n";
}







// Update lipsync weights
Lipsync.prototype.update = function(){
  
  if (!this.working)
    return;

  // FFT data
  if (!this.analyser){
    //if (this.gainNode){
      // Analyser
      this.analyser = this.context.createAnalyser();
      // FFT size
      this.analyser.fftSize = 1024;
      // FFT smoothing
      this.analyser.smoothingTimeConstant = this.smoothness;
      
    //}
    //else return;
  }
  
  // Short-term power spectrum
  this.analyser.getFloatFrequencyData(this.data);

  // Analyze energies
  this.binAnalysis();
  // Calculate lipsync blenshape weights
  this.lipAnalysis();

}



Lipsync.prototype.stop = function(dt){
  // Immediate stop
  if (dt === undefined){
    // Stop mic input
    this.stopSample();

    this.working = false;
  }
  // Delayed stop
  else {
    thatLip = this;
    setTimeout(thatLip.stop.bind(thatLip), dt*1000);
  }
}







// Define fBins
Lipsync.prototype.defineFBins = function(pitch){
  for (var i = 0; i<this.refFBins.length; i++)
      this.fBins[i] = this.refFBins[i] * pitch;
}


// Audio buffers and analysers
Lipsync.prototype.init = function(){

  var context = this.context = Lipsync.AContext;
  // Sound source
  this.sample = context.createBufferSource();
  // Gain Node
  this.gainNode = context.createGain();
  // Analyser
  this.analyser = context.createAnalyser();
  // FFT size
  this.analyser.fftSize = 1024;
  // FFT smoothing
  this.analyser.smoothingTimeConstant = this.smoothness;
  
  // FFT buffer
  this.data = new Float32Array(this.analyser.frequencyBinCount);

}


// Analyze energies
Lipsync.prototype.binAnalysis = function(){
  
  // Signal properties
  var nfft = this.analyser.frequencyBinCount;
  var fs = this.context.sampleRate;

  var fBins = this.fBins;
  var energy = this.energy;

  
  // Energy of bins
  for (var binInd = 0; binInd < fBins.length-1; binInd++){
    // Start and end of bin
    var indxIn = Math.round(fBins[binInd]*nfft/(fs/2));
    var indxEnd = Math.round(fBins[binInd+1]*nfft/(fs/2));

    // Sum of freq values
    energy[binInd] = 0;
    for (var i = indxIn; i<indxEnd; i++){
            // Power Spectogram
      //var value = Math.pow(10, this.data[i]/10);
      // Previous approach
      var value = 0.5+(this.data[i]+20)/140;
      if (value < 0) value = 0;
      energy[binInd] += value;
    }
    // Divide by number of sumples
    energy[binInd] /= (indxEnd-indxIn);
    // Logarithmic scale
    //energy[binInd] = 10*Math.log10(energy[binInd] + 1E-6);
    // Dynamic scaling
    //energy[binInd] = ( energy[binInd] - this.maxDB)/this.dynamics + 1 - this.threshold;
  }
}

// Calculate lipsyncBSW
Lipsync.prototype.lipAnalysis = function(){
  
  var energy = this.energy;

  if (energy !== undefined){
    
    
    var value = 0;
    

    // Kiss blend shape
    // When there is energy in the 1 and 2 bin, blend shape is 0
    value = (0.5 - (energy[2]))*2;
    if (energy[1]<0.2)
      value = value*(energy[1]*5)
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.BSW[0] = value;

    // Lips closed blend shape
    value = energy[3]*3;
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.BSW[1] = value;
    
    // Jaw blend shape
    value = energy[1]*0.8 - energy[3]*0.8;
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.BSW[2] = value;
    
    /*
    // Debug
    // outstr
    var timestamp = LS.GlobalScene.time -  this.timeStart;
    this.outstr+= timestamp.toFixed(4) + "," +
                              energy[0].toFixed(4) + "," + 
                              energy[1].toFixed(4) + "," + 
                              energy[2].toFixed(4) + "," +
                              energy[3].toFixed(4) + "," +
                              this.BSW[0].toFixed(4) + "," + 
                        this.BSW[1].toFixed(4) + "," + 
                              this.BSW[2].toFixed(4) + "\n";
*/
  }

}




// Stops mic input
Lipsync.prototype.stopSample = function(){
  // If AudioBufferSourceNode has started
  if(this.sample)
    if(this.sample.buffer)
      this.sample.stop(0);

  
  // If microphone input
  if (this.stream){
    var tracks = this.stream.getTracks();
    for (var i = 0; i<tracks.length; i++)
      if (tracks[i].kind = "audio")
        tracks[i].stop();
    this.stream = null;
    }

}
AnimationManager.prototype.animations = {
  "IDLE": "evalls/projects/animations/animations_idle.wbin",
  "WAVE": "evalls/projects/animations/animations_waving.wbin", 
  "NO": "evalls/projects/animations/animations_no.wbin", 
  "BORED": "evalls/projects/animations/animations_bored.wbin",
  "ANGRY": "evalls/projects/animations/animations_angry.wbin",
  "HAPPY": "evalls/projects/animations/animations_happy.wbin",
  "PRAYING": "evalls/projects/animations/animations_praying.wbin",
  "CRAZY": "evalls/projects/animations/animations_crazy.wbin"
}
/* ANIMATION */
function AnimationManager(component, animations){
  
  this.animManager = component;

  // Animations
  this.animations = animations || this.animations;
  this.playing = false;
}

// animationData with animationID, sync attr, speed
AnimationManager.prototype.newAnimation = function(animationData, animations){
  this.currentAnim = {
    speed: this.animManager.playback_speed,
    animation: this.animManager.animation
    }
  
  this.playing = false;
  // Sync
  this.start = animationData.start || 0.0;
  this.speed = animationData.speed || 1.0;
  this.shift = animationData.shift;
  this.time = 0;
  var url = this.animations[animationData.name];
  this.animationName = url;
  var anim = LS.RM.getResource(this.animationName)
  
  if(!anim)
    LS.RM.load(this.animationName, null, this.setDuration.bind(this))
  else
    this.setDuration(anim)
  

}
AnimationManager.prototype.initValues = function()
{
  
  this.time=0;
}
AnimationManager.prototype.setDuration = function(anim)
{
  this.duration = anim.takes.default.duration;
}
AnimationManager.prototype.update = function (dt){
  
  if(this.time == 0)
    this.initValues();
    // Wait for to reach start time
    
  if (this.time < this.start)
    return;
  else if(this.time>=this.start && !this.playing)
  {
    this.animManager.playback_speed = this.speed;
    this.animManager.animation= this.animationName;
    this.playing = true;
  }
    
  else if(!this.shift && this.time>=this.duration && this.playing)
  {
    this.animManager.animation = this.currentAnim.animation;
    this.animManager.playback_speed = this.currentAnim.speed;
  }

  
  this.time+=dt;
}
export { Blink, FacialExpr, GazeManager, Gaze, HeadBML, GestureManager, Lipsync, AnimationManager}