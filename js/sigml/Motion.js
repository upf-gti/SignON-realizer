import { Mesh, MeshPhongMaterial, SphereGeometry, Vector3 } from "three";
import { CCDIKSolver, FABRIKSolver } from "./IKSolver.js";
import { cubicBezierVec3 } from "./sigmlUtils.js";


let positions = {
    'u'  : new Vector3( 0.0, 1.0, 0.0 ),  
    'd'  : new Vector3( 0.0, -1.0, 0.0 ), 
    'l'  : new Vector3( 1.0, 0.0, 0.0 ),
    'r'  : new Vector3( -1.0, 0.0, 0.0 ),
    'ul' : new Vector3( 1.0, 1.0, 0.0 ),
    'dl' : new Vector3( 1.0, -1.0, 0.0 ),
    'ur' : new Vector3( -1.0, 1.0, 0.0 ),
    'dr' : new Vector3( -1.0, -1.0, 0.0 ),


    'uBl'  : new Vector3( 0.5, 1.0, 0.0 ),  
    'uBr'  : new Vector3( -0.5, 1.0, 0.0 ),  
    'dBl'  : new Vector3( 0.5, -1.0, 0.0 ), 
    'dBr'  : new Vector3( -0.5, -1.0, 0.0 ), 
    'lBu'  : new Vector3( 1.0, 0.5, 0.0 ),
    'lBd'  : new Vector3( 1.0, -0.5, 0.0 ),
    'rBu'  : new Vector3( -1.0, 0.5, 0.0 ),
    'rBd'  : new Vector3( -1.0, -0.5, 0.0 ),

}
class Motion {

    constructor( character ){
        this.skeleton = null;
        character.traverse( o => {
            if ( o.isSkinnedMesh ) {
                this.skeleton = o.skeleton;
            }
        } );

        this.ikSolver = new FABRIKSolver( this.skeleton );
        this.ikTarget = { position: new Vector3(0,0,0) }; // worldposition
        this._ikCreateChains( "LeftHand", "LeftShoulder" );
        this._ikCreateChains( "RightHand", "RightArm" );
        this.ikSolver.constraintsEnabler = false;
        this.ikSolver.setChainEnablerAll(false);
        this.ikSolver.setIterations(4);



        this.right = { 
            shoulder : this.ikSolver.getChain("mixamorig_RightArm"),
            elbow : this.ikSolver.getChain("mixamorig_RightForeArm"),
            hand : this.ikSolver.getChain("mixamorig_RightHand"),
            points : ['u','l','d','r','u'],
            beziers : ['uBl', 'lBu',  'lBd', 'dBl',  'dBr', 'rBd', 'rBu', 'uBr' ],
            // points : ['l','d','r'],
            // beziers : ['u', 'lBu',  'lBd', 'dBl',  'dBr', 'rBd', 'rBu', 'uBr' ],
            // points : ['ur','ur','ur'],
            // beziers : ['u', 'rBu',  'r', 'r',  'r', 'r', 'r', 'r', 'dBr', 'rBd', 'rBu', 'uBr' ],
            dt : 1,
            time : 0.0,
            i : 0,
        }

        this.offset = new Vector3(0,0,0);
        this.work = false;

        this.w = 0.2;
        this.speed = 1;

        if ( !window.test )
            window.test = this;
    }

    update( dt ){
        if ( !this.work ){ return; }
        this.updateArm( dt, this.right );
    }

    updateArm( dt, arm ){
        /* 
            - On each frame the arm is forced into a position by the locationArm
            - Compute the current offset from the base position
            - Apply ik from current arm location to arm+offset
        */ 


        arm.time += dt * this.speed;;
        let temp = Math.floor( arm.time / arm.dt ); 
        arm.i += temp
        arm.time = arm.time - temp;

        if ( arm.i > arm.points.length ){ this.work = false; return; }


        // compute current offset
        let t = arm.time / arm.dt;
        let i = arm.i;

        let w = this.w;
        
        if ( i == 0 ){
            this.offset.copy( positions[arm.points[i]] );
            this.offset.multiplyScalar( t * w );
        }
        else if ( i == arm.points.length ){
            this.offset.copy( positions[arm.points[i-1]] );
            this.offset.multiplyScalar( (1.0 - t ) * w  );
        }
        else{
            let a = positions[ arm.points[ i-1 ] ];
            let b = positions[ arm.beziers[ (i-1) * 2 ] ];
            let c = positions[ arm.beziers[ (i-1) * 2 + 1 ] ];
            let d = positions[ arm.points[ i ] ];

            cubicBezierVec3(a,b,c,d,this.offset, t);
            
            this.offset.multiplyScalar( w );
        }


        // if ( i == 0 ){

        //     let a = new Vector3(0,0,0);
        //     let b = positions[ arm.beziers[ i * 2 ] ];
        //     let c = positions[ arm.beziers[ i * 2 + 1 ] ];
        //     let d = positions[ arm.points[ i ] ];

        //     t = Math.sin( Math.PI * 0.5 * t - Math.PI*0.5 ) + 1;
        //     console.log(t);
        //     cubicBezierVec3(a,b,c,d,this.offset, t);
            
        //     this.offset.multiplyScalar( w );
        // }
        // else if ( i == arm.points.length ){

        //     let a = positions[ arm.points[ i-1 ] ];
        //     let b = positions[ arm.beziers[ i * 2 ] ];
        //     let c = positions[ arm.beziers[ i * 2 + 1 ] ];
        //     let d = new Vector3(0,0,0);

        //     t = Math.sin( Math.PI * 0.5 * t ); // linear init and ends smooths
        //     cubicBezierVec3(a,b,c,d,this.offset, t);
            
        //     this.offset.multiplyScalar( w );
        // }
        // else{
        //         let a = positions[ arm.points[ i-1 ] ];
        //         let b = positions[ arm.beziers[ i * 2 ] ];
        //         let c = positions[ arm.beziers[ i * 2 + 1 ] ];
        //         let d = positions[ arm.points[ i ] ];
    
        //         cubicBezierVec3(a,b,c,d,this.offset, t);
                
        //         this.offset.multiplyScalar( w );
        //   }

        this.skeleton.bones[ arm.hand.chain[0] ].getWorldPosition( this.ikTarget.position );
        this.ikTarget.position.add( this.offset );

        let k = new Mesh( new SphereGeometry(0.005, 16, 16), new MeshPhongMaterial({ color: this.color , depthTest:false, depthWrite: false }) );
        k.position.copy(this.ikTarget.position);
        window.global.app.scene.add( k );
        
        // compute target pose
        arm.hand.enabler = true;
        this.ikSolver.update();
        arm.hand.enabler = false;

        this.skeleton.bones[ arm.hand.chain[0] ].getWorldPosition( this.ikTarget.position );
        k = new Mesh( new SphereGeometry(0.005, 16, 16), new MeshPhongMaterial({ color: this.color , depthTest:false, depthWrite: false }) );
        k.position.copy(this.ikTarget.position);
        window.global.app.scene.add( k );

    }

    newGestureBML(){
        this.right.time = 0;
        this.right.i = 0;
        this.work = true;
        this.speed = 3;
        this.w = 0.05;

        this.color = Math.floor( Math.random() * 0xffffff );
    }


    _ikCreateChains( effectorName, rootName ) {
        let bones = this.skeleton.bones;
        let effector = this.skeleton.getBoneByName( effectorName );
        let root = this.skeleton.getBoneByName( rootName );

        if ( !effector ) { // find similarly named bone
            for ( let i = 0; i < bones.length; ++i ) {
                if ( bones[ i ].name.includes( effectorName ) ) {
                    effector = bones[ i ];
                    break;
                }
            }
        }
        if ( !root ) { // bind similarly named bone
            for ( let i = 0; i < bones.length; ++i ) {
                if ( bones[ i ].name.includes( rootName ) ) {
                    root = bones[ i ];
                    break;
                }
            }
        }
        if ( !effector || !root ) { return; }

        let chain = []
        let bone = effector;
        while ( true ) {
            let i = bones.indexOf( bone );
            if ( i < 0 ) { console.warn( "IK chain: Skeleton root was reached before chain root " ); break; }

            chain.push( i );

            if ( bone == root ) { break; }
            bone = bone.parent;
        }

        effector = bones[ chain[ 0 ] ];
        while ( effector != root ) {
            if ( !this.ikSolver.getChain( effector.name ) ) {
                this.ikSolver.createChain( chain, null, this.ikTarget, effector.name );
            }
            chain.splice( 0, 1 );
            effector = bones[ chain[ 0 ] ];
        }
    }
}

export { Motion }