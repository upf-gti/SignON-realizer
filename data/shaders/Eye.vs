#define USE_UV

#include <common>

out vec3 vWorldPosition;
out vec3 vLocalPosition;
out vec2 vUv;
out vec3 vViewPosition;

#include <color_pars_vertex>
#include <normal_pars_vertex>
#include <shadowmap_pars_vertex>

#include <logdepthbuf_pars_vertex>

void main() {
	#include <begin_vertex>
    
    vUv = uv;
	
    #include <color_vertex>
	
    #include <beginnormal_vertex>
	#include <defaultnormal_vertex>
    #include <normal_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>

	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    
    vWorldPosition = worldPosition.xyz;
    const float eyeballDiameter = 0.242;
    vLocalPosition = position;
    vViewPosition = -mvPosition.xyz;
}
