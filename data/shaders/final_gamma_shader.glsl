
\fx.fs
	precision highp float;
	
	varying vec2 v_coord;
	uniform sampler2D u_texture;
	
	void main() {
		gl_FragColor = vec4( pow(texture2D(u_texture, v_coord).rgb, vec3(0.5)), 1.0 );
	}
