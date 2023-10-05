# BML Instructions
Data sent to processMsg

``` json
{ 
    "type": "behaviours", 
    "composition": "MERGE", 
    "data": [ ... ] 
} 
```

Composition Types: 
``` json
"composition": "MERGE" //default if not specified
"composition": "APPEND" // block will be added at the end of the list
"composition": "REPLACE" // removes overlapping blocks
```

Example of objects inside the  "data" array
``` json
{
    "type": "faceLexeme",
    "start": 0.1,
    "attackPeak": 0.6,
    "relax": 1.5,
    "end": 1.8,
    "amount": 0.1,
    "lexeme": "NMF_ARCH"
}
```
The attribute ```shift``` indicates whether the action should be interpreted as the default pose to which return.

<br>

# Non Manual Features (NMF) 

## Blink
Blink is automatically executed by the realizer. However, a blink can be forced with this instruction. For a more controlled eyelid movement, use lexemes instead.
``` json
{
    "type": "blink",
    "start": 0.1
}
```

---

## Eye Lookat
``` json
{
    "type": "gaze" || "gazeShift", // shift automatically set to true
    "start": 0.1,
    "ready": 0.2,
    "relax": 0.3,
    "end": 0.4,

    "influence": "NECK" || "HEAD" || "EYES",
    "target": "UP_RIGHT", "UP_LEFT", "DOWN_RIGHT", "DOWN_LEFT", "RIGHT", "LEFT", "UP", "DOWN", "FRONT",

    // optionals
    "offsetDirection": "UP_RIGHT", "UP_LEFT", "DOWN_RIGHT", "DOWN_LEFT", "RIGHT", "LEFT", "UP", "DOWN",
    "offsetAngle": 0, // degrees
    "headOnly": true, // whether to move the eyes with a head movement
    "shift": false
}
```

---

## Head NOD / SHAKE / TILT / FORWARD / BACKWARD
``` json
{
    "type": "head",
	"start": 0.1,
	"ready": 0.2,         // gets to position to initiate head stroke
	"strokeStart": 0.3,   //optional, if not present, automatically set to ready
	"stroke": 0.4,        //optional, if not present, automatically set to half distance of strokeStart & strokeEnd
    "strokeEnd": 0.5,     //optional, if not present, automatically set to relax
	"relax": 0.6,         // starts returning to neutral position
	"end": 0.7,
    "amount": 1,  
	"repetition": 3,       //amount of times to REPEAT. Default 0 (meaning only moves once)

    "lexeme": "NOD" || "SHAKE" || "TILT" || "TILT_LEFT" || "TILT_RIGHT" || "TILT_FORWARD" || "TILT_BACKWARD" || "FORWARD" || "BACKWARD"

}
```

---

## Speech
Mouthing.
``` json
{
    "type": "speech",
    "start": 0,
    "text": "ApakAlIptIkAl", // "apocalyptical " arpabet 1-letter consonats and vowels plus "." and " "

    // optionals
    "phT": [0.1,0.2,0.3,...], // duration (seconds) of each phoneme. Overrides sentT.  
    "sentT": 2.3,  //duration (seconds) of whole sentence. Overrides speed. Delay not included.  
    "speed": 0.1, //phonemes per second of the whole string. Overrides default speed. Humans speak at 8 phonemes per second (lower boundary) 
    "phInt": [0.8,0.9,1,...], // intensity of each phoneme. Overrides sentInt.
    "sentInt": 1,
}
```

---

## Face Emotion
``` json
{
    "type": "faceEmotion" || "faceVA", 
    "start": 0.1,
    "attackPeak": 0.2, // reaches target/amount
    "relax": 0.3,  // starts undoing blink
    "end": 0.4, 

    // choose one: either "valaro" or "emotion"
    "valaro": [ 0.8, 0.6 ], // [ valence, arousal ] 
    "emotion": "ANGER" || "HAPPINESS" || "SADNESS" || "SURPRISE" || "FEAR" || "DISGUST" || "CONTEMPT",

    // optionals
    "amount": 1,
    "shift": false,
}
```

---

## Face Lexeme
``` json
{
    "type": "face" || "faceLexeme" || "faceFACS" || "faceShift", // faceShift = shift automatically set to true
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4, 

    // choose one, either "lexeme" or "au" ( they are synonyms )
	"lexeme": string  ||   { "lexeme": "RAISE_BROWS", "amount": 0.1 }   ||   [{...}, {...}, ...],
    "au": string  ||   { "au": "RAISE_BROWS", "amount": 0.1 }   ||   [{...}, {...}, ...],

    // optionals
    "amount": 1,
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
``` json
{
    "hand": "RIGHT" || "LEFT" || "BOTH", // hand to apply gesture (it does NOT become the dominant hand). Defaults to "RIGHT"
    "lrSym": true,  // bool, only applied to the non-dominant hand
    "udSym": false, // bool, only applied to the non-dominant hand
    "ioSym": false, // bool, only applied to the non-dominant hand
}
```

The dominant hand can be set through the following attribute.
``` json
{
    "type": "gesture",
    "config": { 
        "dominant": "RIGHT" || "LEFT", // which hand is considered dominant. Only needs to be set once. Affects symmetry attributes. Defaults to "right". 
    },
}
```

Attributes with the ```second``` prefix are usually optional and combines the effects of this and the same attribute without the prefix.

All gesture intructions can be packed into a single BML instruction. Caution must be taken as attributes may overlap between different gesture types. This can be useful to to reuse the same timing for several gestures  
The following example using a single BML, instructs the avatar the handshape, palmor, extfidir and the shoulder raise with the same timing variables
``` json
{ 
    "type": "gesture",
    "start": 0,   "attackPeak": 0.5,   "relax": 1,   "end": 2, 
    "shoulderRaise": "1",
    "extfidir": "u", 
    "palmor": "l",  
    "handshape": "FINGER_2",
    "hand": "LEFT" 
}
```
## Shoulder Raise
Raises the shoulder
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "shoulderRaise": 0.8, // value [0,1]
    
    //optional
    "shift": false, 
}
```

---
## Shoulder Hunch
Moves the shoulder forward
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "shoulderHunch": 0.8, // value [0,1]
    
    //optional
    "shift": false, 
}
```

---
## Body Movement
Moves the body (trunk). Tilt forward-backward, tilt left-right and rotate left-right. New gestures are added to the previuos one, they are not replaced.
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "bodyMovement": "TILT_FORWARD" || "TILT_BACKWARD" || "TILT_LEFT" || "TILT_RIGHT" || "ROTATE_LEFT" || "ROTATE_RIGHT",
    
    //optional
    "amount": 0.5, // default to 1 
}
```

---
## Body Location
Moves the arm (wrist) to a location of the body (face + trunk).
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "locationBodyArm": "CHEST", // string
   
    // optionals
    "secondLocationBodyArm": "CHEST", // string
    "side": "rr" || "r" || "l" || "ll", // string, chooses a point to the right, slightly right, slightly left or left of the chosen point
    "secondSide": "l", // string

    "distance": 0, // [0,1] how far from the body to locate the hand. 0 = close, 1 = arm extended
    "displace": "u", // string, 26 directions. Location will be offseted into that direction
    "displaceDistance": 0.05, // number how far to move to the indicated side. Metres 
 
    "elbowRaise": 10, // in degrees. Positive values raise the elbow.

    //Following attributes describe which part of the hand will try to reach the locationBodyArm location 
    "srcFinger": "1", // 1,2,3,4,5, see handconstellation for more information
    "srcLocation": "PAD", // see handconstellation hand locations
    "srcSide": "PALMAR", // see handconstellation sides
    "keepUpdatingContact": false, // once peak is reached, the location will be updated only if this is true. 
                // i.e.: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
                // i.e.: set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  

    "shift": false, // contact information ( srcFinger, srcLocation, srcSide ) is not kept for shift
}
```
<details>
<summary>Click to view the complete list of available locations</summary>

"HEAD"               
"HEAD_TOP"    
"FOREHEAD"    
"NOSE"               
"BELOW_NOSE"               
"CHIN"               
"UNDER_CHIN"               
"MOUTH"               
"EARLOBE" ``` // automatically assigns right or left from the incoming hand ```                    
"EARLOBE_RIGHT"     
"EARLOBE_LEFT"               
"EAR"  ``` // automatically assigns right or left from the incoming hand ```                    
"EAR_RIGHT"               
"EAR_LEFT"    
"CHEEK"  ``` // automatically assigns right or left from the incoming hand ```                    
"CHEEK_RIGHT"               
"CHEEK_LEFT"        
"EYE" ``` // automatically assigns right or left from the incoming hand ```                    
"EYE_RIGHT"               
"EYE_LEFT"        
"EYEBROW" ``` // automatically assigns right or left from the incoming hand ```                    
"EYEBROW_RIGHT"               
"EYEBROW_LEFT"                       
"CHEST"               
"SHOULDER_LINE"          
"SHOULDER" ``` // automatically assigns right or left from the incoming hand ```                    
"SHOULDER_RIGHT"               
"SHOULDER_LEFT"        
"STOMACH"               
"BELOW_STOMACH"               
"NEUTRAL"               
</details>

---

## Palm Orientation
Roll of the wrist joint.
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "palmor": "u", //string 8 directions. Relative to arm (not to world coordinates )
    
    // optionals
    "secondPalmor": "l", // string 8 directions. Will compute midpoint between palmor and secondPalmor.
    "shift": false 
}
```

---

## Extfidir
Yaw and Pitch of the wrist joint.
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "extfidir": "l", // string  26 directions
    
    // optionals
    "secondExtfidir": "l", // string 26 directions. Will compute midpoint between extifidir and secondExtfidir  
    "shift": false, // optional
}
```
---
## Handshape
Sets the posture of the fingers of a hand. Fingers are numbered from 1 (thumb) to 5 (pinky)
``` json
{ 
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "handshape": "FLAT", //string from the handshape table
    
    // optionals
    "secondHandshape": "FLAT", //string from the handshape table
    "thumbshape": "TOUCH", //string from thumbshape table. if not present, the predefined thumbshape for the handshape will be used
    "secondThumbshape": "TOUCH", // string from thumbshape table. Applied to secondHandshape
    "tco": 0.3, // number [0,1]. Thumb Combination Opening from the Hamnosys specification 
    "secondtco": 0.3, // number [0,1]. Thumb Combination Opening from the Hamnosys specification. Applied to secondHandshape
    
    "mainBend": "HOOKED", // bend applied to selected fingers from the default handshapes. Basic handshapes and ThumbCombination handshapes behave differently. Value from the bend table
    "secondMainBend": "HOOKED", // mainbend applied to secondHandshape
    "bend1": "099", // overrides any other bend applied for this handshape for this finger. bend1=thumb, bend2=index, and so on. The value is one from the bend table
    "mainSplay": 0.5, // number [-1,1]. Separates laterally fingers 2,4,5. Splay diminishes the more the finger is bent
    "splay1": 0.5, // number [-1,1]. Sepparates laterally the specified finger. Splay diminishes the finger is bent. splay1=thumb, splay2=index, and so on
    "shift": false,
}
```
<details>
<summary>Click to view the complete list of available HANDSHAPES</summary>

--- BASIC HANDSHAPES ---                       
FIST               
FINGER_2               
FINGER_23               
FINGER_23_SPREAD               
FINGER_2345               
FLAT            
               
--- THUMB COMBINATION HANDSHAPES ---               
PINCH_12               
PINCH_12_OPEN               
PINCH_ALL               
CEE_ALL               
CEE_12               
CEE_12_OPEN               
</details>

<details>
<summary>Click to view the complete list of available THUMBSHAPES </summary>

DEFAULT   
OUT    
OPPOSED    
ACROSS    
TOUCH                   
</details>
<details>
<summary>Click to view the complete list of BEND STATES </summary>

STRAIGHT         
HALF_BENT         
BENT         
ROUND         
HOOKED         
DOUBLE_BENT                 
DOUBLE_HOOKED         
triplets of numbers from 0-9. The first number indicates the base of the finger, the second the middle joint and the third the joint in the tip of the finger.         
i.e. BENT = "900", HOOKED = "099"
</details>

---

## Hand Constellation
Moves the hand position with respect to each other.

The motion is stopped if an arm location is executed afterwards.
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,

    "handConstellation": true,
    //Location of the hand in the specified hand (or dominant hand)
    "srcFinger": "2", // 1,2,3,4,5. If the location does not use a finger, do not include this
    "srcLocation": "PAD", // string from hand locations (although no forearm, elbow, upperarm are valid inputs here)
    "srcSide": "BACK", // ULNAR, RADIAL, PALMAR, BACK
     
    //Location of the hand in the unspecified hand (or non dominant hand)
    "dstFinger": "2", // 1,2,3,4,5. If the location does not use a finger, do not include this
    "dstLocation": "BASE", // string from hand locations or arm locations
    "dstSide": "PALMAR", // ULNAR, RADIAL, PALMAR, BACK 
    
    "hand": "DOMINANT" || "NON_DOMINANT" || "LEFT" || "RIGHT" || "BOTH", // if hand=="BOTH", both hand will try to reach each other, meeting in the middle. Otherwise, only the specified hand will move.

    // optionals
    "distance": 0, //[-ifinity,+ifninity] where 0 is touching and 1 is the arm size. Distance between endpoints. 
    "distanceDirection": "l", // string, any combination of the main directions. If not provided, defaults to horizontal outwards direction
    
    "keepUpdatingContact": false, // once peak is reached, the location will be updated only if this is true. 
                    // i.e.: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
                    // i.e.: set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
}
```
<details>
<summary>Click to view the complete list of HAND CONSTELLATION SIDES </summary>

RIGHT         
LEFT         
ULNAR         
RADIAL         
FRONT  ``` // only for ELBOW and UPPER_ARM instead of PALMAR ```      
BACK         
PALMAR
</details>
<details>
<summary>Click to view the complete list of HAND LOCATIONS </summary>

TIP  ``` // need a finger specification and does not have sides ```        
PAD ``` // need a finger specification ```        
MID ``` // need a finger specification ```         
BASE ``` // need a finger specification ```         
THUMB_BALL         
HAND         
WRIST         
</details>
<details>
<summary>Click to view the complete list of ARM LOCATIONS </summary>

FOREARM        
ELBOW        
UPPER_ARM         
</details>

---
## Directed Motion
Moves the arm (wrist) in a linear direction.

``distance`` and ``curveSteepness`` attributes are concurrent and not exclusive. Meaning one attribute can be 0 while the other different from 0.

The motion is stopped if an arm location is executed afterwards.
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,

    "motion": "directed",
    "direction": "o", // string 26 directions
    
    // optionals
    "secondDirection": "l", // string 8 directions. Will compute midpoint between direction and secondDirection.
    "distance": 0.05, // number, metres of the displacement. Default 0.2 m (20 cm)
    "curve": "u", // string 8 directions. Default to none
    "secondCurve": "l", // string 8 directions. Will compute midpoint between curve and secondCurve.
    "curveSteepness": 1, // number meaning the sharpness of the curve
    "zigzag": "l", // string 26 directions
    "zigzagSize": 0.05, // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
    "zigzagSpeed": 3, // oscillations per second. Default 2
}
```

---
## Circular Motion
Moves the arm (wrist) in a circular motion.

The motion is stopped if an arm location is executed afterwards.
``` json
{
    "type": "gesture",
    "start": 0.1,
    "end": 0.4,
    
    "motion": "circular",
    "direction": "o", // string 26 directions. Axis of rotation
    
    // optionals
    "secondDirection": "l", // string 8 directions. Will compute midpoint between direction and secondDirection.
    "distance": 0.05, // number, radius in metres of the circle. Default 0.05 m (5 cm)
    "startAngle": 0, // where in the circle to start. 0º indicates up. Indicated in degrees. Default to 0º. [-infinity, +infinity]
    "endAngle": 360, // where in the circle to finish. 0º indicates up. Indicated in degrees. Default to 360º. [-infinity, +infinity]
    "zigzag": "l", // string 26 directions
    "zigzagSize": 0.05, // amplitude of zigzag (from highest to lowest point) in metres. Default 0.01 m (1 cm)
    "zigzagSpeed": 3, // oscillations per second. Default 2
}
```

---
## Fingerplay Motion
Wiggle fingers of the hand.
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "motion": "fingerplay",

    // optionals
    "speed": 2, // oscillations per second. Default 3
    "intensity": 0.5, //[0,1]. Default 0.3
    "fingers": "13", // string with numbers. Each number present activates a finger. 2=index, 3=middle, 4=ring, 4=pinky. I.E. "234" activates index, middle, ring but not pinky. Default all enabled
    "exemptedFingers": "2", //string with numbers. Blocks a finger from doing the finger play. Default all fingers move

}
```


---
## Wrist Motion
Repetitive swinging, nodding and twisting of wrist (wiggle for the wrist).
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,
    
    "motion": "wrist",
    "mode": "NOD",
    /* either a: 
        - string from [ "NOD", "NODDING", "SWING", "SWINGING", "TWIST", "TWISTING", "STIR_CW", "STIR_CCW", "ALL" ]
        - or a value from [ 0 = None, 1 = TWIST, 2 = NOD, SWING = 4 ]. 
    Several values can co-occur by using the OR (|) operator. I.E. ( 2 | 4 ) = STIR_CW
    Several values can co-occur by summing the values. I.E. ( 2 + 4 ) = STIR_CW
    */

    // optionals
    "speed": 3, // oscillations per second. Negative values accepted. Default 3. 
    "intensity": 0.3, // [0,1]. Default 0.3
}
```


