import * as THREE from "../../libs/three.module.js";
import * as MATH_UTILS from "./math.js";

var base_size = 1;
let rskeleton = [];
let map_names = {};
// Mediapipe landmark information (idx, name, prev landmark idx, x, y, z)
let LM_INFO = class LandmarksInfo {

    // The order is important! It's necessary later to keep track of previous quaternions
    static HIPS =                   new LandmarksInfo(33, "mixamorigHips",            -1 , ["RIGHT_UP_LEG", "LEFT_UP_LEG"]);
    static RIGHT_UP_LEG =           new LandmarksInfo(24, "mixamorigRightUpLeg",       33, ["RIGHT_LEG"]);
    static RIGHT_LEG =              new LandmarksInfo(26, "mixamorigRightLeg",         24, ["RIGHT_HEEL"]);
    static RIGHT_HEEL =             new LandmarksInfo(28, "mixamorigRightFoot",        26, ["RIGHT_FOOT_INDEX"]);
    static RIGHT_FOOT_INDEX =       new LandmarksInfo(32, "mixamorigRightToeBase",     28, ["RIGHT_FOOT_INDEX_END"]);
    static RIGHT_FOOT_INDEX_END =   new LandmarksInfo(76, "mixamorigRightToe_End",     32, []);
    static LEFT_UP_LEG =            new LandmarksInfo(23, "mixamorigLeftUpLeg",        33, ["LEFT_LEG"]);
    static LEFT_LEG =               new LandmarksInfo(25, "mixamorigLeftLeg",          23, ["LEFT_HEEL"]);
    static LEFT_HEEL =              new LandmarksInfo(27, "mixamorigLeftFoot",         25, ["LEFT_FOOT_INDEX"]);
    static LEFT_FOOT_INDEX =        new LandmarksInfo(31, "mixamorigLeftToeBase",      27, ["LEFT_FOOT_INDEX_END"]);
    static LEFT_FOOT_INDEX_END =    new LandmarksInfo(75, "mixamorigLeftToe_End",       31, []);
    static SPINE =                  new LandmarksInfo(35, "mixamorigSpine",            33, ["SPINE1"]);
    static SPINE1 =                 new LandmarksInfo(36, "mixamorigSpine1",           35, ["SPINE2"]);
    static SPINE2 =                 new LandmarksInfo(37, "mixamorigSpine2",           36, ["NECK"]);
    static NECK =                   new LandmarksInfo(38, "mixamorigNeck",             37, ["HEAD"]);
    static HEAD =                   new LandmarksInfo(0,  "mixamorigHead",             38, []);
    // static MOUTH_MIDDLE =       new LandmarksInfo(34, "mouth_middle",           35,  0.0, 0.0, base_size * 0.18 );

    // static NOSE =               new LandmarksInfo(0, "nose",                0);
    // static LEFT_EYE_INNER =     new LandmarksInfo(1, "left_eye_inner",      0);
    //static LEFT_EYE =              new LandmarksInfo(2, "mixamorigLeftEye",            0,  -base_size * 0.18, 0.0, -base_size * 0.18);
    // static LEFT_EYE_OUTER =     new LandmarksInfo(3, "left_eye_outer",      0);
    // static RIGHT_EYE_INNER =    new LandmarksInfo(4, "right_eye_inner",     0);
    //static RIGHT_EYE =             new LandmarksInfo(5, "mixamorigRigthEye",           0,   base_size * 0.18, 0.0, -base_size * 0.18);
    // static RIGHT_EYE_OUTER =    new LandmarksInfo(6, "right_eye_outer",     0);
    // static LEFT_EAR =           new LandmarksInfo(7, "left_ear",            0);
    // static RIGHT_EAR =          new LandmarksInfo(8, "right_ear",           0);
    // static LEFT_MOUTH =         new LandmarksInfo(9, "left_mouth",          34);
    // static RIGHT_MOUTH =        new LandmarksInfo(10, "right_mouth",        34);
    static RIGHT_SHOULDER =        new LandmarksInfo(73, "mixamorigRightShoulder",     37, []);
    static RIGHT_ARM =             new LandmarksInfo(12, "mixamorigRightArm",          73, []);
    static RIGHT_FORE_ARM =        new LandmarksInfo(14, "mixamorigRightForeArm",      12, []);
    static RIGHT_HAND =            new LandmarksInfo(16, "mixamorigRightHand",         14, []);
    static LEFT_SHOULDER =         new LandmarksInfo(74, "mixamorigLeftShoulder",      37, []);
    static LEFT_ARM =              new LandmarksInfo(11, "mixamorigLeftArm",           74, []);
    static LEFT_FORE_ARM =         new LandmarksInfo(13, "mixamorigLeftForeArm",       11, []);
    static LEFT_HAND =             new LandmarksInfo(15, "mixamorigLeftHand",          13, []);
    static LEFT_INDEX1 =            new LandmarksInfo(39, "mixamorigLeftHandIndex1",   15, []);
    static LEFT_INDEX2 =            new LandmarksInfo(41, "mixamorigLeftHandIndex2",   39, []);
    static LEFT_INDEX3 =            new LandmarksInfo(43, "mixamorigLeftHandIndex3",   41, []);
    static LEFT_INDEX4 =            new LandmarksInfo(21, "mixamorigLeftHandIndex4",   43, []);
    static RIGHT_INDEX1 =           new LandmarksInfo(40, "mixamorigRightHandIndex1",  16, []);
    static RIGHT_INDEX2 =           new LandmarksInfo(42, "mixamorigRightHandIndex2",  40, []);
    static RIGHT_INDEX3 =           new LandmarksInfo(44, "mixamorigRightHandIndex3",  42, []);
    static RIGHT_INDEX4 =           new LandmarksInfo(22, "mixamorigRightHandIndex4",  44, []);
    static LEFT_THUMB1 =            new LandmarksInfo(45, "mixamorigLeftHandThumb1",   15, []);
    static LEFT_THUMB2 =            new LandmarksInfo(47, "mixamorigLeftHandThumb2",   45, []);
    static LEFT_THUMB3 =            new LandmarksInfo(49, "mixamorigLeftHandThumb3",   47, []);
    static LEFT_THUMB4 =            new LandmarksInfo(19, "mixamorigLeftHandThumb4",   49, []);
    static RIGHT_THUMB1 =           new LandmarksInfo(46, "mixamorigRightHandThumb1",  16, []);
    static RIGHT_THUMB2 =           new LandmarksInfo(48, "mixamorigRightHandThumb2",  46, []);
    static RIGHT_THUMB3 =           new LandmarksInfo(50, "mixamorigRightHandThumb3",  48, []);
    static RIGHT_THUMB4 =           new LandmarksInfo(20, "mixamorigRightHandThumb4",  50, []);
    static LEFT_MIDDLE1 =           new LandmarksInfo(51, "mixamorigLeftHandMiddle1",  15, []);
    static LEFT_MIDDLE2 =           new LandmarksInfo(53, "mixamorigLeftHandMiddle2",  51, []);
    static LEFT_MIDDLE3 =           new LandmarksInfo(55, "mixamorigLeftHandMiddle3",  53, []);
    static LEFT_MIDDLE4 =           new LandmarksInfo(57, "mixamorigLeftHandMiddle4",  55, []);
    static RIGHT_MIDDLE1 =          new LandmarksInfo(52, "mixamorigRightHandMiddle1", 16, []);
    static RIGHT_MIDDLE2 =          new LandmarksInfo(54, "mixamorigRightHandMiddle2", 52, []);
    static RIGHT_MIDDLE3 =          new LandmarksInfo(56, "mixamorigRightHandMiddle3", 54, []);
    static RIGHT_MIDDLE4 =          new LandmarksInfo(58, "mixamorigRightHandMiddle4", 56, []);
    static LEFT_RING1 =             new LandmarksInfo(59, "mixamorigLeftHandRing1",    15, []);
    static LEFT_RING2 =             new LandmarksInfo(61, "mixamorigLeftHandRing2",    59, []);
    static LEFT_RING3 =             new LandmarksInfo(63, "mixamorigLeftHandRing3",    61, []);
    static LEFT_RING4 =             new LandmarksInfo(65, "mixamorigLeftHandRing4",    63, []);
    static RIGHT_RING1 =            new LandmarksInfo(60, "mixamorigRightHandRing1",   16, []);
    static RIGHT_RING2 =            new LandmarksInfo(62, "mixamorigRightHandRing2",   60, []);
    static RIGHT_RING3 =            new LandmarksInfo(64, "mixamorigRightHandRing3",   62, []);
    static RIGHT_RING4 =            new LandmarksInfo(66, "mixamorigRightHandRing4",   64, []);
    static LEFT_PINKY1 =            new LandmarksInfo(67, "mixamorigLeftHandPinky1",   15, []);
    static LEFT_PINKY2 =            new LandmarksInfo(69, "mixamorigLeftHandPinky2",   67, []);
    static LEFT_PINKY3 =            new LandmarksInfo(71, "mixamorigLeftHandPinky3",   69, []);
    static LEFT_PINKY4 =            new LandmarksInfo(17, "mixamorigLeftHandPinky4",   71, []);
    static RIGHT_PINKY1 =           new LandmarksInfo(68, "mixamorigRightHandPinky1",  16, []);
    static RIGHT_PINKY2 =           new LandmarksInfo(70, "mixamorigRightHandPinky2",  68, []);
    static RIGHT_PINKY3 =           new LandmarksInfo(72, "mixamorigRightHandPinky3",  70, []);
    static RIGHT_PINKY4 =           new LandmarksInfo(16, "mixamorigRightHandPinky4",  72, []);
    static HEAD_TOP_END =           new LandmarksInfo(39, "mixamorigHeadTop_End",       0 , []);

    constructor(idx, name, parent_idx, children_names) {
        this.idx = idx;
        this.name = name;
        this.parent_idx = parent_idx;
        this.children_names = children_names;
    }
}

// Based on mixamo skeleton
function createSkeleton() {

    const bones = [];

    // used to store bone by landmark index, necessary to create hierarchy
    const temp_map = {};

    var lmInfoArray = Object.keys(LM_INFO);

    for (const lm_data in lmInfoArray) {

        var lm_info = LM_INFO[lmInfoArray[lm_data]];

        var bone = new THREE.Bone();
        bone.name = lm_info.name;

        bone.position.x = lm_info.position.x;
        bone.position.y = lm_info.position.y;
        bone.position.z = lm_info.position.z;

        bone.quaternion.x = lm_info.rotation.x;
        bone.quaternion.y = lm_info.rotation.y;
        bone.quaternion.z = lm_info.rotation.z;
        bone.quaternion.w = lm_info.rotation.w;
        bone.matrixWorldNeedsUpdate = true
        temp_map[lm_info.idx] = bone;

        if (lm_info.parent_idx != -1) {

            if (temp_map[lm_info.parent_idx] != undefined) {
                temp_map[lm_info.parent_idx].add(bone);
            }
        }

        bones.push( bone );
    }

    return new THREE.Skeleton( bones );
}
function updateSkeleton(skeleton) {


    var lmInfoArray = Object.keys(LM_INFO);

    for (const lm_data in lmInfoArray) {

        var lm_info = LM_INFO[lmInfoArray[lm_data]];

        for(var i = 0; i<skeleton.length;i++){
            var name = skeleton[i].name.replaceAll(/[-_.:]/g,"").toUpperCase();
            if(lm_info.name.replaceAll(/[-_.:]/g,"").toUpperCase() == name)
            {
                LM_INFO[lmInfoArray[lm_data]].name = skeleton[i].name;
                LM_INFO[lmInfoArray[lm_data]].position = skeleton[i].position.clone();
                LM_INFO[lmInfoArray[lm_data]].rotation = new THREE.Quaternion()//skeleton[i].quaternion.clone();
                rskeleton.push(LM_INFO[lmInfoArray[lm_data]]);
                continue;
                /*temp_map[lm_info.idx] = bone;

                if (lm_info.parent_idx != -1) {

                    if (temp_map[lm_info.parent_idx] != undefined) {
                        temp_map[lm_info.parent_idx].add(bone);
                    }
                }

                bones.push( bone );*/
            }
        }

    }
}
function automap(bones){
    var lmInfoArray = Object.keys(LM_INFO);

    for (const lm_data in lmInfoArray) {

        var lm_info = LM_INFO[lmInfoArray[lm_data]];

        for(var i = 0; i<bones.length;i++){
            var name = bones[i].name.replaceAll(/[-_.:]/g,"").toUpperCase();
            if(lm_info.name.replaceAll(/[-_.:]/g,"").toUpperCase() == name)
            {
                LM_INFO[lmInfoArray[lm_data]].map = i;
                map_names[lm_info.name] = bones[i].name;
            }
        }

    }
}
function renameAnimationBones(anim, bones)
{
    var new_anim = anim.clone();
    var tracks = [];
				
    for(var i = 0; i < new_anim.tracks.length; i++){
        var name = new_anim.tracks[i].name;
        
        name = name.replaceAll(".position", "").replaceAll('.quaternion', "").replaceAll(".scale", "");
        new_anim.tracks[i].name = new_anim.tracks[i].name.replaceAll(name, map_names[name]);
        if(name.includes(".quaternion"))
            tracks.push(new_anim.tracks[i])
    }
    new_anim.tracks = tracks;
    return new_anim;
}
function getBindPose(skeleton){
    var bones = [];
    var map = {};

    for(var i = 0; i<skeleton.bones.length; i++){
        map[skeleton.bones[i].name] = i;
    }

    for(var i = 0; i<skeleton.bones.length; i++){
        var bone = new THREE.Bone();
        bone.name = skeleton.bones[i].name;
        var parent = skeleton.bones[i].parent;
        bone.parent = bones[map[parent.name]];
        // If no parent bone, The inverse is enough
        var bindMatInverse = skeleton.boneInverses[i];
        var mat = new THREE.Matrix4();
        mat.fromArray(bindMatInverse);
        mat = bindMatInverse.clone();
        mat.elements = new Float32Array(mat.elements);
        mat.invert(); 	// Child Bone UN-Inverted

        // if parent exists, keep it parent inverted since thats how it exists in gltf
        // BUT invert the child bone then multiple to get local space matrix.
        // parent_worldspace_mat4_invert * child_worldspace_mat4 = child_localspace_mat4
        //  child_worldspace_mat4 = parent_worldspace_mat4 *child_localspace_mat4
        if (parent && parent.name !="Armature") { 
            var pBindMatInverse = skeleton.boneInverses[map[parent.name]];
            var pmat = new THREE.Matrix4();
            pmat.fromArray(pBindMatInverse); // Parent Bone Inverted
            pmat = pBindMatInverse.clone();
            pmat.elements = new Float32Array(pmat.elements);
            mat.multiplyMatrices(pmat,mat);	
        }  
        else if(parent.name == "Armature")
        {
            parent.scale.set(0.5,0.5,0.5);

            bone.parent = parent;
        }

        //bone.matrixWorld.copy(bindMatInverse) 
        bone.matrix.copy(mat)
        var pos = mat.getPosition();
        bone.position.copy(pos);
        

        var rot = new THREE.Quaternion().fromArray(mat.getRotationNormalized(new Float32Array(4)));
        bone.quaternion.copy(rot);

        var scale = new THREE.Vector3().fromArray(mat.getScale());
        bone.scale.copy(scale)//scale.multiplyScalar(0.5) );
        bone.updateMatrixWorld();
        bone.matrixWorldNeedsUpdate = true
        
        
        bones.push( bone );
    }
    // Compute the Fungi Local & World Transform Bind Pose
    // THREE will compute the inverse matrix bind pose on its own when bones 
    // are given to THREE.Skeleton

    let b, p;
    for( b of bones ){
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Copy current local space transform of the bone
    /*  b.local.rot.from_struct( b.ref.quaternion );
        b.local.pos.from_struct( b.ref.position );
        b.local.scl.from_struct( b.ref.scale );
    */
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Compute its world space transform based on parent's ws transform.
        b.world = {
            pos : new THREE.Vector3(),
            rot : new THREE.Quaternion(),
            scl : new THREE.Vector3()
        }
       if( b.parent != null && b.parent.name!= "Armature"){
            p = bones[ map[b.parent.name] ];
           
            // POSITION - parent.position + ( parent.rotation * ( parent.scale * child.position ) )
            var v = new THREE.Vector3();
            v.multiplyVectors( p.world.scl, b.position ); // parent.scale * child.position;
			v.applyQuaternion( p.world.rot ); //Vec3.transform_quat( v, tp.rot, v );
			b.world.pos.addVectors( p.world.pos, v ); // Vec3.add( tp.pos, v, this.pos );

			//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
			// SCALE - parent.scale * child.scale
			b.world.scl.multiplyVectors( p.world.scl, b.scale );

			//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
			// ROTATION - parent.rotation * child.rotation
			//this.rot.from_mul( tp.rot, tc.rot );
            b.world.rot.multiplyQuaternions(p.world.rot, b.quaternion)

           /* b.world.pos.addVectors(p.wolrd.pos, b.position);
            b.world.rot.addQuaternions(p.wolrd.pos, b.position);
            b.world.scl.addVectors(p.wolrd.pos, b.position);
            b.world.from_add( p.world, b.local );*/
        }else {
            b.world.pos.copy(b.position)  ;
            b.world.scl.copy(b.scale)  ;
            b.world.rot.copy(b.quaternion)  ;
        }
        b.updateMatrix();
        b.updateWorldMatrix()
    }
		
    return bones;
}
// Returns a quaternion representing the rotational component of a transformation matrix. If a matrix is built with
// fromRotationTranslation, the returned quaternion will be the same as the quaternion originally supplied
THREE.Matrix4.prototype.getRotation = function ( out=null ){
    // Algorithm taken from http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm
    let trace	= this.elements[0] + this.elements[5] + this.elements[10],
        S		= 0;

    out = out || [0,0,0,1];
    if(trace > 0){
        S = Math.sqrt(trace + 1.0) * 2;
        out[3] = 0.25 * S;
        out[0] = (this.elements[6] - this.elements[9]) / S;
        out[1] = (this.elements[8] - this.elements[2]) / S; 
        out[2] = (this.elements[1] - this.elements[4]) / S; 
    }else if( (this.elements[0] > this.elements[5]) & (this.elements[0] > this.elements[10]) ){ 
        S = Math.sqrt(1.0 + this.elements[0] - this.elements[5] - this.elements[10]) * 2;
        out[3] = (this.elements[6] - this.elements[9]) / S;
        out[0] = 0.25 * S;
        out[1] = (this.elements[1] + this.elements[4]) / S; 
        out[2] = (this.elements[8] + this.elements[2]) / S; 
    }else if(this.elements[5] > this.elements[10]){ 
        S = Math.sqrt(1.0 + this.elements[5] - this.elements[0] - this.elements[10]) * 2;
        out[3] = (this.elements[8] - this.elements[2]) / S;
        out[0] = (this.elements[1] + this.elements[4]) / S; 
        out[1] = 0.25 * S;
        out[2] = (this.elements[6] + this.elements[9]) / S; 
    }else{ 
        S = Math.sqrt(1.0 + this.elements[10] - this.elements[0] - this.elements[5]) * 2;
        out[3] = (this.elements[1] - this.elements[4]) / S;
        out[0] = (this.elements[8] + this.elements[2]) / S;
        out[1] = (this.elements[6] + this.elements[9]) / S;
        out[2] = 0.25 * S;
    }
    return out;
}
THREE.Matrix4.prototype.getRotationNormalized = function( out=null ){
    let rotation = this.getRotation(out);
    let len =  rotation[0]**2 + rotation[1]**2 + rotation[2]**2 + rotation[3]**2;
    if(len > 0){
        len = 1 / Math.sqrt( len );
        rotation[0] = rotation[0] * len;
        rotation[1] = rotation[1] * len;
        rotation[2] = rotation[2] * len;
        rotation[3] = rotation[3] * len;
    }
    return rotation;
}
THREE.Matrix4.prototype.getScale = function( out=null ){
    out = out || [0,0,0];
    let m11 = this.elements[0],
        m12 = this.elements[1],
        m13 = this.elements[2],
        m21 = this.elements[4],
        m22 = this.elements[5],
        m23 = this.elements[6],
        m31 = this.elements[8],
        m32 = this.elements[9],
        m33 = this.elements[10];
    out[0] = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
    out[1] = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
    out[2] = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);
    return out;
}
THREE.Matrix4.prototype.scale = function(x,y,z){
    this.elements[1] *= x;
    this.elements[2] *= x;
    this.elements[3] *= x;
    this.elements[4] *= y;
    this.elements[5] *= y;
    this.elements[6] *= y;
    this.elements[7] *= y;
    this.elements[8] *= z;
    this.elements[9] *= z;
    this.elements[10] *= z;
    this.elements[11] *= z;
}
//Transform source and target bones rotations into world space
function getWorldTransform(src_tbones, tgt_tbones, src, tgt, anim) {

    for (var s_idx = 0; s_idx < rskeleton.length; s_idx++) {
        var t_idx = rskeleton[s_idx].map;
        
        //Bind pose
        let src_bind = src_tbones[s_idx];
        let tgt_bind = tgt_tbones[t_idx];
        //Pose
        let src_pose = src.bones[s_idx];
        let tgt_pose = tgt.bones[t_idx];

        let src_bind_world = new THREE.Quaternion();
        //src_bind.getWorldQuaternion(src_bind_world); //World space bone rot
        src_bind_world = src_bind.world.rot; //World space bone rot

        let tgt_bind_world = new THREE.Quaternion();
        //tgt_bind.getWorldQuaternion(tgt_bind_world); //World space bone rot
        tgt_bind_world = tgt_bind.world.rot;

        let src_parent_bind_rot = new THREE.Quaternion();
        if(src_bind.parent.name == "Armature")
            src_parent_bind_rot = src_bind.parent.quaternion.clone();
        else
            src_bind.parent.getWorldQuaternion(src_parent_bind_rot); //World space parent bone rot

        let tgt_parent_bind_rot = new THREE.Quaternion();
        if(tgt_bind.parent.name == "Armature")
            tgt_parent_bind_rot = tgt_parent_bind_rot//tgt_bind.parent.quaternion.clone();
        else
            tgt_bind.parent.getWorldQuaternion(tgt_parent_bind_rot); //World space parent bone rot

        //Model space difference between tposes
        var convert = src_bind_world.clone();
        convert.invert().multiply(tgt_bind_world);

        //Isolate each bone change in Model space tpose
        //Using Tpose model space of the parent, but local rotation of the bone
        var diff = new THREE.Quaternion();
        diff.multiplyQuaternions( src_parent_bind_rot, src_pose.quaternion); //diff between bind pose and animated pose

        //shift the src bone rotation into the target's bone using the tpose difference
        //orientation stuff
        if(new THREE.Quaternion().dot(diff, src_bind_world) <0)
        {
            convert.set(-convert.x, -convert.y, -convert.y,-convert.w);
        }
        var tgt_bind_inv = tgt_bind.quaternion.clone();
        diff.multiply(convert).premultiply(tgt_bind_inv.invert());
        tgt_pose.quaternion.copy(diff);
        //tgt_pose.updateMatrix()
        if(tgt_pose.name.includes("Hips")){
            let src_bind_world_pos = new THREE.Vector3();
            src_bind.getWorldPosition(src_bind_world_pos);//World space bone pos

            let src_pose_world_pos = new THREE.Vector3();
            src_pose.getWorldPosition(src_pose_world_pos);//World space bone pos

            let tgt_bind_world_pos = new THREE.Vector3();
            tgt_bind.getWorldPosition(tgt_bind_world_pos);//World space bone pos

            let tgt_pose_world_pos = new THREE.Vector3();
            tgt_pose.getWorldPosition(tgt_pose_world_pos);//World space bone pos

            var a = src_bind_world_pos.clone();
            var b = tgt_bind_world_pos.clone();
            b.divide(a);

            var pos = new THREE.Vector3();
            pos.sub(src_pose_world_pos, src_bind_world_pos);
            pos.multiply(b);
            pos.add(tgt_pose_world_pos);
            
            if(true)//// Only Move Up and Down --> Can be a flag (parameter)
            {
                pos.x = tgt_bind_world_pos.x;
                pos.z = tgt_bind_world_pos.z;
            }
            tgt_pose.position.set(pos.x, pos.y, pos.z);
        }
      /*  //Get data in local and model space
        let src_local = src.bones[s_idx].quaternion; //Local space bone rot
        let src_world = new THREE.Quaternion();
        src.bones[s_idx].getWorldQuaternion(src_world); //World space bone rot
        let src_parent_world = new THREE.Quaternion();
        src.bones[s_idx].parent.getWorldQuaternion(src_parent_world); //World space parent bone rot

        let tgt_local = tgt.bones[t_idx].quaternion; //Local space bone rot
        let tgt_world = new THREE.Quaternion();
        tgt.bones[t_idx].getWorldQuaternion(tgt_world); //World space bone rot
        let tgt_parent_world = new THREE.Quaternion();
        tgt.bones[t_idx].parent.getWorldQuaternion(tgt_parent_world); //World space parent bone rot

        //Model space difference between tposes
        var convert = src_world.clone();
        convert.invert().multiply(tgt_world);

        //Isolate each bone change in Model space tpose
        //Using Tpose model space of the parent, but local rotation of the bone
        var diff = new THREE.Quaternion();
        diff.multiplyQuaternions( src_parent_world, src_local); //diff between bind pose and animated pose

        //shift the src bone rotation into the target's bone using the tpose difference
        //orientation stuff
        if(new THREE.Quaternion().dot(diff, src_world) <0)
        {
            quat.set(-quat.x, -quat.y, -quat.y,-quat.w);
            diff.multiply(quat.invert());
        }else
            diff.multiply(quat);
        
        diff.premultiply(tgt_parent_world.invert()); //move bone to local space for the target bone

        tgt.bones[t_idx].quaternion.copy(diff);
        var new_anim = [];
        var track = anim.tracks[s_idx];
        for( var i = 0; i <4; i++)
        {
            var q = new THREE.Quaternion(track.values[i], track.values[i+1], track.values[i+2], track.values[i+3]); //local rotation
            
        }*/
    }
}

//For every single bone translate from the world space of source to the world space transform in target

//

/*invert() {

    // based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm
    const te = this.elements,

        a00 = te[ 0 ], a01 = te[ 1 ], a02 = te[ 2 ], a03 = te[ 3 ],
        a10 = te[ 4 ], a11 = te[ 5 ], a12 = te[ 6 ], a13 = te[ 7 ],
        a20 = te[ 8 ], a21 = te[ 9 ], a22 = te[ 10 ], a23 = te[ 11 ],
        a30 = te[ 12 ], a31 = te[ 13 ], a32 = te[ 14 ], a33 = te[ 15 ],

        t11 = a21 * a32 * a13 - a31 * a22 * a13 + a31 * a12 * a23 - a11 * a32 * a23 - a21 * a12 * a33 + a11 * a22 * a33,
        t12 = a30 * a22 * a13 - a20 * a32 * a13 - a30 * a12 * a23 + a10 * a32 * a23 + a20 * a12 * a33 - a10 * a22 * a33,
        t13 = a20 * a31 * a13 - a30 * a21 * a13 + a30 * a11 * a23 - a10 * a31 * a23 - a20 * a11 * a33 + a10 * a21 * a33,
        t14 = a30 * a21 * a12 - a20 * a31 * a12 - a30 * a11 * a22 + a10 * a31 * a22 + a20 * a11 * a32 - a10 * a21 * a32;

    a00_t11 = a00*(a21 * a32 * a13 - a31 * a22 * a13 + a31 * a12 * a23 - a11 * a32 * a23 - a21 * a12 * a33 + a11 * a22 * a33);
    a00_t11 = a00*a21 * a32 * a13 - a00*a31 * a22 * a13 + a00*a31 * a12 * a23 - a00*a11 * a32 * a23 - a00*a21 * a12 * a33 + a00*a11 * a22 * a33;
    a00_t11 = b1 - b2 + b3 - b4 - b5 + b6;
    b1 = a00*a21 * a32 * a13;
    b2 = a00*a31 * a22 * a13;
    b3 = a00*a31 * a12 * a23;
    b4 = a00*a11 * a32 * a23;
    b5 = a00*a21 * a12 * a33;
    b6 = a00*a11 * a22 * a33;
    const det = a00 * t11 + a01 * t12 + a02 * t13 + a03 * t14;

    if ( det === 0 ) return this.set( 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 );

    const detInv = 1 / det;

    te[ 0 ] = t11 * detInv;
    te[ 1 ] = ( a31 * a22 * a03 - a21 * a32 * a03 - a31 * a02 * a23 + a01 * a32 * a23 + a21 * a02 * a33 - a01 * a22 * a33 ) * detInv;
                a02 * a21 * a33 - a23 * a31 - a01 * a22 * a33 - a23 * a32 - a03 * a21 * a32 - a22 * a31

    te[ 2 ] = ( a11 * a32 * a03 - a31 * a12 * a03 + a31 * a02 * a13 - a01 * a32 * a13 - a11 * a02 * a33 + a01 * a12 * a33 ) * detInv;
    te[ 3 ] = ( a21 * a12 * a03 - a11 * a22 * a03 - a21 * a02 * a13 + a01 * a22 * a13 + a11 * a02 * a23 - a01 * a12 * a23 ) * detInv;

    te[ 4 ] = t12 * detInv;
    te[ 5 ] = ( a20 * a32 * a03 - a30 * a22 * a03 + a30 * a02 * a23 - a00 * a32 * a23 - a20 * a02 * a33 + a00 * a22 * a33 ) * detInv;
    te[ 6 ] = ( a30 * a12 * a03 - a10 * a32 * a03 - a30 * a02 * a13 + a00 * a32 * a13 + a10 * a02 * a33 - a00 * a12 * a33 ) * detInv;
    te[ 7 ] = ( a10 * a22 * a03 - a20 * a12 * a03 + a20 * a02 * a13 - a00 * a22 * a13 - a10 * a02 * a23 + a00 * a12 * a23 ) * detInv;

    te[ 8 ] = t13 * detInv;
    te[ 9 ] = ( a30 * a21 * a03 - a20 * a31 * a03 - a30 * a01 * a23 + a00 * a31 * a23 + a20 * a01 * a33 - a00 * a21 * a33 ) * detInv;
    te[ 10 ] = ( a10 * a31 * a03 - a30 * a11 * a03 + a30 * a01 * a13 - a00 * a31 * a13 - a10 * a01 * a33 + a00 * a11 * a33 ) * detInv;
    te[ 11 ] = ( a20 * a11 * a03 - a10 * a21 * a03 - a20 * a01 * a13 + a00 * a21 * a13 + a10 * a01 * a23 - a00 * a11 * a23 ) * detInv;

    te[ 12 ] = t14 * detInv;
    te[ 13 ] = ( a20 * a31 * a02 - a30 * a21 * a02 + a30 * a01 * a22 - a00 * a31 * a22 - a20 * a01 * a32 + a00 * a21 * a32 ) * detInv;
    te[ 14 ] = ( a30 * a11 * a02 - a10 * a31 * a02 - a30 * a01 * a12 + a00 * a31 * a12 + a10 * a01 * a32 - a00 * a11 * a32 ) * detInv;
    te[ 15 ] = ( a10 * a21 * a02 - a20 * a11 * a02 + a20 * a01 * a12 - a00 * a21 * a12 - a10 * a01 * a22 + a00 * a11 * a22 ) * detInv;

    return this;

}*/
export {createSkeleton, updateSkeleton, getWorldTransform, automap, getBindPose, renameAnimationBones}