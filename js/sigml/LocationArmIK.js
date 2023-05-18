import * as THREE from 'three';
import { directionStringSymmetry, mirrorQuatSelf } from './sigmlUtils.js';

// Description of sigml points supported. keys: our proposal (what the realizer uses). Values: list of tags of sigml that are mapped to that key
// headtop : headtop,
// forehead : head, forehead,
// eyeL : eyebrows, eyes, uppereyelid, lowereyelid,
// eyeR : eyebrows, eyes, uppereyelid, lowereyelid,
// nose : nose,
// upperlip : nostrils, upperlip,
// mouth: lips, lowerlip, tongue, teeth, upperteeth, lowerteeth,
// chin : chin, underchin,
// earL : ear, earlobe,
// earR : ear, earlobe,
// cheekL : cheek,
// cheekR : cheek,
// neck : neck,
// shoulderL : shoulders, shouldertop,
// shoulderR : shoulders, shouldertop,
// chest : chest,
// stomach : stomach,
// belowstomach : belowstomach,


// arm quaternions from right arm perspective
// [ ShoulderBack, Shoulder, Elbow ]
let nearPoses = {
    neutral:        [ new THREE.Quaternion(-0.0030244,-0.6014008,0.0175197,0.7987496), new THREE.Quaternion(0.5977453,0.1557497,-0.0462050,0.7850526), new THREE.Quaternion(0.2523842,0.2125053,0.0112892,0.9439365)  ],

    headtop:        [ new THREE.Quaternion(-0.0506604,-0.7341385,-0.0660531,0.6738776), new THREE.Quaternion(-0.4668017,0.0198618,-0.0204699,0.8839019), new THREE.Quaternion(-0.6623683,0.1071393,-0.0464818,0.7400194)  ],
    forehead:       [ new THREE.Quaternion(0.0052382,-0.7376279,0.0058476,0.6751617), new THREE.Quaternion(-0.0995180,0.7498349,-0.0055130,0.6540743), new THREE.Quaternion(-0.6971409,0.3354671,-0.0556369,0.6311582)  ],
    eyeL:           [ new THREE.Quaternion(0.1273960,-0.7585008,0.1566673,0.6195983), new THREE.Quaternion(0.0285814,0.8482021,-0.0000513,0.5289008), new THREE.Quaternion(-0.4557415,0.5937748,-0.0472286,0.6614382)  ],
    eyeR:           [ new THREE.Quaternion(0.1152192,-0.7544016,0.1422677,0.6303669), new THREE.Quaternion(0.0714903,0.8325108,0.0018608,0.5493736), new THREE.Quaternion(-0.5646459,0.5390549,-0.0528718,0.6227353)  ],
    nose:           [ new THREE.Quaternion(-0.0252475,-0.7199582,-0.0304132,0.6928908), new THREE.Quaternion(0.0454818,0.7106191,0.0009248,0.7021046), new THREE.Quaternion(-0.6405263,0.5539174,-0.0584294,0.5286657)  ],
    upperlip:       [ new THREE.Quaternion(-0.0288777,-0.7174093,-0.0346774,0.6951887), new THREE.Quaternion(0.0694745,0.6986833,0.0019989,0.7120469), new THREE.Quaternion(-0.5996578,0.6148312,-0.0575356,0.5090016)  ],
    mouth:          [ new THREE.Quaternion(-0.0039781,-0.7422616,-0.0068752,0.6700630), new THREE.Quaternion(0.1569718,0.7319968,0.0057865,0.6629531), new THREE.Quaternion(-0.5367775,0.6554966,-0.0545482,0.5284112)  ],
    chin:           [ new THREE.Quaternion(-0.0144784,-0.7336383,-0.0188906,0.6791231), new THREE.Quaternion(0.2120324,0.6909716,0.0082736,0.6910368), new THREE.Quaternion(-0.4265878,0.7764973,-0.0508725,0.4609626)  ],
    cheekL:         [ new THREE.Quaternion(0.0352934,-0.7555276,0.0411269,0.6528713), new THREE.Quaternion(0.0514777,0.8204809,0.0010022,0.5693505), new THREE.Quaternion(-0.4342420,0.7208578,-0.0496679,0.5378949)  ],
    cheekR:         [ new THREE.Quaternion(0.0230982,-0.7083715,0.0339334,0.7046451), new THREE.Quaternion(0.1192426,0.7429874,0.0041107,0.6585848), new THREE.Quaternion(-0.7864518,0.4759690,-0.0659315,0.3880720)  ],
    earL:           [ new THREE.Quaternion(0.1029711,-0.6166821,0.1499909,0.7659000), new THREE.Quaternion(0.0893024,0.8568030,0.0026013,0.5078452), new THREE.Quaternion(-0.3381405,0.7009594,-0.0426242,0.6264982)  ],
    earR:           [ new THREE.Quaternion(0.1681397,-0.5996382,0.2337173,0.7466855), new THREE.Quaternion(-0.1995244,0.7336113,-0.0098819,0.6495434), new THREE.Quaternion(-0.7972906,0.4242612,-0.0650900,0.4243739)  ],
    neck:           [ new THREE.Quaternion(-0.0311668,-0.6967750,-0.0340783,0.7158014), new THREE.Quaternion(0.4273569,0.5905589,0.0178945,0.6843142), new THREE.Quaternion(-0.2417393,0.8818185,-0.0417702,0.4027573)  ],
    chest:          [ new THREE.Quaternion(-0.0107485,-0.6729800,-0.0036564,0.7395734), new THREE.Quaternion(0.6108346,0.2714558,0.0264699,0.7432981), new THREE.Quaternion(0.2821601,0.8551173,-0.0061830,0.4348812)  ],
    stomach:        [ new THREE.Quaternion(-0.0125816,-0.6608236,-0.0040435,0.7504248), new THREE.Quaternion(0.5685093,0.1448031,0.0248173,0.8094524), new THREE.Quaternion(0.5358218,0.5919117,0.0185811,0.6018223)  ],
    belowstomach:   [ new THREE.Quaternion(-0.0134201,-0.6603696,-0.0050532,0.7508037), new THREE.Quaternion(0.5879901,0.1971521,0.0255878,0.7840560), new THREE.Quaternion(0.4416799,0.2915858,0.0214299,0.8481964)  ],
    shoulderL:      [ new THREE.Quaternion(0.0466722,-0.5776748,0.0846167,0.8105266), new THREE.Quaternion(0.4878578,0.5500982,0.0206168,0.6774670), new THREE.Quaternion(0.2735958,0.8199461,-0.0056520,0.5027938)  ],
    shoulderR:      [ new THREE.Quaternion(-0.0091726,-0.7450993,-0.0141048,0.6667412), new THREE.Quaternion(0.5866297,0.3048243,0.0253537,0.7498699), new THREE.Quaternion(-0.3295025,0.9072888,-0.0484754,0.2567200)  ],    
}
    // 1 = right, 5 = left. Different numbering than "signing space" of Irene's thesis. This is better for symmetry and others
    nearPoses.loctop1 = nearPoses.shoulderR;       
    nearPoses.loctop2 = nearPoses.shoulderR;       
    nearPoses.loctop3 = nearPoses.shoulderR;        
    nearPoses.loctop4 = nearPoses.shoulderR;       
    nearPoses.loctop5 = nearPoses.shoulderR;       
 
    nearPoses.locmid1 = nearPoses.shoulderR;       
    nearPoses.locmid2 = nearPoses.shoulderR;       
    nearPoses.locmid3 = nearPoses.shoulderR;        
    nearPoses.locmid4 = nearPoses.shoulderR;       
    nearPoses.locmid5 = nearPoses.shoulderR;       
 
    nearPoses.locbot1 = nearPoses.shoulderR;       
    nearPoses.locbot2 = nearPoses.shoulderR;       
    nearPoses.locbot3 = nearPoses.shoulderR;        
    nearPoses.locbot4 = nearPoses.shoulderR;       
    nearPoses.locbot5 = nearPoses.shoulderR;       
             
// positions to be used by ik
let farPoses = {
    neutral:      new THREE.Vector3( 0,1.8,1),    
    headtop:      new THREE.Vector3( 0,2.5,0.1),  
      
    forehead:     new THREE.Vector3( 0.0,1.5,0.5 ), 
    eyeL:         new THREE.Vector3( 0.0,1.5,0.5 ),  
    eyeR:         new THREE.Vector3( 0.0,1.5,0.5 ),  
    nose:         new THREE.Vector3( 0.0,1.5,0.5 ),  
    upperlip:     new THREE.Vector3( 0.0,1.5,0.5 ),  
    mouth:        new THREE.Vector3( 0.0,1.5,0.5 ),   
    chin:         new THREE.Vector3( 0.0,1.5,0.5 ), 
    cheekR:       new THREE.Vector3( 0.0,1.5,0.5 ),  
    cheekL:       new THREE.Vector3( 0.0,1.5,0.5 ),   
    earL:         new THREE.Vector3( 0.0,1.5,0.5 ),  
    earR:         new THREE.Vector3( 0.0,1.5,0.5 ),   

    neck:         new THREE.Vector3( 0.0,1.40,0.5 ),  
    chest:        new THREE.Vector3( 0.0,1.30,0.5 ),  
    stomach:      new THREE.Vector3( 0.0,1.15,0.5 ),
    belowstomach: new THREE.Vector3( 0.0,1.00,0.5 ), 
    shoulderL:    new THREE.Vector3( 0.0,1.30,0.5 ), 
    shoulderR:    new THREE.Vector3( 0.0,1.30,0.5 ), 

    // 1 = right, 5 = left. Different numbering than "signing space" of Irene's thesis. This is better for symmetry and others
    loctop1:      new THREE.Vector3(-0.59,2.00,0.23 ),   
    loctop2:      new THREE.Vector3(-0.29,2.00,0.39 ),   
    loctop3:      new THREE.Vector3( 0.00,2.00,0.46 ),   
    loctop4:      new THREE.Vector3( 0.29,2.00,0.39 ),   
    loctop5:      new THREE.Vector3( 0.59,2.00,0.23 ),
   
    locmid1:      new THREE.Vector3(-0.59,1.30,0.23 ),
    locmid2:      new THREE.Vector3(-0.29,1.30,0.39 ),
    locmid3:      new THREE.Vector3( 0.00,1.30,0.46 ),
    locmid4:      new THREE.Vector3( 0.29,1.30,0.39 ),
    locmid5:      new THREE.Vector3( 0.59,1.30,0.23 ),
                
    locbot1:      new THREE.Vector3( -0.59,0.74,0.23 ),
    locbot2:      new THREE.Vector3( -0.29,0.74,0.39 ),
    locbot3:      new THREE.Vector3(  0.00,0.74,0.46 ),
    locbot4:      new THREE.Vector3(  0.29,0.74,0.31 ),
    locbot5:      new THREE.Vector3(  0.59,0.74,0.18 ),
}

let sides = {
    'u'     : (new THREE.Vector3(  0,   1,   0 )).normalize(),   
    'ul'    : (new THREE.Vector3(  1,   1,   0 )).normalize(),   
    'l'     : (new THREE.Vector3(  1,   0,   0 )).normalize(),   
    'dl'    : (new THREE.Vector3(  1,  -1,   0 )).normalize(),   
    'd'     : (new THREE.Vector3(  0,  -1,   0 )).normalize(),   
    'dr'    : (new THREE.Vector3( -1,  -1,   0 )).normalize(),  
    'r'     : (new THREE.Vector3( -1,   0,   0 )).normalize(),  
    'ur'    : (new THREE.Vector3( -1,   1,   0 )).normalize(),  

    "uo"    : (new THREE.Vector3(  0,   1,   1 )).normalize(),
    "uol"   : (new THREE.Vector3(  1,   1,   1 )).normalize(),
    "ol"    : (new THREE.Vector3(  1,   0,   1 )).normalize(),
    "dol"   : (new THREE.Vector3(  1,  -1,   1 )).normalize(),
    "do"    : (new THREE.Vector3(  0,  -1,   1 )).normalize(),
    "dor"   : (new THREE.Vector3( -1,  -1,   1 )).normalize(),
    "or"    : (new THREE.Vector3( -1,   0,   1 )).normalize(),
    "uor"   : (new THREE.Vector3( -1,   1,   1 )).normalize(),
    "o"     : (new THREE.Vector3(  0,   0,   1 )).normalize(),
    
    "ui"    : (new THREE.Vector3(  0,   1,  -1 )).normalize(),
    "uil"   : (new THREE.Vector3(  1,   1,  -1 )).normalize(),
    "il"    : (new THREE.Vector3(  1,   0,  -1 )).normalize(),
    "dil"   : (new THREE.Vector3(  1,  -1,  -1 )).normalize(),
    "di"    : (new THREE.Vector3(  0,  -1,  -1 )).normalize(),
    "dir"   : (new THREE.Vector3( -1,  -1,  -1 )).normalize(),
    "ir"    : (new THREE.Vector3( -1,   0,  -1 )).normalize(),
    "uir"   : (new THREE.Vector3( -1,   1,  -1 )).normalize(),
    "i"     : (new THREE.Vector3(  0,   0,  -1 )).normalize(),
}

class LocationArmIK {
    constructor( boneMap, skeleton, ikSolver, isLeftHand = false ) {
        this.skeleton = skeleton;
        this.ikSolver = ikSolver;
        this.chainInfo = null;
        this.mirror = !!isLeftHand;

        this.idx = ( isLeftHand ) ? boneMap[ "LShoulder" ] : boneMap[ "RShoulder" ]; // shoulder (back) index 
        this.chainInfo = ( isLeftHand ) ? this.ikSolver.getChain( "LeftArm" ) : this.ikSolver.getChain( "RightArm" );

        // three bones: shoulder (back), actual shoulder, elbow
        this.defG = [new THREE.THREE.Quaternion(), new THREE.THREE.Quaternion(), new THREE.THREE.Quaternion()]; // default gesture
        this.srcG = [new THREE.THREE.Quaternion(), new THREE.THREE.Quaternion(), new THREE.THREE.Quaternion()]; // source gesture
        this.trgG = [new THREE.THREE.Quaternion(), new THREE.THREE.Quaternion(), new THREE.THREE.Quaternion()]; // target gesture
        this.curG = [new THREE.THREE.Quaternion(), new THREE.THREE.Quaternion(), new THREE.THREE.Quaternion()]; // target gesture

        this.time = 0; // current time of transition

        this.start = 0; 
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        
        this.transition = false;

        // set default poses
        this.reset();
    }

    reset(){
        this.transition = false;
        this.curG[0].copy( nearPoses.neutral[0] );
        this.curG[1].copy( nearPoses.neutral[1] );
        this.curG[2].copy( nearPoses.neutral[2] );

        this.defG[0].copy( nearPoses.neutral[0] );
        this.defG[1].copy( nearPoses.neutral[1] );
        this.defG[2].copy( nearPoses.neutral[2] );
    }

    update( dt ){
        // nothing to do
        if ( !this.transition ){ return; } 
        
        this.time += dt;
        
        // wait in same pose
        if ( this.time < this.start ){ return; }
        if ( this.time > this.attackPeak && this.time < this.relax ){ 
            for( let i = 0; i < 3 ; ++i ){
                this.curG[i].copy( this.trgG[i] );
            }
            return; 
        }
        
        // move to default pose and end
        if ( this.time > this.end ){ 
            for( let i = 0; i < 3 ; ++i ){
                this.curG[i].copy( this.defG[i] );
            }
            this.transition = false; // flag as "nothing to do"
            return; 
        }

        if ( this.time <= this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            // shouldar (back), actual shoulder, elbow
            for( let i = 0; i < 3 ; ++i ){
                this.curG[i].slerpQuaternions( this.srcG[i], this.trgG[i], t ); // expensive but finds correct path
                //nlerpQuats( this.curG[i], this.srcG[i], this.trgG[i], t ); // cheaper but does not find correct path
            }     
            return;
        }

        if ( this.time >= this.relax ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1){ t = 1; }
            t = Math.sin(Math.PI * t - Math.PI * 0.5) * 0.5 + 0.5;

            // shouldar (back), actual shoulder, elbow
            for( let i = 0; i < 3 ; ++i ){
                this.curG[i].slerpQuaternions( this.trgG[i], this.defG[i], t ); // expensive but finds correct path
                //nlerpQuats( this.curG[i], this.trgG[i], this.defG[i], t ); // cheaper  but does not find correct path
            }     
        }
    }


    /**
     * bml info
     * start, attackPeak, relax, end
     * locationArm: string from nearPoses
     * distance: (optional) [0,1] how far from the body to locate the hand. 0 = close, 1 = arm extended
     * side: (optional) string from sides table. Location will offset into that direction
     * sideDistance: (optional) how far to move the indicate side. Metres
     */
    newGestureBML( bml, symmetry = 0x00, lastFrameQuaternions = null ) {
        let tempV = new THREE.Vector3(0,0,0);
        // distance: touch vs far
        let distance = isNaN( bml.distance ) ? 0 : bml.distance;

        let location = bml.locationArm;

        // for mirror - with left arm, to point right shoulder the "shoulderL" is needed, and then quaternions must be mirrored
        // for symmetry - the left and right must be swapped
        // not only quaternions are mirrored. The left/right actions need to be swapped. All actions in table are from right arm's perspective
        if ( (this.mirror ^ ( symmetry & 0x01 ) ) && location ){ 
            if ( location[location.length-1] == "L" ){
                location = location.slice(0, location.length-1) + "R";
            } 
            else if( location[location.length-1] == "R" ){
                location = location.slice(0, location.length-1) + "L";
            } 
        }
        
        let near = nearPoses[ location ];
        let far = farPoses[ location ];
        if ( !near || !far ){
            console.warn( "Gesture: Location Arm no location found with name \"" + location + "\"" );
            return;
        }

        // Set target and source poses AND prepare skeleton for ik
        for ( let i = 0; i < near.length; ++i ){
            // source: Copy current arm state
            this.srcG[i].copy( lastFrameQuaternions ? lastFrameQuaternions[i] : this.curG[i] );

            // target (reference)
            this.trgG[i].copy( near[i] );
            // mirror target quaternion. (left arm cannot use right arms Quaternions as they are)
            if ( this.mirror ){ 
                mirrorQuatSelf( this.trgG[i] );
            }
            
            // IK - copy nearTarget into bone quaternions
            this.skeleton.bones[ this.idx + i ].quaternion.copy( this.trgG[i] ); 
        }

        // set ikTarget as lerp( nearPoint, farPoint, distance ) + side
        let pos = tempV;
        this.skeleton.bones[ this.chainInfo.chain[0] ].getWorldPosition( pos )
        this.chainInfo.target.position.x = pos.x * (1-distance) + far.x * distance;
        this.chainInfo.target.position.y = pos.y * (1-distance) + far.y * distance;
        this.chainInfo.target.position.z = pos.z * (1-distance) + far.z * distance;

        // same as in location
        let side = bml.side;
        if ( side && symmetry ){ side = directionStringSymmetry( side, symmetry ); }
        side = sides[ side ];
        if ( side ){
            let secondSide = bml.secondSide;
            if ( secondSide && symmetry ){ secondSide = directionStringSymmetry( secondSide, symmetry ); }
            secondSide = sides[ secondSide ];
            if( !secondSide ){ secondSide = side; }
            let finalSide = tempV;
            finalSide.lerpVectors( side, secondSide, 0.5 );
            finalSide.normalize(); 
            if( finalSide.lengthSq() < 0.0001 ){ finalSide.copy( side ); }

            let sideDist = isNaN( bml.sideDistance ) ? 0 : bml.sideDistance;
            this.chainInfo.target.position.x += finalSide.x * sideDist;
            this.chainInfo.target.position.y += finalSide.y * sideDist;
            this.chainInfo.target.position.z += finalSide.z * sideDist;
        }

        // Actual IK
        this.chainInfo.enabler = true;
        this.ikSolver.update();
        this.chainInfo.enabler = false;

        // Save IK results
        for ( let i = 0; i < near.length; ++i ){
            // copy results into target
            this.trgG[i].copy( this.skeleton.bones[ this.idx + i ].quaternion );
            
            // copy src (current quaternions) into bone quaternions
            this.skeleton.bones[ this.idx + i ].quaternion.copy( this.srcG[i] );
                        
            // copy src into curG (not really needed, just in case)
            this.curG[i].copy( this.srcG[i] ); 

            // change arm's default pose if necesary
            if ( bml.shift ){
                this.defG[i].copy( this.trgG[i] );
            }
        }

        // check and set timings
        this.start = bml.start || 0;
        this.end = bml.end || bml.relax || bml.attackPeak || (bml.start + 1);
        this.attackPeak = bml.attackPeak || ( (this.end - this.start) * 0.25 + this.start );
        this.relax = bml.relax || ( (this.end - this.attackPeak) * 0.5 + this.attackPeak );
        this.time = 0;
        this.transition = true;
    }   
}


let nearArmPosesTable = nearPoses;
export { LocationArmIK, nearArmPosesTable };