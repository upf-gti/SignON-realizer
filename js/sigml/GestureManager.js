
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { LocationArmIK } from "./LocationArmIK.js";
import { LocationArm } from "./LocationArm.js";

import { Palmor } from "./Palmor.js"
import { Extfidir } from "./Extfidir.js";


class GestureManager{
    constructor( character ){
        this.character = character;
        this.handShapeRealizer = new HandShapeRealizer( character );
        //this.locationArm = new LocationArmIK( character );
        this.locationArm = new LocationArm( character );
        this.palmor = new Palmor( character );
        this.extfidir = new Extfidir( character );
    }

    reset(){
        this.handShapeRealizer.reset();
        this.locationArm.reset();
        this.palmor.reset();
        this.extfidir.reset();
    }

    update( dt ){

        // overwrite arm posture.
        this.locationArm.update( dt );
        let r = this.locationArm.right;
        let l = this.locationArm.left;
        let bones = this.locationArm.skeleton.bones;
        for( let i = 0; i < r.curG.length ; ++i ){
            bones[ r.idx + i ].quaternion.copy( r.curG[i] );
            bones[ l.idx + i ].quaternion.copy( l.curG[i] );
        }
        
        // ADD twist to elbow (twist before swing scheme). Overwrite wrist (put only twist)
        this.palmor.update( dt );
        r = this.palmor.right;
        l = this.palmor.left;
        bones[ r.idx ].quaternion.multiply( r.curG[0] ); // elbow
        bones[ l.idx ].quaternion.multiply( l.curG[0] );
        bones[ r.idx + 1 ].quaternion.copy( r.curG[1] ); // wrist
        bones[ l.idx + 1 ].quaternion.copy( l.curG[1] );

        // extfidir - ADD only swing (twist before swing scheme)
        this.extfidir.update(dt);
        r = this.extfidir.right;
        l = this.extfidir.left;
        bones[ r.idx ].quaternion.premultiply( r.curG );
        bones[ l.idx ].quaternion.premultiply( l.curG );

        // overwrite finger rotations
        this.handShapeRealizer.update( dt );

    }

    newGesture( bml ){
        if ( bml.handshape ){
            this.handShapeRealizer.newGestureBML( bml );
        }
        if ( bml.locationArm ){
            this.locationArm.newGestureBML( bml );
        }
        if ( bml.palmor ){
            this.palmor.newGestureBML( bml );
        }
        if ( bml.extfidir ){
            this.extfidir.newGestureBML( bml );
        }
    }
}

export { GestureManager };