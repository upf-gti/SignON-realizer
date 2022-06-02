import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';

import { ShaderChunk } from './shaders.js'


// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

class Player {

    constructor() {
        
        this.clock = new THREE.Clock(false);
        this.loaderGLB = new GLTFLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.spotLight = null;
        this.pointLight = null;
 
        this.model = null;

        this.renderTarget = null;
        this.postScene = null;
        this.postCamera = null;
    }
    
    init(onLoaded) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0x2A2928 );
        this.scene.fog = new THREE.Fog( 0x2A2928, 100, 150 );
        
        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshPhongMaterial( { color: 0x151414, depthWrite: false } ) );
        ground.position.y = 0; // it is moved because of the mesh scale
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );
        
        // // lights
        // let hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        // hemiLight.position.set( 0, 20, 0 );
        // this.scene.add( hemiLight );

        // let spotLight = new THREE.SpotLight( 0xffa95c, 1 );
        // spotLight.position.set( -50, 50, 50);
        // spotLight.castShadow = true;
        // spotLight.shadow.bias = -0.00001;
        // spotLight.shadow.mapSize.width = 1024 * 8;
        // spotLight.shadow.mapSize.height = 1024 * 8;
        // this.scene.add( spotLight );
        // this.spotLight = spotLight;

        // let dirLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        // dirLight.position.set( 3, 10, 50 );
        // dirLight.castShadow = false;
        // this.scene.add( dirLight );

        let pointLight = new THREE.PointLight( 0xffa95c, 1 );
        pointLight.position.set( 0, 2.5, 8);
        pointLight.castShadow = true;
        pointLight.shadow.bias = -0.00001;
        pointLight.shadow.mapSize.width = 1024 * 8;
        pointLight.shadow.mapSize.height = 1024 * 8;
        this.scene.add( pointLight );
        this.pointLight = pointLight;
        
        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.7;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild( this.renderer.domElement );

        // camera
        let AR =  window.innerWidth/window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, AR, 0.01, 1000);
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.object.position.set(0.0, 3.4, 8);
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 50;
        this.controls.target.set(0.0, 2.6, 0);
        this.controls.update();

       

        // so the screen is not black while loading
        this.renderer.render( this.scene, this.camera );
        
        // Load the model
        this.loaderGLB.load( './data/models/Eva_Y.glb', (glb) => {

            this.model = glb.scene;
            this.model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            this.model.position.set(0, -8.0, 0);
            this.model.scale.set(8.0, 8.0, 8.0);
            this.model.castShadow = true;
            
            this.model.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    if (object.name == "Eyelashes")
                        object.castShadow = false;
                    if(object.material.map) object.material.map.anisotropy = 16; 
                    
                } else if (object.isBone) {
                    object.scale.set(1.0, 1.0, 1.0);
                }
            } );
            
            
            // Create a multi render target with Float buffers
            this.renderTarget = new THREE.WebGLMultipleRenderTargets(
                window.innerWidth * window.devicePixelRatio,
                window.innerHeight * window.devicePixelRatio,
                1
            );

            for ( let i = 0, il = this.renderTarget.texture.length; i < il; i ++ ) {

                this.renderTarget.texture[ i ].minFilter = THREE.NearestFilter;
                this.renderTarget.texture[ i ].magFilter = THREE.NearestFilter;
                this.renderTarget.texture[ i ].type = THREE.FloatType;

            }

            // Name our G-Buffer attachments for debugging

            this.renderTarget.texture[ 0 ].name = 'pc_fragColor';
            // this.renderTarget.texture[ 1 ].name = 'outColor1';
           // this.renderTarget.texture[ 2 ].name = 'outColor2';
            
            
            // PostProcessing setup

            this.postScene = new THREE.Scene();
            this.postCamera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

            this.postScene.add( new THREE.Mesh(
                new THREE.PlaneGeometry( 2,2 ),
                new THREE.RawShaderMaterial( {
                    vertexShader: ShaderChunk.vertexShaderQuad(),
                    fragmentShader: ShaderChunk.fragmentShaderQuad(),
                    uniforms: {
                        t0: { value: this.renderTarget.texture[ 0 ] },
                        // t1: { value: this.renderTarget.texture[ 1 ] },
                        //t2: { value: this.renderTarget.texture[ 2 ] },
                    },
                    glslVersion: THREE.GLSL3
                } )
            ) );
            let uniforms =  THREE.UniformsLib.lights;
            
            const loader = new THREE.TextureLoader();

            const color_texture = loader.load( './data/textures/Woman_Body_Diffuse.png', this.render.bind(this) );
            color_texture.wrapS = THREE.RepeatWrapping;
            color_texture.wrapT = THREE.RepeatWrapping;

            const specular_texture = loader.load( './data/textures/Woman_Body_Specular.png', this.render.bind(this) );
            specular_texture.wrapT = THREE.RepeatWrapping;
            specular_texture.wrapS = THREE.RepeatWrapping;

            // const normal_texture = loader.load( 'textures/hardwood2_diffuse.jpg', render );
            // normal_texture.wrapS = THREE.RepeatWrapping;
            // normal_texture.wrapT = THREE.RepeatWrapping;

            const sss_texture = loader.load( './data/textures/woman_body_sss.png', this.render.bind(this) );
            sss_texture.wrapS = THREE.RepeatWrapping;
            sss_texture.wrapT = THREE.RepeatWrapping;

            const transmitance_lut_texture = loader.load( './data/textures/transmitance_lut.png',this.render.bind(this) );
            transmitance_lut_texture.wrapS = THREE.RepeatWrapping;
            transmitance_lut_texture.wrapT = THREE.RepeatWrapping;

            const specular_lut_texture = loader.load( './data/textures/beckmann_lut.png', this.render.bind(this) );
            specular_lut_texture.wrapS = THREE.RepeatWrapping;
            specular_lut_texture.wrapT = THREE.RepeatWrapping;
            
            // uniforms["u_specular"] =  {type: 'number', value: 1};
            // uniforms["u_roughness"] =  {type: 'number', value: 1};
            // uniforms["u_normalmap_factor"] =  {type: 'number', value: 1};
            // uniforms["u_shadow_shrinking"] =  {type: 'number', value: 0.05};
            // uniforms["u_translucency_scale"] =  {type: 'number', value: 150.0};
            // uniforms["u_enable_translucency"] =  {type: 'boolean', value: true};
            // // uniforms["u_color_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/Woman_Body_Diffuse.png")};
            // // uniforms["u_specular_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/Woman_Body_Specular.png")};
            // uniforms["u_normal_texture"] =  {type: "t", texture: this.model.getObjectByName("Body").material.normalMap};
            // // uniforms["u_sss_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/woman_body_sss.png")};
            // // uniforms["u_transmitance_lut_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/transmitance_lut.png"), wrap: THREE.CLAMP_TO_EDGE};
            // // uniforms["u_specular_lut_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/beckmann_lut.png"), wrap: THREE.CLAMP_TO_EDGE};
            // uniforms["u_color_texture"] =  {value: color_texture};
            // uniforms["u_specular_texture"] =  {value : specular_texture};
            // uniforms["u_sss_texture"] =  {value: sss_texture};
            // uniforms["u_transmitance_lut_texture"] =  {value: transmitance_lut_texture};
            // uniforms["u_specular_lut_texture"] =  {value: specular_lut_texture};
        
            uniforms["u_specular"] =  {type: 'number', value: 1};
            uniforms["u_roughness"] =  {type: 'number', value: 1};
            uniforms["u_normalmap_factor"] =  {type: 'number', value: 1};
            uniforms["u_shadow_shrinking"] =  {type: 'number', value: 0.05};
            uniforms["u_translucency_scale"] =  {type: 'number', value: 150.0};
            uniforms["u_enable_translucency"] =  {type: 'boolean', value: true};
            // uniforms["u_color_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/Woman_Body_Diffuse.png")};
            // uniforms["u_specular_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/Woman_Body_Specular.png")};
            uniforms["normalMap"] =  {type: "t", value: this.model.getObjectByName("Body").material.normalMap};
            // uniforms["u_sss_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/woman_body_sss.png")};
            // uniforms["u_transmitance_lut_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/transmitance_lut.png"), wrap: THREE.CLAMP_TO_EDGE};
            // uniforms["u_specular_lut_texture"] =  {type: "t", texture: new THREE.TextureLoader("./data/textures/beckmann_lut.png"), wrap: THREE.CLAMP_TO_EDGE};
            uniforms["map"] =  { type: 't', value: this.model.getObjectByName("Body").material.map};
            uniforms["specularMap"] =  {value : specular_texture};
            uniforms["u_sss_texture"] =  {value: sss_texture};
            uniforms["u_transmitance_lut_texture"] =  {value: transmitance_lut_texture};
            uniforms["u_specular_lut_texture"] =  {value: specular_lut_texture};

            let material =  new THREE.ShaderMaterial({
                uniforms: uniforms,
                fragmentShader: ShaderChunk.getFragmentShader(),
                vertexShader: ShaderChunk.getVertexShader(),
                lights: true,
                glslVersion: THREE.GLSL3
            })
            material.colorWrite = true;
            material.extensions.drawBuffers = true;
            material.extensions.derivatives = true;
            
            this.model.getObjectByName("Body").material = material;

            
            this.scene.add(this.model);
            $('#loading').fadeOut(); //hide();
            this.clock.start()
            if(onLoaded)
                onLoaded(this);
        } );
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
    }


    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        let [x, y, z] = [... this.camera.position];
        //this.spotLight.position.set( x + 10, y + 10, z + 10);
        this.pointLight.position.set( x, y, z);
        this.controls.update();
        this.render();
        
        
    }
    render(){
        this.renderTarget.samples = 4;
        // render scene into target
        this.renderer.setRenderTarget( this.renderTarget );

        this.renderer.render( this.scene, this.camera );
        
        // render post FX
        this.renderer.setRenderTarget( null );
        this.renderer.render( this.postScene, this.postCamera );
    }
    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

}

 let player = new Player();
 player.init();

export { Player };
