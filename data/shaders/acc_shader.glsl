
\fx.fs
	precision highp float;
	
	varying vec2 v_coord;

	uniform vec3 u_weight;
	uniform sampler2D u_color_texture;
	uniform sampler2D u_depth_aux_tex;
	

	void main() {
    vec4 color = texture2D( u_color_texture, v_coord );
    float sssIntensity = texture2D( u_depth_aux_tex, v_coord ).y;
		gl_FragColor = vec4(color.rgb * u_weight, sssIntensity);
	}
