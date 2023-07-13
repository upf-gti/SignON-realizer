import * as THREE from "three";

import { LocationBodyArm } from "./LocationBodyArm.js";
import { Palmor } from "./Palmor.js"
import { Extfidir } from "./Extfidir.js";
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { CircularMotion, DirectedMotion, FingerPlay, WristMotion } from "./Motion.js";
import { HandConstellation } from "./HandConstellation.js";

import { findIndexOfBone, getTwistQuaternion } from "./SigmlUtils.js";
import { GeometricArmIK } from "./GeometricArmIK.js";

let bodyLocations = {

    // mixamorig_head
    head:         [ "mixamorig_Head", { x: 0.3959169, y: 3.6079083, z:16.0622060 } ],
    headtop:      [ "mixamorig_Head", { x:-0.0036508, y:17.0158691, z: 5.2952675 } ],
    forehead:     [ "mixamorig_Head", { x:-0.0038966, y: 8.9544818, z:11.4152387 } ],
    nose:         [ "mixamorig_Head", { x:-0.0039482, y: 3.0418197, z:12.6563797 } ],
    belownose:    [ "mixamorig_Head", { x:-0.0038966, y: 1.4548538, z:11.3404999 } ],
    chin:         [ "mixamorig_Head", { x:-0.1038570, y:-3.1349527, z:10.2947058 } ],
    underchin:    [ "mixamorig_Head", { x:-0.1038094, y:-5.4228805, z: 9.0718455 } ],
    mouth:        [ "mixamorig_Head", { x:-0.1039085, y:-0.4480414, z:11.6215473 } ],
    earlobeR:     [ "mixamorig_Head", { x:-7.1035518, y: 1.1415734, z: 2.6366639 } ],
    earlobeL:     [ "mixamorig_Head", { x: 7.1035518, y: 1.1415734, z: 2.6366639 } ],
    earR:         [ "mixamorig_Head", { x:-7.3965079, y: 4.1563666, z: 1.1672087 } ],
    earL:         [ "mixamorig_Head", { x: 7.3965079, y: 4.1563666, z: 1.1672087 } ],
    cheekR:       [ "mixamorig_Head", { x:-5.8962303, y: 1.0867598, z: 8.1369065 } ],
    cheekL:       [ "mixamorig_Head", { x: 5.8962303, y: 1.0867598, z: 8.1369065 } ],
    eyeR:         [ "mixamorig_Head", { x:-2.6038887, y: 6.0566197, z:11.1862465 } ],
    eyeL:         [ "mixamorig_Head", { x: 2.6038887, y: 6.0566197, z:11.1862465 } ],

    eyebrowL:     [ "mixamorig_Head", { x: 3.1557796, y: 8.1589540, z: 11.1047004 } ],
    eyebrowR:     [ "mixamorig_Head", { x:-2.8442204, y: 8.1589574, z: 11.1043666 } ],
    mouth:        [ "mixamorig_Head", { x:-0.0442315, y:-0.3426179, z: 11.2198073 } ],

    // mixamorig_neck
    neck:         [ "mixamorig_Neck", { x: 0.3777671, y: 1.6747052, z: 6.0055403 } ],

    // mixamorig_spine2
    chest:        [ "mixamorig_Spine2", { x: -0.5054647, y: 5.4415624, z:14.5946054 } ],
    shoulderLine: [ "mixamorig_Spine2", { x: -0.2040958, y:14.6415558, z: 6.4946477 } ],
    shoulderR:    [ "mixamorig_Spine2", { x:-12.8036077, y:13.8415594, z: 3.5925257 } ],
    shoulderL:    [ "mixamorig_Spine2", { x: 12.8036077, y:13.8415467, z: 3.5969393 } ],
    
    // mixamorig_spine ( not spine1 )
    stomach:      [ "mixamorig_Spine", { x: -0.0144779, y: 7.9643509, z: 12.4294767 } ],

    // hips
    belowstomach: [ "mixamorig_Hips", { x:-0.0351382, y: 7.2248580, z:12.5822406 } ],
    neutral:      [ "mixamorig_Hips", { x: 0.0158257, y: 0.0000000, z:13.6831055 } ],

}

let handLocationsR = {

    "5BaseRadial":      [ "mixamorig_RightHandPinky1"  , { x: 0.5251061 , y: 0.5654987 , z: 1.3529294 } ],
    "5BaseUlnar":       [ "mixamorig_RightHandPinky1"  , { x:-1.2321502 , y:-0.0583431 , z:-0.0179364 } ],
    "5BaseBack":        [ "mixamorig_RightHand"        , { x:-2.9410304 , y: 0.8151146 , z: 8.4601041 } ],
    "5BasePalmar":      [ "mixamorig_RightHandPinky1"  , { x: 0.2199140 , y:-1.2536127 , z: 0.4461711 } ],
    "5MidRadial":       [ "mixamorig_RightHandPinky1"  , { x: 1.0413141 , y:-0.1854853 , z: 3.0358056 } ],
    "5MidUlnar":        [ "mixamorig_RightHandPinky1"  , { x:-1.0423696 , y: 0.0240335 , z: 2.9921329 } ],
    "5MidBack":         [ "mixamorig_RightHandPinky1"  , { x:-0.1025776 , y: 1.1161265 , z: 3.0079061 } ],
    "5MidPalmar":       [ "mixamorig_RightHandPinky1"  , { x:-0.2935443 , y:-0.7496417 , z: 3.1681974 } ],
    "5PadRadial":       [ "mixamorig_RightHandPinky3"  , { x: 0.9627665 , y: 0.2537120 , z: 0.7476570 } ],
    "5PadUlnar":        [ "mixamorig_RightHandPinky3"  , { x:-0.6883316 , y:-0.1642289 , z: 0.8236484 } ],
    "5PadBack":         [ "mixamorig_RightHandPinky3"  , { x: 0.0515665 , y: 0.5928348 , z: 0.8462852 } ],
    "5PadPalmar":       [ "mixamorig_RightHandPinky3"  , { x: 0.1674805 , y:-0.5873111 , z: 1.0633256 } ],
    "5Tip":             [ "mixamorig_RightHandPinky3"  , { x: 0.2608879 , y: 0.0788924 , z: 2.0212870 } ],

    "4BaseRadial":      [ "mixamorig_RightHandRing1"   , { x: 0.6553490 , y: 0.3792948 , z: 1.4025737 } ],
    "4BaseUlnar":       [ "mixamorig_RightHandRing1"   , { x:-1.3195201 , y: 0.3890055 , z: 0.6382265 } ],
    "4BaseBack":        [ "mixamorig_RightHand"        , { x:-0.9225177 , y: 1.6171081 , z: 8.5063272 } ],
    "4BasePalmar":      [ "mixamorig_RightHandRing1"   , { x:-0.2117587 , y:-1.0649143 , z: 0.5462336 } ],
    "4MidRadial":       [ "mixamorig_RightHandRing1"   , { x: 0.9698407 , y: 0.0006531 , z: 2.8292827 } ],
    "4MidUlnar":        [ "mixamorig_RightHandRing1"   , { x:-1.1342627 , y: 0.2606719 , z: 2.8876674 } ],
    "4MidBack":         [ "mixamorig_RightHandRing1"   , { x: 0.1145003 , y: 1.2889857 , z: 2.7740036 } ],
    "4MidPalmar":       [ "mixamorig_RightHandRing1"   , { x:-0.1274852 , y:-0.6933931 , z: 2.8817882 } ],
    "4PadRadial":       [ "mixamorig_RightHandRing3"   , { x: 0.9727517 , y:-0.1870589 , z: 1.2961146 } ],
    "4PadUlnar":        [ "mixamorig_RightHandRing3"   , { x:-0.8997481 , y:-0.1906275 , z: 1.3925637 } ],
    "4PadBack":         [ "mixamorig_RightHandRing3"   , { x: 0.1834404 , y: 0.7359095 , z: 1.2176962 } ],
    "4PadPalmar":       [ "mixamorig_RightHandRing3"   , { x:-0.0158405 , y:-0.8966691 , z: 1.3064826 } ],
    "4Tip":             [ "mixamorig_RightHandRing3"   , { x: 0.1316573 , y:-0.2422216 , z: 2.7592375 } ],
   
    "3BaseRadial":      [ "mixamorig_RightHandMiddle1" , { x: 1.2929657 , y: 0.0002155 , z: 1.1589262 } ],
    "3BaseUlnar":       [ "mixamorig_RightHandMiddle1" , { x:-1.1888092 , y: 0.3240136 , z: 0.9115249 } ],
    "3BaseBack":        [ "mixamorig_RightHand"        , { x: 0.8368994 , y: 1.6904945 , z: 9.1703085 } ],
    "3BasePalmar":      [ "mixamorig_RightHandMiddle1" , { x:-0.0656171 , y:-1.0132957 , z: 0.8173608 } ],
    "3MidRadial":       [ "mixamorig_RightHandMiddle1" , { x: 1.2538066 , y: 0.0450518 , z: 3.2887734 } ],
    "3MidUlnar":        [ "mixamorig_RightHandMiddle1" , { x:-0.9742388 , y: 0.3392450 , z: 3.2546127 } ],
    "3MidBack":         [ "mixamorig_RightHandMiddle1" , { x: 0.3474564 , y: 1.2346227 , z: 3.3640404 } ],
    "3MidPalmar":       [ "mixamorig_RightHandMiddle1" , { x: 0.0542740 , y:-0.9809771 , z: 3.4052915 } ],
    "3PadRadial":       [ "mixamorig_RightHandMiddle3" , { x: 1.1472261 , y:-0.3091253 , z: 1.0405111 } ],
    "3PadUlnar":        [ "mixamorig_RightHandMiddle3" , { x:-0.9646831 , y:-0.0304962 , z: 0.9958162 } ],
    "3PadBack":         [ "mixamorig_RightHandMiddle3" , { x: 0.3523099 , y: 0.7490324 , z: 1.2245694 } ],
    "3PadPalmar":       [ "mixamorig_RightHandMiddle3" , { x: 0.1208502 , y:-1.0001253 , z: 1.2571361 } ],
    "3Tip":             [ "mixamorig_RightHandMiddle3" , { x: 0.1253345 , y:-0.1435848 , z: 2.6688592 } ],

    "2BaseRadial":      [ "mixamorig_RightHandIndex1"  , { x: 1.3198400 , y: 0.0050920 , z: 1.2297203 } ],
    "2BaseUlnar":       [ "mixamorig_RightHandIndex1"  , { x:-1.3651071 , y: 0.4819596 , z: 1.0752408 } ],
    "2BaseBack":        [ "mixamorig_RightHand"        , { x: 3.5624407 , y: 0.8504975 , z: 8.9261749 } ],
    "2BasePalmar":      [ "mixamorig_RightHandIndex1"  , { x:-0.3323884 , y:-1.1926635 , z: 0.8036411 } ],
    "2MidRadial":       [ "mixamorig_RightHandIndex1"  , { x: 1.3603987 , y:-0.0426941 , z: 3.5131530 } ],
    "2MidUlnar":        [ "mixamorig_RightHandIndex1"  , { x:-1.0403154 , y: 0.2723940 , z: 3.6533101 } ],
    "2MidBack":         [ "mixamorig_RightHandIndex1"  , { x: 0.4618646 , y: 1.2642487 , z: 3.4534198 } ],
    "2MidPalmar":       [ "mixamorig_RightHandIndex1"  , { x: 0.1532380 , y:-1.0679616 , z: 3.4100946 } ],
    "2PadRadial":       [ "mixamorig_RightHandIndex3"  , { x: 0.8227247 , y:-0.1015598 , z: 1.2345812 } ],
    "2PadUlnar":        [ "mixamorig_RightHandIndex3"  , { x:-1.0319090 , y: 0.1482259 , z: 0.9999872 } ],
    "2PadBack":         [ "mixamorig_RightHandIndex3"  , { x:-0.0075624 , y: 0.8399875 , z: 1.1902346 } ],
    "2PadPalmar":       [ "mixamorig_RightHandIndex3"  , { x:-0.1730947 , y:-0.9114550 , z: 0.8110211 } ],
    "2Tip":             [ "mixamorig_RightHandIndex3"  , { x:-0.0202782 , y: 0.1027711 , z: 2.6297720 } ],

    "1BaseRadial":      [ "mixamorig_RightHand"        , { x: 4.7562431 , y:-1.2260697 , z: 1.5055614 } ],  // same as ball of thumb
    "1BaseUlnar":       [ "mixamorig_RightHand"        , { x: 1.3702861 , y:-3.0183706 , z: 2.2998626 } ],      // same as ball of thumb
    "1BaseBack":        [ "mixamorig_RightHand"        , { x: 3.4792676 , y: 0.4944943 , z: 1.9657376 } ],      // same as ball of thumb
    "1BasePalmar":      [ "mixamorig_RightHand"        , { x: 2.5907606 , y:-3.5401768 , z: 2.0733472 } ],     // same as ball of thumb
    "1MidRadial":       [ "mixamorig_RightHandThumb1"  , { x: 0.4424290 , y:-3.0905183 , z: 3.1752274 } ],
    "1MidUlnar":        [ "mixamorig_RightHandThumb1"  , { x: 0.2235407 , y:-0.7881812 , z: 4.1131556 } ],
    "1MidBack":         [ "mixamorig_RightHandThumb1"  , { x: 1.3667223 , y:-1.4890813 , z: 4.0787640 } ],
    "1MidPalmar":       [ "mixamorig_RightHandThumb1"  , { x:-0.6161535 , y:-2.5259339 , z: 3.1655432 } ],
    "1PadRadial":       [ "mixamorig_RightHandThumb3"  , { x:-0.0379471 , y:-1.5613213 , z: 1.0968113 } ],
    "1PadUlnar":        [ "mixamorig_RightHandThumb3"  , { x:-0.6930422 , y: 0.0648075 , z: 1.7187151 } ],
    "1PadBack":         [ "mixamorig_RightHandThumb3"  , { x: 0.3389663 , y:-0.5995984 , z: 1.6720940 } ],
    "1PadPalmar":       [ "mixamorig_RightHandThumb3"  , { x:-0.9853566 , y:-1.0332310 , z: 1.0993565 } ],
    "1Tip":             [ "mixamorig_RightHandThumb3"  , { x:-0.4638723 , y:-1.2575322 , z: 2.4799788 } ],
    "ThumbballPalmar":  [ "mixamorig_RightHand"        , { x: 2.5907606 , y:-3.5401768 , z: 2.0733472 } ],
    "ThumbballBack":    [ "mixamorig_RightHand"        , { x: 3.4792676 , y: 0.4944943 , z: 1.9657376 } ],
    "ThumbballRadial":  [ "mixamorig_RightHand"        , { x: 4.7562431 , y:-1.2260697 , z: 1.5055614 } ],
    "ThumbballUlnar":   [ "mixamorig_RightHand"        , { x: 1.3702861 , y:-3.0183706 , z: 2.2998626 } ],
    "HandRadial":       [ "mixamorig_RightHand"        , { x: 5.6153129 , y:-1.5389633 , z: 3.5554788 } ],
    "HandBack":         [ "mixamorig_RightHand"        , { x: 0.8662715 , y: 1.7128415 , z: 4.2055154 } ],
    "HandUlnar":        [ "mixamorig_RightHand"        , { x:-3.4762575 , y: 0.1586214 , z: 4.6133007 } ],
    "HandPalmar":       [ "mixamorig_RightHand"        , { x: 0.3622944 , y:-1.7645729 , z: 5.1012792 } ],
    "WristPalmar":      [ "mixamorig_RightHand"        , { x:-0.1110557 , y:-2.8616360 , z: 0.1898049 } ],
    "WristBack":        [ "mixamorig_RightHand"        , { x: 0.5370626 , y: 2.0360026 , z: 0.0985964 } ],
    "WristUlnar":       [ "mixamorig_RightHand"        , { x:-2.7931947 , y: 0.8252299 , z: 0.6477307 } ],
    "WristRadial":      [ "mixamorig_RightHand"        , { x: 3.8265640 , y:-0.0619634 , z: 0.0472829 } ],
    "ForearmBack":      [ "mixamorig_RightForeArm"     , { x:-1.4641570 , y: 3.5716297 , z:17.0616244 } ],
    "ForearmPalmar":    [ "mixamorig_RightForeArm"     , { x:-1.3700196 , y:-3.3264623 , z:16.9293551 } ],
    "ForearmRadial":    [ "mixamorig_RightForeArm"     , { x: 1.8630246 , y: 0.5113126 , z:17.3152527 } ],
    "ForearmUlnar":     [ "mixamorig_RightForeArm"     , { x:-5.3040038 , y: 0.4266020 , z:16.6322266 } ],
    "ElbowFront":       [ "mixamorig_RightArm"         , { x:-2.3442696 , y: 4.4636615 , z:25.8999295 } ],
    "ElbowLeft":        [ "mixamorig_RightArm"         , { x: 1.4926081 , y: 0.8106790 , z:26.1531021 } ],
    "ElbowRight":       [ "mixamorig_RightArm"         , { x:-6.9748239 , y: 0.7080503 , z:25.4168556 } ],
    "ElbowBack":        [ "mixamorig_RightArm"         , { x:-2.2094197 , y:-5.2333591 , z:25.7007573 } ],
    "UpperarmBack":     [ "mixamorig_RightArm"         , { x:-1.7900769 , y:-6.4137155 , z:15.2699866 } ],
    "UpperarmFront":    [ "mixamorig_RightArm"         , { x:-1.9374387 , y: 4.1830286 , z:15.4876388 } ],
    "UpperarmRight":    [ "mixamorig_RightArm"         , { x:-7.3468551 , y:-0.8818424 , z:14.9085779 } ],
    "UpperarmLeft":     [ "mixamorig_RightArm"         , { x: 2.7144465 , y:-0.7598953 , z:15.7834119 } ],
}

// characterConfig is modified by bodyController
class BodyController{
    
    constructor( character, characterConfig ){
        this.character = character;

        // get skeleton
        let skeleton = this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                skeleton = this.skeleton = o.skeleton;
            }
        } );


        // reference, not a copy. All changes also affect the incoming characterConfig
        this.config = characterConfig.bodyController; 

        // name to index map. If model changes, only this map (and ik) names need to be changed
        for ( let p in this.config.boneMap ){
            this.config.boneMap[ p ] = findIndexOfBone( this.skeleton, this.config.boneMap[ p ] );            
        }

        // create location point objects and attach them to bones
        function locationToObjects( table, skeleton, symmetry = false ){
            let keys = Object.keys( table );
            let result = {};
            for( let i = 0; i < keys.length; ++i ){
                let l = table[ keys[i] ];
    
                let idx = findIndexOfBone( skeleton, symmetry ? l[0].replace( "Right", "Left" ) : l[0] );
                if ( idx < 0 ){ continue; }
    
                let o = new THREE.Object3D();
                // let o = new THREE.Mesh( new THREE.SphereGeometry(0.3,16,16), new THREE.MeshStandardMaterial( { color: Math.random()*0xffffff }) );
                o.position.copy( l[1] );
                if ( symmetry ){ o.position.x *= -1; }
                o.name = keys[i];
                skeleton.bones[ idx ].add( o );
                result[ keys[i] ] = o;
            }         
            return result;   
        }
        this.config.bodyLocations = locationToObjects( this.config.bodyLocations, this.skeleton, false );
        this.config.handLocationsL = locationToObjects( this.config.handLocationsR, this.skeleton, true ); // assume symmetric mesh/skeleton
        this.config.handLocationsR = locationToObjects( this.config.handLocationsR, this.skeleton, false ); // since this.config is being overwrite, generate left before right

        // finger axes do no need any change

        // -------------- All modules --------------
        this.right = this._createArm( false );
        this.left = this._createArm( true );
        this.handConstellation = new HandConstellation( this.config.boneMap, this.skeleton, this.config.handLocationsR, this.config.handLocationsL );


        this.dominant = this.right;
        this.nonDominant = this.left;

        this._tempQ_0 = new THREE.Quaternion();
        this._tempV3_0 = new THREE.Vector3();



        // // DEBUG
        // this.point = new THREE.Mesh( new THREE.SphereGeometry(0.005, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffff00 , depthTest:false, depthWrite: false }) );
        // this.point2 = new THREE.Mesh( new THREE.SphereGeometry(0.005, 16, 16), new THREE.MeshPhongMaterial({ color: 0xff0000 , depthTest:false, depthWrite: false }) );
        // this.point.position.set(0,1.5,0.5);
        // window.global.app.scene.add(this.point);
        // window.global.app.scene.add(this.point2);
        // this.elbowRaise = 0;
        // window.s = 1;
        // window.addEventListener( "keydown", e =>{
        //     switch( e.which ){
        //         case 37: this.point.position.x -= 0.001 * window.s; break; // left
        //         case 39: this.point.position.x += 0.001 * window.s; break; // right
        //         case 38: this.point.position.y += 0.001 * window.s; break; // up
        //         case 40: this.point.position.y -= 0.001 * window.s; break; // down
        //         case 90: this.point.position.z += 0.001 * window.s; break; //z
        //         case 88: this.point.position.z -= 0.001 * window.s; break; //x
        //         case 65: this.elbowRaise += 1 * Math.PI / 180; break; //a
        //         case 83: this.elbowRaise -= 1 * Math.PI / 180; break; //s
        //         default: break;
        //     }
        // } );
    }
    _createArm( isLeftHand = false ){
        let handName = isLeftHand ? "L" : "R";
        return {
            loc : new LocationBodyArm( this.config, this.skeleton, isLeftHand ),
            locMotions : [],
            extfidir : new Extfidir( this.config, this.skeleton, isLeftHand ),
            palmor : new Palmor( this.config, this.skeleton, isLeftHand ),
            wristMotion : new WristMotion( this.skeleton.bones[ this.config.boneMap[ handName + "Wrist"] ] ),
            handshape : new HandShapeRealizer( this.config, this.skeleton, isLeftHand ),
            fingerplay : new FingerPlay(),

            ikSolver : new GeometricArmIK( this.skeleton, this.config.boneMap[ handName  + "Shoulder" ], this.config.boneMap[ "ShouldersUnion" ], isLeftHand ),
            locUpdatePoint : new THREE.Vector3(0,0,0),
            needsUpdate: false,
            _tempWristQuat: new THREE.Quaternion(0,0,0,1), // stores computed extfidir + palmor before any arm movement applied. Necessary for locBody + handConstellation
        };
    }

    _resetArm( arm ){
        arm.loc.reset();
        arm.locMotions = [];
        arm.extfidir.reset();
        arm.palmor.reset();
        arm.wristMotion.reset();
        arm.handshape.reset();
        arm.fingerplay.reset();
        arm.locUpdatePoint.set(0,0,0);
        arm.needsUpdate = false;
    }
    
    reset(){

        this.handConstellation.reset();
        this._resetArm( this.right );
        this._resetArm( this.left );

        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationBodyArm: "neutral", hand: "right", distance: 0.065, side: "r", sideDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, locationBodyArm: "neutral", hand: "left",  distance: 0.04, side: "l", sideDistance: 0.025, shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, handshape: "flat", thumbshape: "touch", hand: "both", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "l", hand: "right", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, palmor: "r", hand: "left", shift: true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "dl", hand: "right", mode: "local", shift:true } );
        this.newGesture( { type: "gesture", start: 0, end: 0.1, extfidir: "dr", hand: "left", mode: "local", shift:true } );

    }

    setDominantHand( isRightHandDominant ){
        if( isRightHandDominant ){ this.dominant = this.right; this.nonDominant = this.left; }
        else{ this.dominant = this.left; this.nonDominant = this.right; }
    }

    _updateLocationMotions( dt, arm ){
        let computeFlag = false;

        let motions = arm.locMotions;
        let resultOffset = arm.locUpdatePoint;
        resultOffset.set(0,0,0);

        // check if any motion is active and update it
        for ( let i = 0; i < motions.length; ++i ){
            if ( motions[i].transition ){
                computeFlag = true;
                resultOffset.add( motions[i].update( dt ) );
            }else{
                motions.splice(i, 1); // removed motion that has already ended
                i--;
            }
        }
        return computeFlag; 
    }

    _updateArm( dt, arm ){
        let bones = this.skeleton.bones;

        // reset shoulder, arm, elbow. This way location body, motion and location hand can be safely computed
        bones[ arm.loc.idx ].quaternion.set(0,0,0,1);
        bones[ arm.loc.idx + 1 ].quaternion.set(0,0,0,1);
        bones[ arm.loc.idx + 2 ].quaternion.set(0,0,0,1);

        // overwrite finger rotations
        arm.fingerplay.update(dt); // motion, prepare offsets
        arm.handshape.update( dt, arm.fingerplay.curBends );

        // wrist extfidir
        bones[ arm.extfidir.idx ].quaternion.set(0,0,0,1);
        arm.extfidir.update( dt );
        bones[ arm.extfidir.idx ].quaternion.copy( arm.extfidir.curG );
        

        // wrist (and forearm) twist
        arm.palmor.update( dt );
        let q = this._tempQ_0;
        let palmorAngle = arm.palmor.curAngle * arm.extfidir.curPalmorRefactor
        q.setFromAxisAngle( arm.palmor.twistAxisWrist, palmorAngle ); // wrist
        bones[ arm.palmor.idx + 1 ].quaternion.multiply( q );
        
        // wristmotion. ADD rotation to wrist
        arm.wristMotion.update(dt); // wrist - add rotation

        // backup the current wrist quaternion, before any arm rotation is applied
        arm._tempWristQuat.copy( bones[ arm.extfidir.idx ].quaternion );

        // update arm posture world positions but do not commit results to the bones, yet.
        arm.loc.update( dt );
        let motionsRequireUpdated = this._updateLocationMotions( dt, arm );
        

        arm.needsUpdate = motionsRequireUpdated | arm.fingerplay.transition | arm.handshape.transition | arm.wristMotion.transition | arm.palmor.transition | arm.extfidir.transition | arm.loc.transition;
    }

    update( dt ){
        if ( !this.right.needsUpdate && !this.left.needsUpdate && !this.handConstellation.transition ){ return; }
            
        this._updateArm( dt, this.right );
        this._updateArm( dt, this.left );
        
        if ( this.handConstellation.transition ){ 
            // 2 iks, one for body positioning and a second for hand constellation + motion
            // if only points in hand were used in handConstellation, the first ik could be removed. But forearm-elbow-upperarm locations require 2 iks

            // compute locBody and fix wrist quaternion (forearm twist correction should not be required. Disable it and do less computations)
            // using loc.cur.p, without the loc.cur.offset. Compute handConstellation with raw locBody
            this.right.ikSolver.reachTarget( this.right.loc.cur.p, this.right.loc.cur.e, false ); //ik without aesthetics. Aesthetics might modify 
            this.left.ikSolver.reachTarget( this.left.loc.cur.p, this.left.loc.cur.e, false );
            this._fixWristForearmQuaternions( this.right, true );
            this._fixWristForearmQuaternions( this.left, true );

            // handconstellation update, add motions and ik
            this.handConstellation.update( dt );
            this.right.locUpdatePoint.add( this.handConstellation.curOffsetR ); // HandConstellation + motions
            this.left.locUpdatePoint.add( this.handConstellation.curOffsetL ); // HandConstellation + motions
        }

        // if only location body and motions. Do only 1 ik per arm
        this.right.locUpdatePoint.add( this.right.loc.cur.p );
        this.right.locUpdatePoint.add( this.right.loc.cur.offset );
        this.right.ikSolver.reachTarget( this.right.locUpdatePoint, this.right.loc.cur.e, true ); // ik + aesthetics

        this.left.locUpdatePoint.add( this.left.loc.cur.p );
        this.left.locUpdatePoint.add( this.left.loc.cur.offset );
        this.left.ikSolver.reachTarget( this.left.locUpdatePoint, this.left.loc.cur.e, true ); // ik + aesthetics
    
        this._fixWristForearmQuaternions( this.right, false );   
        this._fixWristForearmQuaternions( this.left, false );  
        
    }

    _fixWristForearmQuaternions( arm, fixWristOnly = false ){
        let q = this._tempQ_0;
        let bones = this.skeleton.bones;

        // copy back the original wrist quaternion, when no arm rotations were applied
        bones[ arm.extfidir.idx ].quaternion.copy( arm._tempWristQuat );  

        // wrist did not know about arm quaternions. Compensate them
        q.copy( bones[ arm.loc.idx ].quaternion );
        q.multiply( bones[ arm.loc.idx + 1 ].quaternion );
        q.multiply( bones[ arm.loc.idx + 2 ].quaternion );
        q.invert();
        bones[ arm.extfidir.idx ].quaternion.premultiply( q );  
        
        if ( fixWristOnly ){ return } // whether to correct forearm twisting also
        
        // Doing the previous wrist fix introduces some extra twist correction. Forearm twist should adjust to palmor + twist correction. The following operations combine both
        // get wrist twist quaternion
        getTwistQuaternion( bones[ arm.extfidir.idx ].quaternion, arm.palmor.twistAxisWrist, q );

        // from wrist twist quaternion, compute twist angle and apply it to the forearm. Correct this extra quaternion for the wrist also
        let angle = Math.acos( q.w ) * 2;
        // angle = Math.max( 0, Math.min( Math.PI * 0.6, angle ) );
        angle = ( Math.sin( angle - Math.PI * 0.5 ) * 0.35 + 0.35 ) * angle; // limit angle to avoid overtwisting of elbow
        angle *= ( arm.palmor.twistAxisForeArm.x * q.x + arm.palmor.twistAxisForeArm.y * q.y + arm.palmor.twistAxisForeArm.z * q.z ) < 0 ? -1 : 1; // is the axis of rotation inverted ?
        q.setFromAxisAngle( arm.palmor.twistAxisForeArm, angle);
        bones[ arm.palmor.idx ].quaternion.multiply( q ); // forearm
        bones[ arm.extfidir.idx ].quaternion.premultiply( q.invert() ); // wrist did not know about this twist, undo it

    }

    _newGestureArm( bml, arm, symmetry = 0x00 ){
        if ( bml.locationBodyArm ){ // when location change, cut directed and circular motions
            arm.loc.newGestureBML( bml, symmetry, arm.locUpdatePoint );
            arm.locMotions = [];
            this.handConstellation.cancelArm( arm == this.right ? 'R' : 'L' );
        }
        if ( bml.motion ){
            let m = null;
            if ( bml.motion == "fingerplay"){ m = arm.fingerplay; }
            else if ( bml.motion == "wrist"){ m = arm.wristMotion; }
            else if ( bml.motion == "directed"){ m = new DirectedMotion(); arm.locMotions.push(m); }
            else if ( bml.motion == "circular"){ m = new CircularMotion(); arm.locMotions.push(m); }
            
            if( m ){ 
                m.newGestureBML( bml, symmetry );
            }
        }
        if ( bml.palmor ){
            arm.palmor.newGestureBML( bml, symmetry );
        }
        if ( bml.extfidir ){
            arm.extfidir.newGestureBML( bml, symmetry );
        }
        if ( bml.handshape ){
            arm.handshape.newGestureBML( bml, symmetry );
        } 

        arm.needsUpdate = true;
    }

    /**
    * lrSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * udSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * ioSym: (optional) bool - perform a symmetric movement. Symmetry will be applied to non-dominant hand only
    * hand: (optional) "right", "left", "both". Default right
    * shift: (optional) bool - make this the default position. Motions not affected
    */
    newGesture( bml ){
        // symmetry: bit0 = lr, bit1 = ud, bit2 = io
        let symmetryFlags = ( !!bml.lrSym );
        symmetryFlags |= ( ( !!bml.udSym ) << 1 );
        symmetryFlags |= ( ( !!bml.ioSym ) << 2 );

        if ( bml.dominant ){
            this.setDominantHand( bml.dominant == "right" );
        }

        if ( bml.handConstellation ){
            this.handConstellation.newGestureBML( bml, this.dominant == this.right ? 'R' : 'L' );
        }

        switch ( bml.hand ){
            case "right" :             
                this._newGestureArm( bml, this.right, ( this.dominant == this.right ) ? 0x00 : symmetryFlags ); 
                break;
            case "left" : 
                this._newGestureArm( bml, this.left, ( this.dominant == this.left ) ? 0x00 : symmetryFlags ); 
                break;
            case "both" : 
                this._newGestureArm( bml, this.dominant, 0x00 ); 
                this._newGestureArm( bml, this.nonDominant, symmetryFlags ); 
                break;
            case "nonDom" : 
                this._newGestureArm( bml, this.nonDominant, symmetryFlags ); 
                break;
            case "dom": 
            default:
                this._newGestureArm( bml, this.dominant, 0x00 ); 
                break;
        }

    }


}


export { BodyController };


