## FaceLexeme

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
## Eye Lookat

``` json
{
    "type": "gaze",
    "start": 0.1,
    "ready": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "influence": "NECK",
    "target": "UP_RIGHT",
    "offsetDirection": "UP_RIGHT",
    "offsetAngle": 0,
    "headOnly": true,
    "shift": false
}
```
``` json
{
    "type": "gaze",
    "start": 0.1,
    "ready": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "influence": "NECK",
    "target": "DOWN_LEFT",
    "offsetAngle": 0,
    "headOnly": true,
    "shift": false
}
```
``` json
{
    "type": "gaze",
    "start": 0.1,
    "ready": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "influence": "NECK",
    "target": "RIGHT",
    "offsetDirection": "UP_RIGHT",
    "offsetAngle": 0,
    "headOnly": true,
    "shift": false
}
`````` json
{
    "type": "gaze",
    "start": 0.1,
    "ready": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "influence": "NECK",
    "target": "UP_RIGHT",
    "offsetAngle": 0,
    "headOnly": true,
    "shift": true
}
``````
## Head NOD / SHAKE / TILT / FORWARD / BACKWARD
``` json
{
    "type": "head",
	"start": 0.1,
	"ready": 0.2,       
	"strokeStart": 0.3, 
	"stroke": 0.4,      
    "strokeEnd": 0.5,   
	"relax": 0.6,       
	"end": 0.7,
    "amount": 1, 
	"repetition": 3,    
    "lexeme": "FORWARD" 
}
```
``` json
{
    "type": "head",
	"start": 0.1,
	"ready": 0.2,       
	"strokeStart": 0.3, 
	"stroke": 0.4,      
    "strokeEnd": 0.5,   
	"relax": 0.6,       
	"end": 0.7,
    "amount": 1, 
	"repetition": 3,    
    "lexeme": "NOD" 
}
```
``` json
{
    "type": "head",
	"start": 0.1,
	"ready": 0.2,       
	"strokeStart": 0.3, 
	"stroke": 0.4,      
    "strokeEnd": 0.5,   
	"relax": 0.6,       
	"end": 0.7,
    "amount": 1, 
	"repetition": 3,    
    "lexeme": "TILT_LEFT" 
}
```
``` json
{
    "type": "head",
	"start": 0.1,
	"ready": 0.2,       
	"strokeStart": 0.3, 
	"stroke": 0.4,      
    "strokeEnd": 0.5,   
	"relax": 0.6,       
	"end": 0.7,
    "amount": 1, 
	"repetition": 3,    
    "lexeme": "TILT_BACKWARD" 
}
```
## Manual Features (MF)
``` json
{
    "hand": "LEFT",
    "lrSym": true,
    "udSym": false,
    "ioSym": false
}
```
``` json
{
    "type": "gesture",
    "config": { 
        "dominant": "RIGHT" 
    },
}
```
``` json
{
    "type": "gesture",
    "start": 0,
    "attackPeak": 0.5,
    "relax": 1,
    "end": 2,
    "shoulderRaise": "1",
    "extfidir": "u",
    "palmor": "l",
    "handshape": "finger2",
    "hand": "LEFT"
}
```
## Shoulder Raise
## Shoulder Hunch

## Body Movement
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "bodyMovement": "TILT_FORWARD",
    "amount": 0.5
}
```
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "bodyMovement": "TILT_BACKWARD",
    "amount": 0.5
}
```
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "bodyMovement": "TILT_LEFT",
    "amount": 0.5
}
```
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "bodyMovement": "TILT_RIGHT",
    "amount": 0.5
}
```
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "bodyMovement": "ROTATE_LEFT",
    "amount": 0.5
}
```
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "bodyMovement": "ROTATE_RIGHT",
    "amount": 0.5
}
```
## Body Location
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "locationBodyArm": "CHEST",
    "srcFinger": "1",
    "srcLocation": "PAD",
    "srcSide": "PALMAR"
}
```
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "locationBodyArm": "EARLOBE_RIGHT",
    "srcFinger": "1",
    "srcLocation": "PAD",
    "srcSide": "PALMAR"
}
```
## Palm Orientation
``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "palmor": "u",
    "secondPalmor": "l",
    "shift": false
}
```
## Handshape

``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2,
    "relax": 0.3,
    "end": 0.4,
    "handshape": "flat",
    "secondHandshape": "flat",
    "thumbshape": "touch",
    "secondThumbshape": "touch",
    "tco": 0.3,
    "secondtco": 0.3,
    "mainBend": "hooked"
}

## Hand Constellation

``` json
{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 0.4,

    "handConstellation": true,
    "srcFinger": "2",
    "srcLocation": "PAD", 
    "srcSide": "BACK", 
     
    "dstFinger": "2", 
    "dstLocation": "BASE", 
    "dstSide": "PALMAR", 
    
    "hand": "DOM"
}

{
    "type": "gesture",
    "start": 0.1,
    "attackPeak": 0.2, 
    "relax": 0.3,  
    "end": 1.5,

    "handConstellation": true,
    "srcFinger": "2",
    "srcLocation": "PAD", 
    "srcSide": "ULNAR", 
     
    "dstFinger": "2", 
    "dstLocation": "BASE", 
    "dstSide": "PALMAR", 
    
    "hand": "DOM"
}
```