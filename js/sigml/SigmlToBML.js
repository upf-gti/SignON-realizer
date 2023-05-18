// sigmlStringToBML translate from a sigml (xml) string (valid in jasigning) to a bml. It is an approximate solution.

// missing location_hand (and handconstellation)
// missing rpt_motion
// non manual features parser system already implemented. Missing several non manual features tables 


/* 

AFPAKKEN
AANPASSEN
BABYSITTEN
*/


let TIMESLOT ={
    DEF: 1,

    POSTURE: 0.5,
    LOC: 0.5,
    HAND: 0.5,

    MOTION: 1,
    MOTIONDIR : 0.5,
    MOTIONCIRC : 1.5,
}


function sigmlStringToBML( str, timeOffset = 0 ) {
    let parser = new DOMParser();
    let xmlDoc = null;

    let msg = [];
    timeOffset = (isNaN(timeOffset)) ? 0 : timeOffset;
    let time = timeOffset;

    try{
        xmlDoc = parser.parseFromString( str, "text/xml" ).children[0];
    }catch( error ){
        return { data: [], duration: 0 };
    }

    // for each hamnosis sign
    for( let i = 0; i < xmlDoc.children.length ; ++i ){
        if( xmlDoc.children[i].tagName != "hns_sign" && xmlDoc.children[i].tagName != "hamgestural_sign" ){ continue; }
        let result = hnsSignParser( xmlDoc.children[i], time );
        time = result.end;
        msg = msg.concat( result.data );
    }

    return { data: msg, duration: ( time - timeOffset ) };
}


function hnsSignParser( xml, start ){
    let result = [];
    let nonManualDone = false;
    let manualDone = false;
    let end = start;

    for ( let i = 0; i < xml.children.length; ++i ){
        if ( !nonManualDone && xml.children[i].tagName == "sign_nonmanual" ){
            let r = signNonManual( xml.children[i], start );
            result = result.concat( r.data );
            if ( end < r.end ){ end = r.end; }
            nonManualDone = true;
        }
        if ( !manualDone && xml.children[i].tagName == "sign_manual" ){
            let r = signManual( xml.children[i], start );
            result = result.concat( r.data );
            if (end < r.end ){ end = r.end; }
            manualDone = true;
        }
    }
    return { data: result, end: end }; 
}


// ###############################################
// #                Manual Parser                #
// ###############################################


let simpleMotionAvailable = [ "directedmotion", "circularmotion", "wristmotion", "crossmotion", "fingerplay", "changeposture", "nomotion" ]; // crossmotion deprecated
let motionsAvailable = simpleMotionAvailable.concat( [ "nonman_motion", "par_motion", "seq_motion", "split_motion", "rpt_motion", "tgt_motion" ] ); // missing tgt, rpt and timing issues
let posturesAvailable = [ "handconfig", "split_handconfig", "location_bodyarm", "split_location", "location_hand", "handconstellation" , "use_locname"]; // missing location_hand, handconstellation, use_locname(????) 

// this function and structure is only needed because rpt_motion needs to know the src pose to witch return during repetitions
function currentPostureUpdate( oldPosture, newOrders, overwrite = false ){
    let newPosture;
    if ( !oldPosture ){
        newPosture = [ // set the bodyController neutral pose as an array [ armR, armL, extfidirR, extfidirL, palmorR, palmorL, handshapeR, handshapeL ]
            { type: "gesture", start: -1, locationArm: "neutral", hand: "right", distance: 0.065, side: "dl", sideDistance: 0.025 }, 
            { type: "gesture", start: -1, locationArm: "neutral", hand: "left",  distance: 0.04, side: "r", sideDistance: 0.025 }, 
            { type: "gesture", start: -1, extfidir: "do", secondExtfidir: "o", hand: "right", mode: "local" }, 
            { type: "gesture", start: -1, extfidir: "do", secondExtfidir: "o", hand: "left", mode: "local" }, 
            { type: "gesture", start: -1, palmor: "d", secondPalmor: "dr", hand: "right" }, 
            { type: "gesture", start: -1, palmor: "dl", hand: "left" }, 
            { type: "gesture", start: -1, handshape: "flat", thumbshape: "touch", hand: "right" }, 
            { type: "gesture", start: -1, handshape: "flat", thumbshape: "touch", hand: "left" }, 
        ]
    }
    else if ( overwrite ){ newPosture = oldPosture; }
    else { newPosture = JSON.parse( JSON.stringify( oldPosture ) ); }

    // check all new orders
    for( let i = 0; i < newOrders.length; ++i ){
        let o = newOrders[i];
        let type = -1;
        if ( o.locationArm ){ type = 0; }
        else if ( o.extfidir ){ type = 2; }
        else if ( o.palmor ){ type = 4; }
        else if ( o.handshape ){ type = 6; }

        // if a new order has a bigger start than the old posture, it becomes the new posture
        if( type > -1 ){
            if ( ( o.hand == "right" || o.hand == "both" ) && newPosture[ type ].start < o.start ){
                newPosture[ type ] = JSON.parse( JSON.stringify( o ) ); // copy object, not reference
                newPosture[ type ].hand = "right";
                delete newPosture[ type ].attackPeak; // just in case
                delete newPosture[ type ].relax;
                delete newPosture[ type ].end;
            }
            if ( ( o.hand == "left" || o.hand == "both" ) && newPosture[ type + 1 ].start < o.start ){
                newPosture[ type + 1 ] = JSON.parse( JSON.stringify( o ) ); // copy object, not reference
                newPosture[ type + 1 ].hand = "left";
                delete newPosture[ type ].attackPeak; // just in case
                delete newPosture[ type ].relax;
                delete newPosture[ type ].end;
            }
        }
    }

    return newPosture;
}
// missing location_hand (and handconstellation), motions except simpleMotion
function signManual( xml, start ){
    let result = [];
    let time = start;
    let actions = xml.children;

    // parse xml attributes
    let attributes = {}
    for( let attr = 0; attr < xml.attributes.length; ++attr ){
        attributes[ xml.attributes[attr].name ] = xml.attributes[attr].value;
    }
    
    let domHand = "right";
    let bothHands = attributes.both_hands == "true";
    let lrSym = attributes.lr_symm == "true";
    let oiSym = attributes.oi_symm == "true";
    let udSym = attributes.ud_symm == "true";
    let symmetry = lrSym | ( udSym << 1 ) | ( oiSym << 2 );

    let motionsStarted = false; // (JASIGNING) when motion instructions start, no handconfig or location are taken into account. Also time starts adding

    result.push( { type: "gesture", dominant: domHand } );

    let currentPosture = currentPostureUpdate( null, [] );

    for ( let i = 0; i < actions.length; ++i ){
        let action = actions[i];
        let tagName = actions[i].tagName;

        if ( !motionsStarted ){
            if ( posturesAvailable.includes( tagName ) ){
                let r = postureParser( action, time, bothHands, domHand, symmetry );
                result = result.concat( r.data );
                // do not advance time. All postures should happen at the same time
            }
        }
        if ( motionsAvailable.includes( tagName ) ){
            if( !motionsStarted && result.length > 1 ){ 
                currentPosture = currentPostureUpdate( currentPosture, result );
                time += TIMESLOT.LOC; 
            }
            motionsStarted = true; // locations and handconfigs will no longer be accepted for this sign
            let r = motionParser( action, time, bothHands, domHand, symmetry, currentPosture );
            result = result.concat( r.data );
            if ( time < r.end ) { time = r.end; }
        }
    }

    time += TIMESLOT.DEF; // add an extra time for all ending instrunctions' attackPeak-realx stage

    // these actions should last for the entirety of the sign. If there is a change mid sign, the new will overwrite the previous, so no problem with conflicting ends 
    for ( let i = 0; i < result.length; ++i ){
        if ( result[i].extfidir || result[i].palmor || result[i].handshape || result[i].locationArm ){ 
            if ( isNaN( result[i].relax ) ){ result[i].relax = time; }
            if ( isNaN( result[i].end ) ){ result[i].end = time + TIMESLOT.DEF; }
        }
        if ( result[i].motion == "directed" ){ 
            // result[i].attackPeak = result[i].start + TIMESLOT.MOTIONDIR;
            if ( isNaN( result[i].relax ) ){ result[i].relax = time; }
            if ( isNaN( result[i].end ) ){ result[i].end = time + TIMESLOT.DEF; }
        }
        if ( result[i].motion == "wrist" ){ 
            let dt = 0.15 * ( result[i].end - result[i].start );
            result[i].attackPeak = result[i].start + ( ( dt < 0.15 ) ? dt : 0.15 ); // entry not higher than 150 ms
            result[i].relax = result[i].end - ( ( dt < 0.15 ) ? dt : 0.15 ) ;
        }
    }

    time += TIMESLOT.DEF; // add an extra time for all ending instructions relax-end

    
    return { data: result, end: time };
}


function postureParser( xml, start, bothHands, domHand, symmetry ){
    // shape of pose until the end of the sign or a tgt motion
    let result = [];
    let tagName = xml.tagName;
    let maxEnd = 0;
    let time = start;

    if ( tagName == "handconfig" ){
        result = result.concat( handconfigParser( xml, time, time + TIMESLOT.HAND, bothHands ? "both" : domHand, symmetry ) );
        maxEnd = TIMESLOT.HAND;
    }  
    else if ( tagName == "split_handconfig" ){ // split instruction removes any symmetry. Both_hands attribute does not matter
        if ( xml.children.length > 0 && xml.children[0].tagName == "handconfig" ){
            result = result.concat( handconfigParser( xml.children[0], time, time + TIMESLOT.HAND, domHand, 0x00 ) );
            maxEnd = TIMESLOT.HAND;
        }
        if ( xml.children.length > 1 && xml.children[1].tagName == "handconfig" ){
            result = result.concat( handconfigParser( xml.children[1], time, time + TIMESLOT.HAND, domHand == "right" ? "left" : "right", 0x00 ) );
            maxEnd = TIMESLOT.HAND;
        }
    }
    
    else if ( tagName == "location_bodyarm" ){ 
        result = result.concat( locationArmParser( xml, time, time + TIMESLOT.LOC, bothHands ? "both" : domHand, symmetry ) );
        maxEnd = TIMESLOT.LOC;
    }
    else if ( tagName == "split_location" ){ // can be location_hand or location_bodyarm. // split instruction removes any symmetry.  Both_hands attribute does not matter
        if ( xml.children.length > 0 && xml.children[0].tagName == "location_bodyarm" ){
            result = result.concat( locationArmParser( xml.children[0], time, time + TIMESLOT.LOC, domHand, 0x00 ) );
            maxEnd = TIMESLOT.LOC;
        }
        if ( xml.children.length > 1 && xml.children[1].tagName == "location_bodyarm" ){
            result = result.concat( locationArmParser( xml.children[1], time, time + TIMESLOT.LOC, domHand == "right" ? "left" : "right", 0x00 ) );
            maxEnd = TIMESLOT.LOC;
        }
        // if ( xml.children.length > 0 && xml.children[0].tagName == "location_hand" ){ }
        // if ( xml.children.length > 1 && xml.children[1].tagName == "location_hand" ){ }
    }
    else if ( tagName == "handconstellation" ){ 
        // <!ELEMENT  handconstellation  (  (location_hand, location_hand)?, location_bodyarm? )>
        for( let i = 0; ( i < 3 ) && ( i < xml.children.length ); ++i ){
            if ( i < 2 && xml.children[i].tagName == "location_hand" ){        }
            else if ( xml.children[i].tagName == "location_bodyarm" ){
                result = result.concat( locationArmParser( xml.children[i], time, time + TIMESLOT.LOC, "both", 0x00 ) );
                maxEnd = TIMESLOT.LOC;
                break;
            }

        }
    } 
    // else if ( tagName == "location_hand" ){ }

    return { data: result, end: ( maxEnd + start ) };
}
// in JaSigning the handconfig lasts until the end of the sign/gloss or until another instruction overwrites it
function handconfigParser( xml, start, attackPeak, hand, symmetry ){
    let attributes = {}
    for( let attr = 0; attr < xml.attributes.length; ++attr ){
        attributes[ xml.attributes[attr].name ] = xml.attributes[attr].value;
    }

    let result = [];
    if ( attributes.handshape || attributes.thumbpos ){ 
        let obj = { type: "gesture", start: start, attackPeak: attackPeak, hand: hand };
        obj.handshape = attributes.handshape || "flat";
        obj.thumbshape = attributes.thumbpos;
        if ( !obj.thumbshape ){ obj.thumbshape = attributes.second_thumbpos; }
        result.push( obj );
    }
    if ( attributes.extfidir ){
        let obj = { type: "gesture", start: start, attackPeak: attackPeak, hand: hand };
        obj.extfidir = attributes.extfidir;
        obj.secondExtfidir = attributes.second_extfidir;
        obj.mode = "relative";
        obj.lrSym = symmetry & 0x01;
        obj.udSym = symmetry & 0x02;
        obj.oiSym = symmetry & 0x04;
        result.push( obj );
    }
    if ( attributes.palmor ){
        let obj = { type: "gesture", start: start, attackPeak: attackPeak, hand: hand };
        obj.palmor = attributes.palmor;
        obj.secondPalmor = attributes.second_palmor;
        obj.lrSym = symmetry & 0x01;
        obj.udSym = symmetry & 0x02;
        obj.oiSym = symmetry & 0x04;
        result.push( obj );

    }
    return result;
}


let locationMap ={
    head: "forehead", 
    headtop: "headtop",
    forehead: "forehead",
    eyebrows: "eye",
    eyes: "eye",
    uppereyelid: "eye",
    lowereyelid: "eye",
    nose: "nose",
    nostrils: "nose",
    lips: "mouth",
    upperlip: "mouth",
    lowerlip: "mouth",
    tongue: "mouth",
    teeth: "mouth",
    upperteeth: "mouth",
    lowerteeth: "mouth",
    chin: "chin",
    underchin: "chin",
    neck: "neck",
    shoulders: "shoulder",
    shouldertop: "shoulder",
    chest: "chest",
    stomach: "stomach",
    belowstomach: "belowstomach",
    ear: "ear",
    earlobe: "ear",
    cheek: "cheek"
}

let locationSideMap = {
    left_beside: { side: "l", sideDistance: 0.1 },
    left_at: { side: "l", sideDistance: 0.05 },
    right_at: { side: "r", sideDistance: 0.05 },
    right_beside: { side: "r", sideDistance: 0.1 },
    front: { side: "o", sideDistance: 0.05 },
    back: { side: "i", sideDistance: 0.05 },
    dorsal: null,
    palmar: null,
    radial: null,
    ulnar: null,
}

// in JaSigning the location lasts until the end of the sign/gloss or until another instruction overwrites it
function locationArmParser( xml, start, attackPeak, hand, symmetry ){
    let attributes = {}
    for( let attr = 0; attr < xml.attributes.length; ++attr ){
        attributes[ xml.attributes[attr].name ] = xml.attributes[attr].value;
    }

    let result = { type: "gesture", start: start, attackPeak: attackPeak, hand: hand };

    // jasigning does not have symmetry on this instruction
    result.lrSym = false; // symmetry & 0x01;  
    result.udSym = false; // symmetry & 0x02;  
    result.oiSym = false; // symmetry & 0x04;  

    if ( attributes.contact == "touch" ){ result.distance = 0.0; }
    else if ( attributes.contact == "close" ){ result.distance = 0.1; }
    else if ( attributes.contact == "armextended" ){ result.distance = 0.9; }
    else { result.distance = 0.35; } // jasigning has a default unmentioned distance...

    let side = locationSideMap[ attributes.side ];
    if ( side ){
        result.side = side.side;
        result.sideDistance = side.sideDistance;    
    }

    let loc =locationMap[ attributes.location ];

    result = [ result ];

    if( hand == "both" ){
        if( loc == "cheek" || loc == "ear" || loc == "eye" || loc== "shoulder" ){     
            result.push( JSON.parse( JSON.stringify( result[0] ) ) );
            result[0].hand = "right";
            result[1].hand = "left";
            result[0].locationArm = loc + "R";
            result[1].locationArm = loc + "L";

            if ( loc == "shoulder" ){ // move towards instead of appart
                result.push( { type:"gesture", start:start + 0.0001, attackPeak: start + TIMESLOT.LOC, motion:"directed", direction: "l", distance:0.05, hand: "right" } );
                result.push( { type:"gesture", start:start + 0.0001, attackPeak: start + TIMESLOT.LOC, motion:"directed", direction: "r", distance:0.05, hand: "left" } ); 
            }
        }else{
            // mov appart. Visually more similar to jasigning
            result[0].locationArm = loc;
            result.push( { type:"gesture", start:start + 0.0001, attackPeak: start + TIMESLOT.LOC, motion:"directed", direction: "r", distance:0.05, hand: "right" } );
            result.push( { type:"gesture", start:start + 0.0001, attackPeak: start + TIMESLOT.LOC, motion:"directed", direction: "l", distance:0.05, hand: "left" } ); 
        }

    }else{
        if( loc == "cheek" || loc == "ear" || loc == "eye" || loc== "shoulder" ){ loc += (hand == "right")?'R':'L'; }
        result[0].locationArm = loc;

        // jasigning has an offset for each arm 
        result.push( { type:"gesture", start:start + 0.0001, attackPeak: start + TIMESLOT.LOC, motion:"directed", direction: (hand=="right")?"r":"l", distance:0.05, hand: hand } ); 
    }


    return result;
}


function motionParser( xml, start, bothHands, domHand, symmetry, currentPosture ){
    let result = [];
    let time = start;
    let tagName = xml.tagName;

    if ( simpleMotionAvailable.includes( tagName ) ){
        let r = simpleMotionParser( xml, time, bothHands ? "both" : domHand, symmetry );
        result = result.concat( r.data );
        time = r.end;
    }
    else if ( tagName == "split_motion" ){ // split instruction removes any symmetry. Both_hands flag does not matter
        //<!ELEMENT split_motion ( ( %motion; ), ( %motion; ) ) >

        let maxEnd = time;
        // JaSigning breaks if one motion is missing, but not supporting it now.
        if ( xml.children.length > 0 && motionsAvailable.includes( xml.children[0].tagName ) ){
            let r = motionParser( xml.children[0], time, false, domHand, 0x00, currentPosture );
            result = result.concat( r.data );
            if( maxEnd < r.end ){ maxEnd = r.end; }
        }
        if ( xml.children.length > 1 && motionsAvailable.includes( xml.children[1].tagName ) ){
            let r = motionParser( xml.children[1], time, false, domHand == "right" ? "left" : "right", 0x00, currentPosture );
            result = result.concat( r.data );
            if( maxEnd < r.end ){ maxEnd = r.end; }
        }
        time = maxEnd;
    }
    else if ( tagName == "seq_motion" ){
        // <!ELEMENT seq_motion ( ( %motion; ), ( %motion; )+ ) >

        for( let i = 0; i < xml.children.length; ++i ){
            if ( motionsAvailable.includes( xml.children[i].tagName ) ){
                if ( xml.children[i].tagName == "rpt_motion" ){
                    currentPosture = currentPostureUpdate( currentPosture, result );    
                }
                let r = motionParser( xml.children[i], time, bothHands, domHand, symmetry, currentPosture );
                result = result.concat( r.data );
                time = r.end;
            }
        }
    }
    else if ( tagName == "par_motion" ){
        // <!ELEMENT par_motion ( ( %motion; ), ( %motion; )+ ) >

        let maxEnd = time;
        let blockResult = []; // block == motion with children 
        for ( let i = 0; i < xml.children.length; ++i ){
            if ( motionsAvailable.includes( xml.children[i].tagName ) ){
                let r = motionParser( xml.children[i], time, bothHands, domHand, symmetry, currentPosture );
                blockResult.push( r );
                if ( maxEnd < r.end ){ maxEnd = r.end; }
            }
        }

        // remap bml instructions to the slowest block (motion might have nesting)
        for ( let i = 0; i < blockResult.length; ++i ){
            let block = blockResult[i];
            remapBlockTiming( time, block.end, time, maxEnd, block.data );
            result = result.concat( block.data );
        }
        time = maxEnd;
    }
    else if ( tagName == "tgt_motion" ){
        // <!ELEMENT tgt_motion ( ( %motion; ), ( %posture; ) ) >

        let motionDone = false;
        let maxEnd = time;
        let blockResult = []; // block == motion with children 
        for ( let i = 0; i < xml.children.length; ++i ){
            if ( motionsAvailable.includes( xml.children[i].tagName ) ){
                if ( motionDone ) { break; } // if a second motion is present, all subsequent postures are ignored
                else {
                    let r = motionParser( xml.children[i], time, bothHands, domHand, symmetry, currentPosture );
                    blockResult.push( r );
                    if ( maxEnd < r.end ){ maxEnd = r.end; } 
                    motionDone = true;   
                } 
            }
            else if ( posturesAvailable.includes( xml.children[i].tagName ) ){
                motionDone = true;   
                let r = postureParser( xml.children[i], time, bothHands, domHand, symmetry );
                blockResult.push( r );
                if ( maxEnd < r.end ){ maxEnd = r.end; } 
            }
        }

        // remap bml instructions to the slowest block (motion might have nesting)
        for ( let i = 0; i < blockResult.length; ++i ){
            let block = blockResult[i];
            remapBlockTiming( time, block.end, time, maxEnd, block.data );
            result = result.concat( block.data );
        }
        time = maxEnd;
    }
    else if ( tagName == "rpt_motion" ){ // TO DO
        // <!ELEMENT rpt_motion ( %motion; ) >

        if ( xml.children.length > 0 && motionsAvailable.includes( xml.children[0].tagName ) ){
            let r = motionParser( xml.children[0], time, bothHands, domHand, symmetry, currentPosture );
            let blockDuration = r.end - time;
            
            let repetition = "";
            for( let attr = 0; attr < xml.attributes.length; ++attr ){
                if ( xml.attributes[attr].name == "repetition" ){ repetition = xml.attributes[attr].value; }
            }
            
            switch ( repetition ){
                case "fromstart":  /* forward. Then go directly to the original pose. Forward. Repeat completed */ 
                case "fromstart_several":
                case "manyrandom": /* forward. Then go directly to the original pose. Forward. Repeat completed*/
                    let amountLoops = ( repetition == "fromstart" ) ? 1 : 2;
                    for( let loop = 0; loop < amountLoops; ++loop ){
                        
                        // forward
                        let forward = JSON.parse( JSON.stringify( r.data ) ); 
                        for( let i = 0; i < forward.length; ++i ){
                            if( !isNaN( forward[i].start ) ){ forward[i].start += loop * ( blockDuration + TIMESLOT.POSTURE ); } 
                            if( !isNaN( forward[i].attackPeak ) ){ forward[i].attackPeak += loop * ( blockDuration + TIMESLOT.POSTURE ); } 
                            if( !isNaN( forward[i].ready ) ){ forward[i].ready += loop * ( blockDuration + TIMESLOT.POSTURE ); } 
                            if( !isNaN( forward[i].relax ) ){ forward[i].relax += loop * ( blockDuration + TIMESLOT.POSTURE ); } 
                            if( !isNaN( forward[i].end ) ){ forward[i].end += loop * ( blockDuration + TIMESLOT.POSTURE ); } 
                            else{ forward[i].end = time + blockDuration + TIMESLOT.POSTURE; } // if no end, force an end in combination with backward pass
                        }
                        result = result.concat( forward );

                        time += blockDuration; // add forward time

                        // backward
                        let p = JSON.parse( JSON.stringify( currentPosture ) );
                        for( let i = 0; i < p.length; ++i ){
                            p[i].start = time;
                            p[i].attackPeak = time + TIMESLOT.POSTURE;
                        }
                        result = result.concat( p );
                        // location_bodyarm fix to resemble jasigning
                        if ( p[0].locationArm != "neutral" ) { 
                            let d = { type:"gesture", start: time + 0.0001, attackPeak: time + TIMESLOT.POSTURE, motion:"directed", direction: "r", distance:0.05, hand:"right" }; 
                            if ( p[0].locationArm == "shoulderR" ){ d.direction = "l"; } // move towards instead of appart
                            result.push( d );
                        }
                        if ( p[1].locationArm != "neutral" ) { 
                            let d = { type:"gesture", start: time + 0.0001, attackPeak: time + TIMESLOT.POSTURE, motion:"directed", direction: "l", distance:0.05, hand:"left" };
                            if ( p[1].locationArm == "shoulderL" ){ d.direction ="r"; } // move towards instead of appart
                            result.push( d );
                        }
                        
                        time += TIMESLOT.POSTURE; // add backward time
                    }

                    // forward
                    let finalForward = r.data;
                    let offset = amountLoops * ( blockDuration + TIMESLOT.POSTURE );
                    for( let i = 0; i < finalForward.length; ++i ){
                        if( !isNaN( finalForward[i].start ) ){ finalForward[i].start += offset; } 
                        if( !isNaN( finalForward[i].attackPeak ) ){ finalForward[i].attackPeak += offset; } 
                        if( !isNaN( finalForward[i].ready ) ){ finalForward[i].ready += offset; } 
                        if( !isNaN( finalForward[i].relax ) ){ finalForward[i].relax += offset; } 
                        if( !isNaN( finalForward[i].end ) ){ finalForward[i].end += offset; } 
                    }
                    result = result.concat( finalForward );
                    
                    time += blockDuration; // add forward time

                    break;
                case "tofroto": /* forward. inverse of everything. forward again */ 
                    // timings during reverse are inverted

                    // circular:  swap endAngle and startAngle
                    // directed:  use sigmlutils.directionStringSymmetry with all symmetry set to the direction (curve should not be necessary)
                    // wrist and fingerplay: nothing special

                    // posture: be careful with start and attackpeak timings
                break;
                case "reverse": /* tofroto without last forward. So only forward, backward */ break;
                case "continue": /* forward. keeps directed. After each repetition, quickly go to original posture. Forward. */ 
                case "continue_several":
                    // same as fromstart but keeps directedmotion offset. Remember we remove directed and circular after each location_bodyarm on our realizer
                break;
                case "swap": /* no repetition, may be deprecated. Use default */
                default:
                    result = result.concat( r.data );
                    time += blockDuration; // add forward time
                    break;
            }

        }
    }

    return{ data: result, end: time }
}

// necessary for nesting such in tgt and par
function remapBlockTiming ( srcStart, srcEnd, dstStart, dstEnd, bmlArray ){
    for( let i = 0; i < bmlArray.length; ++i ){
        let bml = bmlArray[i];
        let f = ( bml.start - srcStart ) / ( srcEnd - srcStart ); 
        bml.start = dstStart * ( 1.0 - f ) + dstEnd * f ;
        if ( bml.locationArm || bml.handshape || bml.extfidir || bml.palmor ){ // postures
            f = ( bml.attackPeak - srcStart ) / ( srcEnd - srcStart ); 
            bml.attackPeak = dstStart * ( 1.0 - f ) + dstEnd * f;
        }
        else{ // motions
            if ( bml.motion == "directed"){
                f = ( bml.attackPeak - srcStart ) / ( srcEnd - srcStart ); 
                bml.attackPeak = dstStart * ( 1.0 - f ) + dstEnd * f;
            }else{
                f = ( bml.end - srcStart ) / ( srcEnd - srcStart ); 
                bml.end = dstStart * ( 1.0 - f ) + dstEnd * f;
            }
        }
    }
}

function simpleMotionParser( xml, start, hand, symmetry ){
    let result = {}; 
    let duration = 0;
    let attributes = {}
    for( let attr = 0; attr < xml.attributes.length; ++attr ){
        attributes[ xml.attributes[attr].name ] = xml.attributes[attr].value;
    }

    if( xml.tagName == "directedmotion" ){
        result.motion = "directed";

        if ( attributes.size == "big" ){ result.distance = 0.15; }
        else { result.distance = 0.06; }
        if ( attributes.second_size == "big" ){ result.distance = 0.5 * result.distance + 0.5 * 0.15; }
        else if ( attributes.second_size == "small" ){  result.distance = 0.5 * result.distance + 0.5 * 0.06; }
    
        result.direction = attributes.direction;
        result.seconDirection = attributes.second_direction;
    
        result.curve = attributes.curve;
        result.curveSteepness = attributes.curve_size == "big" ? 1 : 0.3;

        if ( attributes.zigzag_style == "wavy" || attributes.zigzag_style == "zigzag" ){ result.zigzag = "l"; }
        if ( attributes.zigzag_size == "big" ){ result.zigzagSize = 0.3; } // "small" == default value
        else { result.zigzagSize = 0.1; } // "small" == default value
        
        result.attackPeak = start + TIMESLOT.MOTIONDIR;
        duration += TIMESLOT.MOTIONDIR;
    }
    else if ( xml.tagName == "circularmotion" ){
        result.motion = "circular";

        if ( attributes.size == "big" ){ result.distance = 0.15; }
        else { result.distance = 0.01; }  
        result.direction = attributes.axis;
        result.seconDirection = attributes.second_axis;
    
        let anglesTable = { "u":0, "ur":45, "r":90, "dr":135, "d":180, "dl":225, "l":270, "ul":315 } 
        result.startAngle = anglesTable[ attributes.start ]; 
        if ( isNaN( result.startAngle ) ) { result.startAngle = 0; }
        if ( isNaN( result.endAngle ) ) { result.endAngle = result.startAngle + 360; }
        if ( attributes.clockplus || attributes.second_clockplus ){ result.endAngle = result.startAngle + 2 * ( result.endAngle - result.startAngle );} 

        if ( attributes.zigzag_style == "wavy" || attributes.zigzag_style == "zigzag" ){ 
            result.zigzag = "o"; 
            if ( attributes.zigzag_size == "big" ){ result.zigzagSize = 0.3; }
            else { result.zigzagSize = 0.1; }
        }
        result.end = start + TIMESLOT.MOTIONCIRC;
        duration += TIMESLOT.MOTIONCIRC;
    }
    else if ( xml.tagName == "wristmotion" ){
        result.motion = "wrist";
        if ( attributes.size == "big" ){ result.intensity = 0.3; } 
        else { result.intensity = 0.1; }
        result.mode = attributes.motion;
        result.speed = 4;

        result.end = start + TIMESLOT.MOTION;
        duration += TIMESLOT.MOTION;
    }
    else if ( xml.tagName == "fingerplay" ){
        result.motion = "fingerplay";
        result.intensity = 0.5;
        if ( attributes.digits ){ result.fingers; }

        result.end = start + TIMESLOT.MOTION;
        duration += TIMESLOT.MOTION;
    } 

    if ( result.motion ){
        result.type = "gesture";
        result.start = start; 
        result.hand = hand;
        result.lrSym = symmetry & 0x01;
        result.udSym = symmetry & 0x02;
        result.oiSym = symmetry & 0x04;
    }
    return { data: [ result ], end: start + duration };
}



// ###############################################
// #              Non Manual Parser              #
// ###############################################

function signNonManual( xml, start ){
    let tiers = { // only one instance of each is allowed in jasigning
        shoulder_tier: false,
        body_tier: false,
        head_tier: false,
        eyegaze_tier: false,
        facialexpr_tier: false,
        mouthing_tier: false,
        extra_tier: false,
    };

    let allActionTags = [  "shoulder_movement", "body_movement", "head_movement", "eye_gaze", "eye_brows", "eye_lids", "nose", "mouth_gesture", "mouth_picture", "mouth_meta", "extra_movement", "neutral", ]
    let partTags = [ "shoulder_par", "body_par", "head_par", "eye_par", "facial_expr_par", "mouthing_par", "extra_par" ];

    let result = [];
    let end = start;

    for ( let i = 0; i < xml.children.length; ++i ){ // check all present tiers
        if ( tiers.hasOwnProperty( xml.children[i].tagName ) && !tiers[ xml.children[i].tagName ] ){
            tiers[ xml.children[i].tagName ] = true; // flag tier as done
            let actions = xml.children[i].children;
            let time = start + TIMESLOT.HAND; // start after basic positioning
            for( let a = 0; a < actions.length; ++a ){ // check all actions inside this tier
                if ( allActionTags.includes( actions[a].tagName ) ){ // simple sequential action ( jasigning )
                    let obj = baseNMFActionToJSON( actions[a], time, time + TIMESLOT.DEF );
                    if( Array.isArray( obj ) ){ result = result.concat( obj ); }
                    else if ( obj ) { result.push( obj ); }
                }
                else if ( partTags.includes( actions[a].tagName ) ){ // set of parallel actions
                    // all actions inside par tag start and end at the same time, regardless of action type
                    let subActions = actions[a].children;
                    for ( let sa = 0; sa < subActions.length; ++sa ){ // check all actions inside parallel tag
                        if ( allActionTags.includes( subActions[sa].tagName ) ){
                            // sequential actions ( jasigning )
                            let obj = baseNMFActionToJSON( subActions[sa], time, time + TIMESLOT.DEF );
                            if( Array.isArray( obj ) ){ result = result.concat( obj ); }
                            else if ( obj ) { result.push( obj ); }
                        }
                    }
                }
                time += TIMESLOT.DEF; // sequential even between different action types ( jasigning )

            }// end of for actions in tier
            if ( end < time ){ end = time; }
        }        
    } // end of of for tier

    return { data: result, end: end };
}

function baseNMFActionToJSON( xml, startTime, endTime ){
    // parse attributes from array of xml objects into an object where key=tagName, value=xml.value
    let obj = {}
    for( let attr = 0; attr < xml.attributes.length; ++attr ){
        obj[ xml.attributes[attr].name ] = xml.attributes[attr].value;
    }

    let result = null;
    switch( xml.tagName ){
        case "shoulder_movement": break;  // - movement   
        case "body_movement": break; // - movement
        case "head_movement": result = headMovementTable[ obj.movement ]; break; // - movement
        case "eye_gaze": result = eyeGazeTable[ obj.direction ]; break;
        case "eye_brows": result = eyebrowsTable[ obj.movement ]; break;
        case "eye_lids": result = eyelidsTable[ obj.movement ]; break;
        case "nose": result = noseTable[ obj.movement ]; break;
        case "mouth_gesture": result = mouthGestureTable[ obj.movement ]; break; // - movement
        case "mouth_picture": 
            let text = obj.picture;
            // transform text from SIL encoding to ARPABET encoding
            result = { type:"speech", text:text+".", sentInt: 0.5 };
            break; // - picture
        case "mouth_meta": break; // - mouthmetatype    --- ?????
        case "extra_movement": break; // - movement     --- ?????
        case "neutral": break; // - -
        default:
            return null;
    }

    if ( !result ){ return null; }
    result = JSON.parse( JSON.stringify( result ) );

    // post process
    if ( !Array.isArray( result ) ){
        result = [ result ];
    }
    for( let i = 0; i < result.length; ++i ){
        result[i].start = result[i].start ? startTime + result[i].start : startTime;
        if ( result[i].type == "speech" ) { 
            if(result[i].speed) {
                result[i].sentT = result[i].text.length * result[i].speed;
            }
            result[i].sentT = result[i].sentT || (endTime - startTime); 
        } 
        else {
            endTime = result[i].duration ? result[i].duration + result[i].start : endTime; 
            result[i].end = result[i].end ? startTime + result[i].end : endTime; 
        }
    }
    return result;
}


let headMovementTable = {
    NO: { type: "head", lexeme: "NOD", repetition: 1 }, //_nodding_up_and_down     
    SH: { type: "head", lexeme: "SHAKE", repetition: 3 }, //_shaking_left_and_right  
    SR: { type: "gaze", influence: "HEAD", target: "RIGHT", headOnly: true }, //_turned_right            
    SL: { type: "gaze", influence: "HEAD", target: "LEFT", headOnly: true }, //_turned_left             
    TR: { type: "head", lexeme: "TILTRIGHT", repetition: 0 }, //_tilted_right            
    TL: { type: "head", lexeme: "TILTLEFT", repetition: 0 }, //_tilted_left             
    NF: { type: "head", lexeme: "TILTFORWARD", repetition: 0 }, //_tilted_forward          
    NB: { type: "head", lexeme: "TILTBACKWARD", repetition: 0 }, //_tilted_back             
    PF: { type: "head", lexeme: "FORWARD", repetition: 0 }, //_pushed_forward          
    PB: { type: "head", lexeme: "BACKWARD", repetition: 0 }, //_pushed_backward         
    //LI: , //_head_movement_linked_to_eye_gaze
};
let eyeGazeTable = {
    AD:{ type: "gaze", influence: "EYES", target: "CAMERA" },   // _towards_addressee                           
    FR:{ type: "gaze", influence: "EYES", target: "FRONT" },    // _far                                         
    // HD:{ type: "gaze", influence: "EYES", target: "FRONT" }, // _towards_the_signer_s_own_hands              
    // HI:{ type: "gaze", influence: "EYES", target: "FRONT" }, // _towards_the_signer_s_own_dominant_hand      
    // HC:{ type: "gaze", influence: "EYES", target: "FRONT" }, // _towards_the_signer_s_own_non_dominant_hand  
    // RO:{ type: "gaze", influence: "EYES", target: "FRONT" }, // _rolling_eyes                                
    NO:{ type: "gaze", influence: "EYES", target: "FRONT" },    // _no_target_unfocussed                        
    UP:{ type: "gaze", influence: "EYES", target: "UP" },       // _up                                          
    DN:{ type: "gaze", influence: "EYES", target: "DOWN" },     // _down                                        
    LE:{ type: "gaze", influence: "EYES", target: "LEFT" },     // _left                                        
    RI:{ type: "gaze", influence: "EYES", target: "RIGHT" },    // _right                                       
    LU:{ type: "gaze", influence: "EYES", target: "UPLEFT" },   // _left_up                                     
    LD:{ type: "gaze", influence: "EYES", target: "DOWNLEFT" }, // _left_down                                   
    RU:{ type: "gaze", influence: "EYES", target: "UPRIGHT" },  // _right_up                                    
    RD:{ type: "gaze", influence: "EYES", target: "DOWNRIGHT" },// _right_down
};
let eyebrowsTable = {
    RB: { type: "faceLexeme", lexeme: "BROW_RAISER", amount: 1 }, 
    RR: { type: "faceLexeme", lexeme: "BROW_RAISER_RIGHT", amount: 1 },
    RL: { type: "faceLexeme", lexeme: "BROW_RAISER_LEFT", amount: 1 },
    FU: { type: "faceLexeme", lexeme: "BROW_LOWERER", amount: 1 },
};
let eyelidsTable = {
    WB: { type: "faceLexeme", lexeme: "UPPER_LID_RAISER", amount: 1 },      // wide open
    WR: { type: "faceLexeme", lexeme: "UPPER_LID_RAISER_RIGHT", amount: 1 },// wide open
    WL: { type: "faceLexeme", lexeme: "UPPER_LID_RAISER_LEFT", amount: 1 }, // wide open
    SB: { type: "faceLexeme", lexeme: "EYES_CLOSED", amount: 0.4 },         // slightly closed
    SR: { type: "faceLexeme", lexeme: "WINK_RIGHT", amount: 0.4 },          // slightly closed
    SL: { type: "faceLexeme", lexeme: "WINK_LEFT", amount: 0.4 },           // slightly closed
    CB: { type: "faceLexeme", lexeme: "EYES_CLOSED", amount: 1 },           // closed
    CR: { type: "faceLexeme", lexeme: "WINK_RIGHT", amount: 1 },            // closed
    CL: { type: "faceLexeme", lexeme: "WINK_LEFT", amount: 1 },             // closed
    TB: { type: "faceLexeme", lexeme: "EYES_CLOSED", amount: 1 },           // closed
    TR: { type: "faceLexeme", lexeme: "WINK_RIGHT", amount: 1 },            // closed
    TL: { type: "faceLexeme", lexeme: "WINK_LEFT", amount: 1 },             // closed
    // BB: blink at the end of the sign 
};
let noseTable = {
    WB: { type: "faceLexeme", lexeme: "NOSE_WRINKLER", amount: 1 }, // wrinkle
//     TW: twitch
//     WI: widening nostrils
};
let mouthGestureTable = {
    D01:    { type: "speech",     text: "IIIIs ",                  sentInt: 0.4, sentT: 0.8 }, //_eee_sss                                                     
    D02:    { type: "speech",     text: "ffff ",                   sentInt: 0.4, sentT: 0.6 }, //_f         // in jasiging D02 and D03 are mixed                                                 
    D03:    { type: "speech",     text: "Efff ",                   sentInt: 0.4, sentT: 0.6 }, //_ef                                                         
    D04:    { type: "speech",     text: "afff ",                   sentInt: 0.4, sentT: 0.6 }, //_af                                                         
    D05: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.05, start: 0,   duration: 0.15 },                                            
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.05, start: 0.15,duration: 0.15 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.05, start: 0.3, duration: 0.15 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.05, start: 0.45,duration: 0.15 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.05, start: 0.6, duration: 0.15 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.05, start: 0.75,duration: 0.15 },
         ], //_clattering_teeth
    D06: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.02, start: 0,   duration: 0.3 },
            { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER",      amount:  0.4, start: 0,   duration: 0.3 },                                            
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.1, start: 0,   duration: 0.3 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_UPPER",        amount: -0.2, start: 0,   duration: 0.3 },                    
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.02, start: 0.2, duration: 0.2 },
            { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER",      amount:  0.4, start: 0.2, duration: 0.2 },                                            
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.1, start: 0.2, duration: 0.2 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_UPPER",        amount: -0.2, start: 0.2, duration: 0.2 },                    
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.02, start: 0.3, duration: 0.2 },
            { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER",      amount:  0.4, start: 0.3, duration: 0.2 },                                            
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.1, start: 0.3, duration: 0.2 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_UPPER",        amount: -0.2, start: 0.3, duration: 0.2 },                    
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.02, start: 0.45,duration: 0.2 },
            { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER",      amount:  0.4, start: 0.45,duration: 0.2 },                                            
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.1, start: 0.45,duration: 0.2 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_UPPER",        amount: -0.2, start: 0.45,duration: 0.2 },                    
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.02, start: 0.6, duration: 0.2 },
            { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER",      amount:  0.4, start: 0.6, duration: 0.2 },                                            
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.1, start: 0.6, duration: 0.2 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_UPPER",        amount: -0.2, start: 0.6, duration: 0.2 },                    
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.02, start: 0.75,duration: 0.2 },
            { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER",      amount:  0.4, start: 0.75,duration: 0.2 },                                            
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.1, start: 0.75,duration: 0.2 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_UPPER",        amount: -0.2, start: 0.75,duration: 0.2 },                    
        ],  //_clattering_teeth_with_raised_upper_lip 
    D07: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.4, start: 0,    duration: 0.3 },
            { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER",      amount: 0.2, start: 0,    duration: 0.3 },
            { type: "faceLexeme", lexeme: "LOWER_LIP_DEPRESSOR",   amount: 0.4, start: 0,    duration: 0.3 },
            { type: "speech",     text: "mm ",                     start: 0.25, sentInt: 0.5,sentT: 0.5 }
         ], //_one_bite_resulting_in_closed_teeth                         
    D08: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.4, start: 0,    duration: 0.3 },
            { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER",      amount: 0.6, start: 0.1,  duration: 0.8 },
            { type: "faceLexeme", lexeme: "LOWER_LIP_DEPRESSOR",   amount: 0.8, start: 0,    duration: 0.8 },
            { type: "faceLexeme", lexeme: "JAW_DROP",              amount: -0.3, start: 0.25,duration: 0.5 },
         ], //_one_bite_lips_stretched_teeth_visible                      
    D09: [  { type: "speech",     text: "tAiii ",                    sentInt: 0.8, sentT: 0.5 }, 
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",            amount: 1, start: 0.3,    duration: 0.5 }
         ],//_teeth_on_lower_lip_open_almost_close_tongue_behind_upper_teeth    --> CAN'T BE DONE (NOT TONGUE BLENDSHAPES)

    J01: [  { type: "faceLexeme", lexeme: "JAW_SIDEWAYS_LEFT",     amount: 0.5, start: 0,   duration: 0.2 }, //{ type: "faceLexeme", lexeme: "LIP_PUCKERER_LEFT",  amount: -0.3, start: 0,   duration: 0.2} , { type: "faceLexeme", lexeme: "LIP_PUCKERER_RIGHT", amount: 0.3, start: 0,   duration: 0.2 },
            { type: "faceLexeme", lexeme: "JAW_SIDEWAYS_RIGHT",    amount: 0.5, start: 0.2, duration: 0.2 }, //{ type: "faceLexeme", lexeme: "LIP_PUCKERER_RIGHT", amount: -0.3, start: 0.2, duration: 0.2} , { type: "faceLexeme", lexeme: "LIP_PUCKERER_LEFT",  amount: 0.3, start: 0.2, duration: 0.2 },
            { type: "faceLexeme", lexeme: "JAW_SIDEWAYS_LEFT",     amount: 0.5, start: 0.4, duration: 0.2 }, //{ type: "faceLexeme", lexeme: "LIP_PUCKERER_LEFT",  amount: -0.3, start: 0.4, duration: 0.2} , { type: "faceLexeme", lexeme: "LIP_PUCKERER_RIGHT", amount: 0.3, start: 0.4, duration: 0.2 },
            { type: "faceLexeme", lexeme: "JAW_SIDEWAYS_RIGHT",    amount: 0.5, start: 0.6, duration: 0.2 }, //{ type: "faceLexeme", lexeme: "LIP_PUCKERER_RIGHT", amount: -0.3, start: 0.6, duration: 0.2} , { type: "faceLexeme", lexeme: "LIP_PUCKERER_LEFT",  amount: 0.3, start: 0.6, duration: 0.2 }
         ], //_lower_jaw_moves_sideways_left_and_right                    
    J02: [  { type: "faceLexeme", lexeme: "JAW_DROP",              amount: 0.7, start: 0,   duration: 0.6 }, { type: "faceLexeme", lexeme: "JAW_THRUST",  amount: -0.3, start: 0,   duration: 0.6 }, { type: "faceLexeme", lexeme: "MOUTH_OPEN",  amount: -0.35, start: 0,   duration: 0.6 },
            { type: "faceLexeme", lexeme: "JAW_DROP",              amount: 0.7, start: 0.8, duration: 0.6 }, { type: "faceLexeme", lexeme: "JAW_THRUST",  amount: -0.3, start: 0.8, duration: 0.6 }, { type: "faceLexeme", lexeme: "MOUTH_OPEN",  amount: -0.35, start: 0.8, duration: 0.6 },
            { type: "faceLexeme", lexeme: "JAW_DROP",              amount: 0.7, start: 1.6, duration: 0.6 }, { type: "faceLexeme", lexeme: "JAW_THRUST",  amount: -0.3, start: 1.6, duration: 0.6 }, { type: "faceLexeme", lexeme: "MOUTH_OPEN",  amount: -0.35, start: 1.6, duration: 0.6 },
            { type: "faceLexeme", lexeme: "JAW_DROP",              amount: 0.7, start: 2.4, duration: 0.6 }, { type: "faceLexeme", lexeme: "JAW_THRUST",  amount: -0.3, start: 2.4, duration: 0.6 }, { type: "faceLexeme", lexeme: "MOUTH_OPEN",  amount: -0.35, start: 2.4, duration: 0.6 },
         ], //_lower_jaw_chews_mouth_remains_closed                       
    J03: [  { type: "faceLexeme", lexeme: "JAW_THRUST",            amount: 1, start: 0, duration: 0.8 }, { type: "faceLexeme", lexeme: "JAW_DROP",  amount: 0.16, start: 0, duration: 0.8 }, { type: "faceLexeme", lexeme: "LOWER_LIP_DEPRESSOR",  amount: 0.9, start: 0,   duration: 0.8 }
         ], //_mouth_open_jaw_forward_teeth_visible                       
    J04:    { type: "speech",     text: "GA GA GA GA GA",          sentInt: 0.5, sentT: 1 }, //_mouth_open_jaw_gagaga_at_pharynx                           
          
    L02:    { type: "speech",     text: "p r r r",                 phInt: [0.2, 0.3, 0.3, 0.3], phT: [0.2, 0.05, 0.05, 0.05] }, //_prrr                                                       
    L01:    { type: "speech",     text: " S ",                     sentInt: 1.2, sentT: 0.7}, //_sh                                                         
    L03:    { type: "speech",     text: "p r",                     phInt: [0.15, 0.3], phT: [0.2, 0.2] }, //_pr                                                         
    L04:    { type: "faceLexeme", lexeme: "LIP_TIGHTENER",         amount: 0.8, start: 0,   duration: 0.8 }, //_pursed_lips                                                
    L05:    { type: "speech",     text: " Oo ",                    sentInt: 1.2, sentT: 0.8 }, //_o_oa_open_o                                                
    L06:    { type: "speech",     text: " O ",                     sentInt: 0.8, sentT: 0.8 }, //_ooo_closed_o                                               
    L07:    { type: "speech",     text: " o ",                     sentInt: 1.2, sentT: 0.7 }, //_oa                                                         
    L08:    { type: "speech",     text: "boAm ",                   phInt: [0.1, 0.3, 0.2, 0.3], phT: [0.1, 0.05, 0.05, 0.05] }, //_boam                                                       
    L09:    { type: "speech",     text: "bAm ",                    phInt: [0.1, 0.5, 0.2],  phT: [0.1, 0.1, 0.05] }, //_bam                                                        
    L10:    { type: "speech",     text: "boA A ",                  phInt: [0.5, 0.5, 1, 1], phT: [0.1, 0.05, 0.3, 0.1] }, //_boa                                                        
    L11:    { type: "speech",     text: "b A ",                    sentInt: 0.5, phT: [0.1, 0.2] }, //_ba                                                         
    L12:    { type: "speech",     text: "bii ",                    phInt: [0.1, 1, 1], phT: [0.1, 0.15, 0.5] }, //_bee                                                        
    L13:    { type: "speech",     text: "pYY ",                    phInt: [0.1, 0.6, 0.6], phT: [0.05, 0.2, 0.3] }, //_pi                                                         
    L14:    { type: "speech",     text: "pCh",                     phInt: [0.1, 1, 0.8], phT: [0.1, 0.2, 0.4] }, //_pch                                                        
    L15: [  { type: "speech",     text: "bs",                      sentInt: 0.3, sentT: 0.3 },
            { type: "faceLexeme", lexeme: "LIPS_PART",             amount: 1,  start: 0.2,     duration: 0.9 }, 
         ],//_bsss_bee                                                   
    L16:    { type: "speech",     text: "pff ",                    sentInt: 0.5, phT: [0.05, 0.2, 0.3, 0.1]}, //_pf                                                         
    L17:    { type: "speech",     text: "ppA ",                    phInt: [0.1,0.01, 0.01, 0.01], phT: [0.1, 0.1, 0.03, 0.05]}, //_p                                                          
    L18:    { type: "speech",     text: "pApApA ",                 sentInt: 0.05, sentT: 0.6 }, //_p_p_p                                                      
    L19: [  { type: "faceLexeme", lexeme: "NMF_ROUND_OPEN",        amount: 0.3, start: 0, duration: 0.6 },
            { type: "faceLexeme", lexeme: "LIP_PUCKERER",          amount: 0.9, start: 0, duration: 0.6 }
         ], //_phh                                                        
    L20: [  { type: "faceLexeme", lexeme: "LIP_PUCKERER",          amount: 0.2, start: 0, duration: 0.9 },
            { type: "faceLexeme", lexeme: "LIP_CORNER_PULLER",     amount: 0.2, start: 0, duration: 0.9 },
            { type: "faceLexeme", lexeme: "CHEEK_BLOW",            amount: 0.9, start: 0, duration: 0.9 },
            
         ], //_phh                                                   
    // L21: { type: "speech", text: "", sentInt: 0.3 }, //_ph  --> NOT WORKING ON JASigning                                                       
    L22: [  { type: "faceLexeme", lexeme: "LIP_PUCKERER",          amount: 0.2, start: 0, duration: 0.4 },
            { type: "faceLexeme", lexeme: "LIP_CORNER_PULLER",     amount: 0.2, start: 0, duration: 0.4 },
            { type: "faceLexeme", lexeme: "CHEEK_BLOW",            amount: 0.9, start: 0, duration: 0.4 }

         ], //_ph                                                         
    L23:    { type: "speech",     text: "mmm ",                    sentInt: 0.2 }, //_mmm                                                        
    L24:    { type: "speech",     text: "ma m ",                   phInt: [0.1, 0.05, 0.05, 0.2], phT: [0.1, 0.1, 0.05, 0.45, 0.2] }, //_mmm_while_holding_breath                                   
    L25:    { type: "speech",     text: "mamama ",                 phInt: [0.2, 0.05, 0.2, 0.05, 0.2, 0.05], sentT: 0.7 }, //_m_m_m                                                      
    L26:    { type: "faceLexeme", lexeme: "UPPER_LIP_RAISER_RIGHT",amount: 0.8,  start: 0,   duration: 0.8 }, //_one_side_of_upper_lip_raised                               
    L27: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.25, start: 0,   duration: 0.6 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 1,    start: 0,   duration: 0.6 }
         ], //_mouth_slightly_open_tongue_to_upper_close_lips_hidden      ----> CAN'T BE DONE (NOT BLENDSHAPES FOR TONGUE)
    L28: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.5,  start: 0,   duration: 0.6 }, 
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 1,    start: 0,   duration: 0.6 }
         ], //_tongue_on_upper_lip_close_mouth_lips_hidden          ----> CAN'T BE DONE (NOT BLENDSHAPES FOR TONGUE)
    L29: [  { type: "faceLexeme", lexeme: "LIP_CORNER_DEPRESSOR",  amount: 0.15, start: 0,   duration: 0.6 }, 
            { type: "faceLexeme", lexeme: "DIMPLER",               amount: 0.6,  start: 0,   duration: 0.6 },
            { type: "faceLexeme", lexeme: "LID_TIGHTENER",         amount: 0.25, start: 0,   duration: 0.6 }
         ], //_lips_closed_hidden_mouth_corners_curved_down               
    L30: [  { type: "faceLexeme", lexeme: "LIP_CORNER_DEPRESSOR",  amount: 0.6,  start: 0,   duration: 0.7 }, 
            { type: "faceLexeme", lexeme: "LIP_PUCKERER",          amount: 0.4,  start: 0,   duration: 0.7 },
            { type: "faceLexeme", lexeme: "LID_TIGHTENER",         amount: 0.25, start: 0,   duration: 0.7 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: -0.1, start: 0,   duration: 0.7 }
         ], //_lips_pursed_curved_down                                    
    L31: [  { type: "faceLexeme", lexeme: "LIP_CORNER_DEPRESSOR",  amount: 0.15, start: 0,   duration: 0.6 }, 
            { type: "faceLexeme", lexeme: "DIMPLER",               amount: 0.6,  start: 0,   duration: 0.6 },
            { type: "faceLexeme", lexeme: "LID_TIGHTENER",         amount: 0.25, start: 0,   duration: 0.6 }
         ], //_lips_closed_corners_of_mouth_curved_down        (???? --> same as L29)            
    L32: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.1,  start: 0,     duration: 0.8 }, 
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.3, start: 0.1,   duration: 0.1 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: 0.2,  start: 0.2,   duration: 0.1 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.3, start: 0.3,   duration: 0.1 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: 0.2,  start: 0.4,   duration: 0.1 },
         ], //_mouth_slightly_open_blow_lips_vibrate_initially            
    L33:    { type: "speech",     text: "A S ",                    phInt: [0.3, 0.8, 0.8, 0.8], phT: [0.1, 0.05, 0.55, 0.05] }, //_mouth_open_close_sh_with_teeth_showing                     
    L34:    { type: "faceLexeme", lexeme: "LIP_CORNER_PULLER",     amount: 0.5,  start: 0,     duration: 0.6 }, //_lips_closed_stretched_strongly                             
    L35: [  { type: "faceLexeme", lexeme: "NMF_BLOW_BOTH",         amount: -0.4, start: 0,     duration: 1.45 }, 
            { type: "faceLexeme", lexeme: "LIP_PUCKERER",          amount: 0.4,  start: 0,     duration: 1.45 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.05, start: 0.2,   duration: 0.4 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.2, start: 0.2,   duration: 0.4 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_UPPER",        amount: -0.2, start: 0.2,   duration: 0.4 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.05, start: 0.6,   duration: 0.4 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: -0.2, start: 0.6,   duration: 0.4 },
            { type: "faceLexeme", lexeme: "LIP_SUCK_UPPER",        amount: -0.2, start: 0.6,   duration: 0.4 },
            
         ], //_blow_out_air_through_slightly_open_lips                    
    
    C01:    { type: "faceLexeme", lexeme: "CHEEK_BLOW",            amount: 1,    start: 0,   duration: 0.8 }, //_puffed_cheeks                                              
    C02: [  { type: "faceLexeme", lexeme: "NMF_BLOW_BOTH",         amount: 0.8,  start: 0,   duration: 0.8 }, 
            { type: "faceLexeme", lexeme: "LIP_PUCKERER",          amount: 0.2,  start: 0,   duration: 0.8 } 
         ], //_cheeks_and_lip_area_puffed                                 
    C03:    { type: "faceLexeme", lexeme: "CHEEK_BLOW",            amount: 0.8,  start: 0,   duration: 0.8 }, //_gradually_puffing_cheeks  (???? --> same as C01)                                 
    C04: [  { type: "faceLexeme", lexeme: "NMF_BLOW_RIGHT",        amount: 1,    start: 0,   duration: 0.8 }, 
            { type: "faceLexeme", lexeme: "LIP_PUCKERER_RIGHT",    amount: -0.2, start: 0,   duration: 0.8 } 
         ], //_one_cheek_puffed                                           
    C05: [  { type: "faceLexeme", lexeme: "NMF_BLOW_RIGHT",        amount: 0.8,  start: 0,   duration: 0.4 }, 
            { type: "faceLexeme", lexeme: "LIP_PUCKERER_RIGHT",    amount: -0.2, start: 0,   duration: 0.4 } 
         ], //_one_cheek_puffed_while_briefly_blowing_out_air             
    C06: [  { type: "faceLexeme", lexeme: "NMF_BLOW_RIGHT",        amount: 0.8,  start: 0,   duration: 0.4 }, 
            { type: "faceLexeme", lexeme: "LIP_PUCKERER_RIGHT",    amount: -0.2, start: 0,   duration: 0.4 } 
         ], //_one_cheek_puffed_briefly_blowing_air_cheek_pushed          (???? --> same as C05)
    C07:    { type: "faceLexeme", lexeme: "CHEEK_SUCK",            amount: 1,    start: 0,   duration: 0.8 }, //_cheeks_sucked_in                                           
    C08: [  { type: "faceLexeme", lexeme: "CHEEK_SUCK",            amount: 1,    start: 0,   duration: 0.8 }, 
            { type: "faceLexeme", lexeme: "LIP_FUNNELER",          amount: 1,    start: 0,   duration: 0.8 }
         ], //_cheeks_sucked_in_sucking_in_air                            
    // C09: { type: "speech", text: "", sentInt: 0.3 }, //_tongue_pushed_visibly_into_cheek             ----> CAN'T BE DONE (NOT BLENDSHAPES FOR TONGUE)              
    // C10: { type: "speech", text: "", sentInt: 0.3 }, //_tongue_repeatedly_pushes_into_cheek          ----> CAN'T BE DONE (NOT BLENDSHAPES FOR TONGUE)
    C11: [  { type: "faceLexeme", lexeme: "NMF_BLOW_RIGHT",        amount: 1,    start: 0,   duration: 0.2  }, 
            { type: "faceLexeme", lexeme: "LIP_PUCKERER_RIGHT",    amount: -0.2, start: 0,   duration: 0.85 },
            { type: "faceLexeme", lexeme: "NMF_BLOW_RIGHT",        amount: 1,    start: 0.2, duration: 0.2  }, 
            { type: "faceLexeme", lexeme: "NMF_BLOW_RIGHT",        amount: 1,    start: 0.4, duration: 0.2  }, 
            { type: "faceLexeme", lexeme: "NMF_BLOW_RIGHT",        amount: 1,    start: 0.6, duration: 0.25 }, 
         ], //_one_cheek_puffed_blow_out_briefly_at_corner_several_times  
    C12: [  { type: "faceLexeme", lexeme: "LIP_SUCK_LOWER",        amount: 0.8,  start: 0,   duration: 0.8  }, 
            { type: "faceLexeme", lexeme: "JAW_THRUST",            amount: 1,    start: 0,   duration: 0.8 }
         ], //_lips_closed_tongue_pushed_behind_lower_lip                 
    C13: [  { type: "faceLexeme", lexeme: "JAW_DROP",              amount: 0.3,  start: 0,   duration: 0.8 },  
            { type: "faceLexeme", lexeme: "JAW_THRUST",            amount: 0.1,  start: 0,   duration: 0.8 }, 
            { type: "faceLexeme", lexeme: "NMF_MOUTH_DOWN",        amount: 0.3,  start: 0,   duration: 0.8 }, 
            { type: "faceLexeme", lexeme: "NMF_OPEN_WIDE_MOUTH",   amount: -0.15,start: 0,   duration: 0.8 } 
         ],//_cheeks_slightly_in_jaw_down_blow_closed_lips_several_times 
    
    T01:    { type: "speech",     text: "lllll ",                  sentInt: 1,   sentT: 0.5 }, //_l                                                          
    T02: [  { type: "speech",     text: "lllll ",                  sentInt: 1,   sentT: 0.5 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 0.3,  start: 0 }
         ], //_tip_of_tongue_slightly_protruding                          
    // T03: { type: "speech", text: "", sentInt: 0.3 }, //_l_l_l       ---> CAN'T BE DONE (NOT TONGUE BLENDSHAPES)                                               
    T04: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.45,  start: 0,   duration: 0.4 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 0.5,   start: 0,   duration: 0.4 }
         ], //_tongue_sticks_out_briefly                                  
    T05: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.5,   start: 0,   duration: 1 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 0.55,  start: 0,   duration: 1 }
         ], //_a                                                          
    T06: [  { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.45,  start: 0,   duration: 0.35 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 0.5,   start: 0,   duration: 0.35 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.45,  start: 0.25,duration: 0.35 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 0.5,   start: 0.25,duration: 0.35 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.45,  start: 0.55,duration: 0.35 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 0.5,   start: 0.55,duration: 0.35 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.45,  start: 0.85,duration: 0.35 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 0.5,   start: 0.85,duration: 0.35 }
         ], //_tongue_sticking_out_repeatedly                             
    T07:    { type: "speech",     text: "la la la la ",            phInt: [1, 1, 0.1, 1, 1, 0.1,1, 1, 0.1,1, 1, 0.1,],  sentT: 1.2 }, //_lalala                                                     
    T08:    { type: "speech",     text: "al al al al ",            phInt: [1, 1, 0.1, 1, 1, 0.1,1, 1, 0.1,1, 1, 0.1,],  sentT: 1.2 }, //_alalal                                                     
    T09:    { type: "speech",     text: "als ",                    sentInt: 0.8,  sentT: 0.6 }, //_als            --> NOT IMPLEMENTED ON JASigning                                            
    T10:    { type: "speech",     text: "llff ",                   sentInt: 0.8,  sentT: 0.6 }, //_lf                                                         
    T11:    { type: "speech",     text: "loaf ",                   sentInt: 0.5,  sentT: 0.6 }, //_laf                                                        
    // T12: { type: "speech", text: "", sentInt: 0.3 }, //_tip_of_tongue_touches_one_corner_of_the_mouth          --> CAN'T BE DONE (NOT TONGUE BLENDSHAPES)   
    T13: [  { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 0.5,   start: 0,   duration: 0.8 },
            { type: "faceLexeme", lexeme: "CHEEK_BLOW",            amount: 0.4,   start: 0,   duration: 0.8 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.2,   start: 0,   duration: 0.8 },
         ], //_tongue_tip_between_lower_lip_lower_teeth_middle_tongue_showing 
    // T14: { type: "speech", text: "", sentInt: 0.3 }, //_tip_of_tongue_is_protruded_and_moving_sidewards        --> CAN'T BE DONE (NOT TONGUE BLENDSHAPES)    
    // T15: { type: "speech", text: "", sentInt: 0.3 }, //_oval_circling_movement_of_tongue_in_open_mouth         --> CAN'T BE DONE (NOT TONGUE BLENDSHAPES)    
    T16: [  { type: "faceLexeme", lexeme: "LIP_PUCKERER",          amount: 0.8,   start: 0,   duration: 0.8 },
            { type: "faceLexeme", lexeme: "TONGUE_SHOW",           amount: 1,     start: 0,   duration: 0.8 },
            { type: "faceLexeme", lexeme: "CHIN_RAISER",           amount: -0.4,  start: 0,   duration: 0.8 },
            { type: "faceLexeme", lexeme: "MOUTH_OPEN",            amount: 0.2,   start: 0,   duration: 0.8 },
         ], //_lips_pursed_with_tip_of_tongue_protruding                  
    // T17: { type: "speech", text: "", sentInt: 0.3 }, //_mouth_open_tongue_protrudes_briefly
}

export{ sigmlStringToBML, TIMESLOT }
