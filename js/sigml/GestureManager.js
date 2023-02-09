
import { HandShapeRealizer } from "./HandShapeRealizer.js"
import { LocationArm } from "./LocationArm.js";


class GestureManager{
    constructor( character ){
        this.character = character;
        this.handShapeRealizer = new HandShapeRealizer( character );
        this.locationArm = new LocationArm( character );
    }

    reset(){
        this.handShapeRealizer.reset();
        this.locationArm.reset();
    }

    update( dt ){
        this.handShapeRealizer.update( dt );
        this.locationArm.update( dt );
    }

    newGesture( bml ){
        if ( bml.handshape ){
            this.handShapeRealizer.newGestureBML( bml );
        }
        if ( bml.locationArm ){
            this.locationArm.newGestureBML( bml );
        }
    }
}

export { GestureManager };