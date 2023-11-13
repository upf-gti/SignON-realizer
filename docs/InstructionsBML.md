# Non Manual Features (NMF) BML Instructions
Data sent to processMsg

``` javascript
{ 
    type: "behaviours", 
    composition: "MERGE", 
    data: [ ... ] 
} 
```

Composition Types: 
``` javascript
composition: "MERGE" //default if not specified
composition: "APPEND" // block will be added at the end of the list
composition: "REPLACE" // removes overlapping blocks
```

Example of objects inside the  "data" array
``` javascript
{
    type: "faceLexeme",
    start: 0.1,
    attackPeak: 0.6,
    relax: 1.5,
    end: 1.8,
    amount: 0.1,
    lexeme: "NMF_ARCH"
}
```

---

## Eye Lookat
``` javascript
type: "gaze" 
type: "gazeShift" // shift automatically set to true

{
    type: "gaze",
    start: 0.1,
    ready: 0.2,
    relax: 0.3,
    end: 0.4,

    influence: "NECK" || "HEAD" || "EYES"
    offsetDirection: "UPRIGHT", "UPLEFT", "DOWNRIGHT", "DOWNLEFT", "RIGHT", "LEFT", "UP", "DOWN"

    shift: false // optional
}
```

---

## Head NOD / SHAKE / TILT
``` javascript
type: "head"

{
    type: "head"
	start: 0.1,
	ready: 0.2,         // gets to position to initiate head stroke
	strokeStart: 0.3,   //optional, if not present, automatically set to ready
	stroke: 0.4,        //optional, if not present, automatically set to half distance of strokeStart & strokeEnd
    strokeEnd: 0.5,     //optional, if not present, automatically set to relax
	relax: 0.6,         // starts returning to neutral position
	end: 0.7,
    amount: 1,  
	repetition: 3,       //amount of times to REPEAT stroke repetition cancels stroke attribute. Default 0 (meaning only moves once)

    lexeme: "NOD" || "SHAKE" || "TILT"
}
```

---

## Speech
``` javascript
type: "speech"

{
    type: "speech",
    text: ["ApakAlIptIkAl"], // "apocalyptical " arpabet 1-letter consonats and vowels plus "." and " "
    phT: [0.1,0.2,0.3,...], // duration (seconds) of each phoneme. Overrides sentT.  
    sentT: 2.3,  //duration (seconds) of whole sentence. Overrides speed. Delay not included.  
    speed: 1/10, //phonemes per second of the whole string. Overrides default speed. 
    phInt: [0.8,0.9,1,...] // intensity of each phoneme. Overrides sentInt.
    sentInt: 1,
}
```

---

## Face Emotion
``` javascript
type: "faceEmotion"
type: "faceVA"

{
    type: "faceEmotion"
    start: 0.1,
    attackPeak: 0.2, // reaches target/amount
    relax: 0.3,  // starts undoing blink
    end: 0.4, 
    amount: 1,

    // choose one
	valaro: [ 0.8, 0.6 ] // [ valence, arousal ] 
    emotion: "ANGER" || "HAPPINESS" || "SADNESS" || "SURPRISE" || "FEAR" || "DISGUST" || "CONTEMPT",

    shift: false // optional
}
```

---

## Face Lexeme
``` javascript
type: "face"
type: "faceShift" // shift automatically set to true
type: "faceLexeme" 
type: "faceFACS"  // shift automatically set to false

{
    type: "faceLexeme",
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4 
    amount: 1

    // choose one ( they are the same )
	lexeme: string  ||   { lexeme: "RAISE_BROWS", amount: 0.1 }   ||   [{...}, {...}, ...],
    au: string  ||   { au: "RAISE_BROWS", amount: 0.1 }   ||   [{...}, {...}, ...],

    shift: false // optional
}

```
<details>
<summary>Click to view the complete list of available lexemes</summary>

NMF_FROWN                 
NMF_ARCH                  
NMF_OPEN_WIDE_EYE          
NMF_SQUINT                 
NMF_BLINK                  
NMF_CLOSED                 
NMF_SUCK_IN_RIGHT          
NMF_SUCK_IN_LEFT           
NMF_SUCK_IN_BOTH           
NMF_BLOW_RIGHT             
NMF_BLOW_LEFT              
NMF_BLOW_BOTH              
NMF_OPEN_WIDE_MOUTH        
NMF_CLOSE_TIGHT            
NMF_SMILE_TEETH            
NMF_SMILE_TEETH_WIDE       
NMF_SMILE_CLOSED           
NMF_ROUND_OPEN             
NMF_ROUND_CLOSED           
NMF_OUT_POINTED            
NMF_OUT_ROUND              
NMF_CRINKLE                
NMF_FLARE                  
LIP_CORNER_DEPRESSOR       
LIP_CORNER_DEPRESSOR_LEFT  
LIP_CORNER_DEPRESSOR_RIGHT 
LIP_CORNER_PULLER          
LIP_CORNER_PULLER_LEFT     
LIP_CORNER_PULLER_RIGHT    
LIP_STRECHER               
LIP_FUNNELER               
LIP_TIGHTENER              
LIP_PRESSOR                
LIP_PUCKERER               
PRESS_LIPS                 
MOUTH_OPEN                 
LOWER_LIP_DEPRESSOR        
CHIN_RAISER                
TONGUE_SHOW                
BROW_LOWERER               
BROW_LOWERER_LEFT          
LOWER_RIGHT_BROW           
LOWER_BROWS                
INNER_BROW_RAISER          
OUTER_BROW_RAISER          
RAISE_LEFT_BROW            
RAISE_RIGHT_BROW           
RAISE_BROWS                
UPPER_LID_RAISER           
CHEEK_RAISER               
LID_TIGHTENER              
EYES_CLOSED                
BLINK                      
WINK_LEFT                  
WINK_RIGHT                 
NOSE_WRINKLER              
UPPER_LIP_RAISER           
DIMPLER                    
DIMPLER_LEFT               
DIMPLER_RIGHT              
JAW_DROP                   
MOUTH_STRETCH
</details>
