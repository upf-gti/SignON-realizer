# BML Instructions
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
The attribute ```shift``` indicates whether the action should be interpreted as the default pose to which return.

<br>

# Non Manual Features (NMF) 

## Blink
Blink is automatically executed by the realizer. However, a blink can be forced with this instruction. For a more controlled eyelid movement, use lexemes instead.
``` javascript
{
    type: "blink",
    start: 0.1
}
```

---

## Eye Lookat
``` javascript
{
    type: "gaze" || "gazeShift", // shift automatically set to true
    start: 0.1,
    ready: 0.2,
    relax: 0.3,
    end: 0.4,

    influence: "NECK" || "HEAD" || "EYES",
    target: "UPRIGHT", "UPLEFT", "DOWNRIGHT", "DOWNLEFT", "RIGHT", "LEFT", "UP", "DOWN", "FRONT",

    // optionals
    offsetDirection: "UPRIGHT", "UPLEFT", "DOWNRIGHT", "DOWNLEFT", "RIGHT", "LEFT", "UP", "DOWN",
    offsetAngle: 0, // degrees
    headOnly: true, // whether to move the eyes with a head movement
    shift: false
}
```

---

## Head NOD / SHAKE / TILT
``` javascript
{
    type: "head",
	start: 0.1,
	ready: 0.2,         // gets to position to initiate head stroke
	strokeStart: 0.3,   //optional, if not present, automatically set to ready
	stroke: 0.4,        //optional, if not present, automatically set to half distance of strokeStart & strokeEnd
    strokeEnd: 0.5,     //optional, if not present, automatically set to relax
	relax: 0.6,         // starts returning to neutral position
	end: 0.7,
    amount: 1,  
	repetition: 3,       //amount of times to REPEAT stroke repetition cancels stroke attribute. Default 0 (meaning only moves once)

    lexeme: "NOD" || "SHAKE" || "TILT",
}
```

---

## Speech
Mouthing.
``` javascript
{
    type: "speech",
    start: 0,
    text: "ApakAlIptIkAl", // "apocalyptical " arpabet 1-letter consonats and vowels plus "." and " "

    // optionals
    phT: [0.1,0.2,0.3,...], // duration (seconds) of each phoneme. Overrides sentT.  
    sentT: 2.3,  //duration (seconds) of whole sentence. Overrides speed. Delay not included.  
    speed: 0.1, //phonemes per second of the whole string. Overrides default speed. Humans speak at 8 phonemes per second (lower boundary) 
    phInt: [0.8,0.9,1,...], // intensity of each phoneme. Overrides sentInt.
    sentInt: 1,
}
```

---

## Face Emotion
``` javascript
{
    type: "faceEmotion" || "faceVA", 
    start: 0.1,
    attackPeak: 0.2, // reaches target/amount
    relax: 0.3,  // starts undoing blink
    end: 0.4, 

    // choose one: either "valaro" or "emotion"
    valaro: [ 0.8, 0.6 ], // [ valence, arousal ] 
    emotion: "ANGER" || "HAPPINESS" || "SADNESS" || "SURPRISE" || "FEAR" || "DISGUST" || "CONTEMPT",

    // optionals
    amount: 1,
    shift: false,
}
```

---

## Face Lexeme
``` javascript
{
    type: "face" || "faceLexeme" || "faceFACS" || "faceShift", // faceShift = shift automatically set to true
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4, 

    // choose one, either "lexeme" or "au" ( they are synonyms )
	lexeme: string  ||   { lexeme: "RAISE_BROWS", amount: 0.1 }   ||   [{...}, {...}, ...],
    au: string  ||   { au: "RAISE_BROWS", amount: 0.1 }   ||   [{...}, {...}, ...],

    // optionals
    amount: 1,
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
LIP_PUCKERER                    
LIP_PRESSOR                     
LOWER_LIP_DEPRESSOR             
UPPER_LIP_RAISER                
CHIN_RAISER                     
DIMPLER                         
DIMPLER_LEFT                    
DIMPLER_RIGHT                   
NOSE_WRINKLER                   
MOUTH_STRETCH                   
MOUTH_OPEN                      
JAW_DROP                        
TONGUE_SHOW                     
BROW_LOWERER                    
BROW_LOWERER_LEFT               
BROW_LOWERER_RIGHT              
BROW_RAISER                     
BROW_RAISER_LEFT                
BROW_RAISER_RIGHT               
INNER_BROW_RAISER               
OUTER_BROW_RAISER               
UPPER_LID_RAISER                
CHEEK_RAISER                    
LID_TIGHTENER                   
EYES_CLOSED                     
BLINK                           
WINK_LEFT                       
WINK_RIGHT                      
</details>


<br>

<br>

# Manual Features (MF)

```
8 directions
u=up, d=down, l=left, r=right, i=in, o=out, 
u,ul,l,dl,d,dr,r,ur, 
```
```
26 directions
u=up, d=down, l=left, r=right, i=in, o=out, 
u,ul,l,dl,d,dr,r,ur, 
uo,uol,ol,dol,do,dor,or,uor,o,
ui,uil,il,dil,di,dir,ir,uir,i,
```

All gestures share some optional attributes 
``` javascript
{
    hand: "right" || "left" || "both", // hand to apply gesture (it does NOT become the dominant hand). Defaults to "right"
    dominant: "right" || "left", // which hand is considered dominant. Only needs to be set once. Affects symmetry attributes. Defaults to "right".
    lrSym: true,  // bool, only applied to the non-dominant hand
    udSym: false, // bool, only applied to the non-dominant hand
    ioSym: false, // bool, only applied to the non-dominant hand
}
```

## Arm Location
Moves the arm (wrist) to a location.
``` javascript
{
    type: "gesture",
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4,
    
    locationArm: "chest", // string
   
    // optionals
    distance: 0, // [0,1] how far from the body to locate the hand. 0 = close, 1 = arm extended
    side: "u", // string, 26 directions. Location will be offseted into that direction
    secondSide: "l", // string, 26 directions. Will compute the midpoint between side and secondSide
    sideDistance: 0.05, // number how far to move to the indicated side. Metres 
    shift: false
}

```
<details>
<summary>Click to view the complete list of available locations</summary>

neutral               
headtop               
forehead               
eyeL               
eyeR               
nose               
upperlip               
mouth               
chin               
cheekL               
cheekR               
earL               
earR               
neck               
chest               
stomach               
belowstomach               
shoulderL               
shoulderR               
loctop1               
loctop2               
loctop3               
loctop4               
loctop5               
locmid1               
locmid2               
locmid3               
locmid4               
locmid5                   
locbot1               
locbot2               
locbot3               
locbot4               
locbot5               
</details>

---

## Palm Orientation
Roll of the wrist joint.
``` javascript
{
    type: "gesture",
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4,
    
    palmor: "u", //string 8 directions. Relative to arm (not to world coordinates )
    
    // optionals
    secondPalmor: "l", // string 8 directions. Will compute midpoint between palmor and secondPalmor.
    shift: false 
}

```

---

## Extfidir
Yaw and Pitch of the wrist joint.
``` javascript
{
    type: "gesture",
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4,
    
    extfidir: "l", // string  26 directions
    
    // optionals
    secondExtfidir: "l", // string 26 directions. Will compute midpoint between extifidir and secondExtfidir
    mode: "local", // number or string - whether the pointing is to "absolute" (1), "relative" (2) or "local" (3) positions to the wrist  
    shift: false, // optional
}

```
---
## Handshape
Sets the posture of the fingers of a hand.
``` javascript
{
    type: "gesture",
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4,
    
    handshape: "flat", //string from the handshape table
    
    // optionals
    thumbshape: "touch", //string from thumbshape table. if not present, a predefined thumbshape for the handshape will be used
    shift: false,
}

```
<details>
<summary>Click to view the complete list of available handshapes</summary>

fist               
finger2               
finger23               
finger23spread               
finger2345               
flat               
pinch12               
pinch12open               
pinchall               
ceeall               
cee12               
cee12open               
</details>

<details>
<summary>Click to view the complete list of available thumbshapes</summary>

default               
out               
opposed               
across               
touch               
</details>

---
## Directed Motion
Moves the arm (wrist) in a linear direction. Not suited for large displacements.

The motion is cut if an arm location is executed afterwards.
``` javascript
{
    type: "gesture",
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4,

    motion: "directed",
    direction: "o", // string 26 directions
    
    // optionals
    secondDirection: "l", // string 8 directions. Will compute midpoint between direction and secondDirection.
    distance: 0.05, // number, metres of the displacement. Default 0.2 m (20 cm)
    curve: "u", // string 8 directions. Default to none
    secondCurve: "l", // string 8 directions. Will compute midpoint between curve and secondCurve.
    curveSteepness: 1, // number from [0,1] meaning the sharpness of the curve
    zigzag: "l", // string 26 directions
    zigzagSize: 0.05, // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
    zigzagSpeed: 3, // oscillations per second. Default 2
}

```

---
## Circular Motion
Moves the arm (wrist) in a circular motion.

The motion is cut if an arm location is executed afterwards.
``` javascript
{
    type: "gesture",
    start: 0.1,
    end: 0.4,
    
    motion: "circular",
    direction: "o", // string 26 directions. Axis of rotation
    
    // optionals
    secondDirection: "l", // string 8 directions. Will compute midpoint between direction and secondDirection.
    distance: 0.05, // number, radius in metres of the circle. Default 0.05 m (5 cm)
    startAngle: 0, // where in the circle to start. 0º indicates up. Indicated in degrees. Default to 0º. [-infinity, +infinity]
    endAngle: 360, // where in the circle to finish. 0º indicates up. Indicated in degrees. Default to 360º. [-infinity, +infinity]
    zigzag: "l", // string 26 directions
    zigzagSize: 0.05, // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
    zigzagSpeed: 3, // oscillations per second. Default 2
}

```

---
## Fingerplay Motion
Wiggle fingers of the hand.
``` javascript
{
    type: "gesture",
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4,
    
    motion: "fingerplay",

    // optionals
    speed: 2, // oscillations per second. Default 3
    intensity: 0.5, //[0,1]. Default 0.3
    fingers: "13", // string with numbers. Each number present activates a finger. 1=index, 2=middle, 3=ring, 4=pinky. I.E. "123" activates index, middle, ring but not pinky. Default all enabled. Thumb is not moved
}

```


---
## Wrist Motion
Repetitive swinging, nodding and twisting of wrist (wiggle for the wrist).
``` javascript
{
    type: "gesture",
    start: 0.1,
    attackPeak: 0.2, 
    relax: 0.3,  
    end: 0.4,
    
    motion: "wrist",
    mode: "nod",
    /* either a: 
        - string from [ "nod", "swing", "twist", "stirCW", "stirCCW", "all" ]
        - or a value from [ 0 = None, 1 = twist, 2 = nod, swing = 4 ]. 
    Several values can co-occur by using the OR (|) operator. I.E. ( 2 | 4 ) = stirCW
    Several values can co-occur by summing the values. I.E. ( 2 + 4 ) = stirCW
    */

    // optionals
    speed: 3, // oscillations per second. Negative values accepted. Default 3. 
    intensity: 0.3, // [0,1]. Default 0.3
}

```


