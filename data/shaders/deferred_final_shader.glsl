
\fx.fs
  #extension GL_EXT_draw_buffers : require
  
	precision highp float;

	varying vec2 v_coord;

	uniform float u_time;
	uniform vec4 u_viewport;

	uniform sampler2D color_texture;
	uniform sampler2D normal_texture;
	uniform sampler2D detailed_normal_texture;
	uniform sampler2D depth_texture;

	uniform mat4 u_invvp;
	uniform vec2 u_camera_params;
  uniform vec3 u_camera_eye;

	uniform float u_ambientIntensity;
  uniform float u_shadowShrinking;
	uniform float u_translucencyScale;

	uniform vec3 u_light_position;
	uniform vec3 u_light_color;
	uniform vec4 u_light_att;
	uniform vec4 u_light_shadowmap_params;
	uniform mat4 u_light_shadowmap_vp;
	uniform sampler2D u_light_shadowmap;
	

	vec3 getPositionWSFromDepth(float depth){
		//build pixel info
		depth = depth * 2.0 - 1.0;
		vec2 pos2D = v_coord * 2.0 - vec2(1.0);
		vec4 pos = vec4( pos2D, depth, 1.0 );
		pos = u_invvp * pos;
		pos.xyz = pos.xyz / pos.w;
		return pos.xyz;
	}

	float linearDepthNormalized(float z, float near, float far){
    float z_n = 2.0 * z - 1.0;
    return 2.0 * near * far / (far + near - z_n * (far - near));
  }

  //can be precomputed
  vec3 T(float s){
    return vec3(0.233, 0.455, 0.649) * exp(-s*s/0.0064) +
    vec3(0.1, 0.336, 0.344) * exp(-s*s/0.0484) +
    vec3(0.118, 0.198, 0.0) * exp(-s*s/0.187) +
    vec3(0.113, 0.007, 0.007) * exp(-s*s/0.567) +
    vec3(0.358, 0.004, 0.0) * exp(-s*s/1.99) +
    vec3(0.078, 0.0, 0.0) * exp(-s*s/7.41);
  }

	float expFunc(float f)
	{
		return f*f*f*(f*(f*6.0-15.0)+10.0);
	}

	void main() {
    float depth = texture2D( depth_texture, v_coord ).x;
    float linearDepth = linearDepthNormalized(depth, u_camera_params[0], u_camera_params[1]);
    vec3 pos = getPositionWSFromDepth(depth);
    vec3 N = normalize(texture2D( normal_texture, v_coord ).xyz * 2.0 - 1.0);
    vec3 hN = normalize(texture2D( detailed_normal_texture, v_coord ).xyz * 2.0 - 1.0);
    vec3 L = (u_light_position - pos);
    float light_distance = length(L);
    L /= light_distance;
    
    float NdotL = max(0.0, dot(hN,L));
    NdotL *= 1.0 - (light_distance - u_light_att.x) / (u_light_att.y - u_light_att.x);
    
    vec3 albedo = texture2D( color_texture, v_coord ).rgb;
    float sss = texture2D( color_texture, v_coord ).a;
    float mask = texture2D( normal_texture, v_coord ).a;
    
    //Shadowmap
    float invtexsize = u_light_shadowmap_params.x;
    float texsize = 1.0/invtexsize;
    float bias = u_light_shadowmap_params.y;
    float near = u_light_shadowmap_params.z;
    float far = u_light_shadowmap_params.w;
    
    vec4 lspace_pos = u_light_shadowmap_vp * vec4(pos - u_shadowShrinking * N, 1.0); //Shrinking explained bt Jimenez et al
    lspace_pos = 0.5*(lspace_pos+vec4(1.0));
    
    vec2 sample = lspace_pos.xy;
    vec2 topleft_uv = sample * texsize;
    vec2 offset_uv = fract(topleft_uv);
    offset_uv.x = expFunc(offset_uv.x);
    offset_uv.y = expFunc(offset_uv.y);
    topleft_uv = floor(topleft_uv) * invtexsize;
    
    float topleft = texture2D(u_light_shadowmap, topleft_uv).x;
    float topright = texture2D(u_light_shadowmap, topleft_uv+vec2(invtexsize, 0.0)).x;
    float bottomleft = texture2D(u_light_shadowmap, topleft_uv+vec2(0.0, invtexsize)).x;
    float bottomright = texture2D(u_light_shadowmap, topleft_uv+vec2(invtexsize, invtexsize)).x;
    float top = mix(topleft, topright, offset_uv.x);
    float bottom = mix(bottomleft, bottomright, offset_uv.x);
    float sample_depth = mix(top, bottom, offset_uv.y);

    float real_depth = lspace_pos.z;
    //float sample_depth = texture2D(u_light_shadowmap, lspace_pos.xy).x;
    float light_depth = (sample_depth == 1.0) ? 1.0e9 : sample_depth;

    float lit = ((real_depth <= light_depth + bias) ? 1.0 : 0.0);
    
    //Transmitance (we use vertex normal because it does not contain high frequency detail)
    float u_scale = u_translucencyScale; //To be defined with uniform 
    float s = u_scale * abs(linearDepthNormalized(light_depth, near, far) - linearDepthNormalized(real_depth, near, far));
    float E = max(0.3 + dot(-N, L), 0.0);

    vec3 ambient = albedo * u_ambientIntensity;
    vec3 diffuse = albedo * u_light_color * NdotL * lit;
    vec3 transmitance = T(s) * u_light_color * albedo * E;
    
    vec3 final_color = ambient + diffuse;
    
		gl_FragData[0] = vec4(final_color, sss);
    gl_FragData[1] = vec4(transmitance, 1.0);
    gl_FragData[2] = vec4((mask == 1.0)?depth:0.0, 1.0, sss, 1.0);
	}
