#define USE_UV
#define USE_TANGENT

attribute vec4 tangent;

#include <common>

out vec3 vWorldPosition;
out vec2 vUv;
out vec3 vViewPosition;

#include <color_pars_vertex>

#include <normal_pars_vertex>

#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>

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

    vViewPosition = -mvPosition.xyz;
}
