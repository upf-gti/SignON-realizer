
\fx.fs
  #extension GL_OES_standard_derivatives : enable
  
	precision highp float;
	
	varying vec2 v_coord;
	
	uniform float u_width;
	uniform float u_sssLevel;
	uniform float u_correction;
	uniform float u_maxdd;
	uniform vec2 u_invPixelSize;
	uniform vec2 u_camera_params;

	uniform sampler2D u_irrad_texture;
	uniform sampler2D u_depth_aux_texture;

	float linearDepthNormalized(float z, float near, float far){
    float z_n = 2.0 * z - 1.0;
    return 2.0 * near * far / (far + near - z_n * (far - near));
  }

	void main() {
		float w[6];
    w[0] = w[5] = 0.006;
    w[1] = w[4] = 0.061;
    w[2] = w[3] = 0.242;
    float o[6];
    o[0] = -1.0;
    o[1] = -0.667;
    o[2] = -0.333;
    o[3] = 0.333;
    o[4] = 0.667;
    o[5] = 1.0;

    vec3 depth_aux_value = texture2D(u_depth_aux_texture, v_coord).xyz;
    float depth = linearDepthNormalized(depth_aux_value.x, u_camera_params.x, u_camera_params.y);
    float mask = depth_aux_value.x > 0.0 ? 1.0 : 0.0;
    vec3 color = texture2D(u_irrad_texture, v_coord).rgb;

    if(mask == 1.0 && depth >= u_camera_params.x && depth <= u_camera_params.y){
      color *= 0.382;
      
      float s_y = u_sssLevel / (depth + u_correction * min(abs(dFdy(depth)), u_maxdd));
      vec2 finalWidth = s_y * u_width * u_invPixelSize * vec2(0.0, 1.0);
      vec2 offset;

      for(int i=0; i<6; i++){
        offset = v_coord + finalWidth*o[i];
        vec3 tap = texture2D(u_irrad_texture, offset).rgb;
        color.rgb += w[i] * (texture2D(u_depth_aux_texture, offset).x > 0.0 ? tap : color);
      }
    }
    
    gl_FragData[0] = vec4(color, 1.0);
	}
