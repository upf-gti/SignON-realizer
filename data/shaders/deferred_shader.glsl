\js
this.createSampler("Color Texture", "u_color_texture", {});
this.createSampler("Detail Normal Texture", "u_normal_texture", {});
this.createSampler("Opacity Texture", "u_opacity_texture", {missing: "white"});
this.createSampler("SSS intensity texture", "u_sss_texture", {missing: "black"});

this.createSampler("Noise Texture", "u_noise_texture", {missing: "white", minFilter: gl.NEAREST});
this._render_state.cull_face = false;
\default.vs

precision mediump float;
attribute vec3 a_vertex;
attribute vec3 a_normal;
attribute vec2 a_coord;

//varyings
varying vec3 v_pos;
varying vec3 v_normal;
varying vec2 v_uvs;

//matrices
uniform mat4 u_model;
uniform mat4 u_normal_model;
uniform mat4 u_view;
uniform mat4 u_viewprojection;
uniform mat4 u_mvp;

//globals
uniform float u_time;
uniform vec4 u_viewport;
uniform float u_point_size;

//camera
uniform vec3 u_camera_eye;

#pragma shaderblock "morphing"
#pragma shaderblock "skinning"

void main() {
	
	vec4 vertex4 = vec4(a_vertex,1.0);
	v_normal = a_normal;
	v_uvs = a_coord;
  
  //deforms
  applyMorphing( vertex4, v_normal );
  applySkinning( vertex4, v_normal );
	
	//vertex
	v_pos = (u_model * vertex4).xyz;
	//normal
	v_normal = (u_normal_model * vec4(v_normal,1.0)).xyz;
	gl_Position = u_viewprojection * vec4(v_pos,1.0);
}

\default.fs

#extension GL_OES_standard_derivatives : enable
#extension GL_EXT_draw_buffers : enable
  
precision mediump float;
//varyings
varying vec3 v_pos;
varying vec3 v_normal;
varying vec2 v_uvs;

//globals
uniform vec4 u_clipping_plane;
uniform float u_time;
uniform vec3 u_background_color;
uniform vec3 u_ambient_light;
uniform vec3 u_camera_eye;

//material
uniform vec4 u_material_color; //color and alpha
uniform sampler2D u_color_texture;
uniform sampler2D u_normal_texture;
uniform sampler2D u_opacity_texture;
uniform sampler2D u_sss_texture;
uniform sampler2D u_noise_texture;

vec3 linearizeColor(vec3 color){
	return pow(color, vec3(2.2));
}

mat3 cotangent_frame(vec3 N, vec3 p, vec2 uv){
	// get edge vectors of the pixel triangle
	#ifdef STANDARD_DERIVATIVES
	
	vec3 dp1 = dFdx( p );
	vec3 dp2 = dFdy( p );
	vec2 duv1 = dFdx( uv );
	vec2 duv2 = dFdy( uv );
	
	// solve the linear system
	vec3 dp2perp = cross( dp2, N );
	vec3 dp1perp = cross( N, dp1 );
	vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
	vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
	#else
	vec3 T = vec3(1.0,0.0,0.0); //this is wrong but its a fake solution
	vec3 B = cross(N,T);
	T = cross(B,N);
	#endif
	
	// construct a scale-invariant frame
	float invmax = inversesqrt( max( dot(T,T), dot(B,B) ) );
	return mat3( T * invmax, B * invmax, N );
}

vec3 perturbNormal( vec3 N, vec3 V, vec2 texcoord, vec3 normal_pixel ){
	// assume N, the interpolated vertex normal and
	// V, the view vector (vertex to eye)
	//vec3 normal_pixel = texture2D(normalmap, texcoord ).xyz;
	normal_pixel = normal_pixel * 255./127. - 128./127.;
	mat3 TBN = cotangent_frame(N, V, texcoord);
	return normalize(TBN * normal_pixel);
}

void main() {
  float t = texture2D(u_opacity_texture, v_uvs).x;
  float n = 0.6;//texture2D(u_noise_texture, 0.1*(vec2(0.5)*gl_FragCoord.xy + vec2(0.5))).x;
  if(n > t) discard;
  
  vec3 N = normalize( v_normal );
  vec3 detailedN = perturbNormal( N, u_camera_eye - v_pos, v_uvs, texture2D(u_normal_texture, v_uvs).rgb);
  
	gl_FragData[0] = vec4(u_material_color.rgb * linearizeColor(texture2D( u_color_texture, v_uvs).rgb), texture2D( u_sss_texture, v_uvs ).r);

  gl_FragData[1] = vec4(N*0.5 + vec3(0.5),1.0);
  gl_FragData[2] = vec4(detailedN*0.5 + vec3(0.5), 1.0);
}
