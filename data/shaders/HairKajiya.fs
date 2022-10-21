#define USE_TANGENT
#define USE_ALPHAMAP
#define USE_UV 

#include <common>
#include <packing>

in vec2 vUv;
in vec3 vWorldPosition;

#include <color_pars_fragment>
#include <normal_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <alphamap_pars_fragment>
#include <lights_pars_begin>
#include <bsdfs>

// Uniforms to fill material data afterwards
uniform sampler2D u_hairColorMap;
uniform vec3 u_diffuseColor;
uniform float u_constantDiffuseFactor;
uniform float u_specularExp1;
uniform float u_specularExp2;
uniform float u_primaryShift;
uniform float u_secondaryShift;
uniform float u_specularStrength;

out vec4 fragColor;


// ------------------------------- Analogous block to <lights_phong_pars_fragment.glsl> -------------------------------

in vec3 vViewPosition;

struct HairKajiyaMaterial {
    // diffuse parameters
	vec3 diffuseColor;
    float constantDiffuseFactor;

    // specular parameters
    float primaryShift;
    float secondaryShift;
	float specularStrength;
	float specularExp1;
	float specularExp2;
    float shiftValue;
    float noiseShift;

    // AO parameters
    float ambientOcclusion;
};

// Define lighting equations and integrate them with the ThreeJS shader flow

// ----------------------------------------------------------------------------------------
// Based on https://web.engr.oregonstate.edu/~mjb/cs519/Projects/Papers/HairRendering.pdf
// ----------------------------------------------------------------------------------------

vec3 ShiftTangent(vec3 T, vec3 N, float shift)
{
    vec3 shiftedT = T + shift * N;
    return normalize(shiftedT);
}

float StrandSpecular(vec3 T, vec3 V, vec3 L, float exponent)
{
    vec3 H = normalize(L + V);
    float dotTH = dot(T, H);
    float sinTH = sqrt(1.0 - min(dotTH*dotTH, 0.99999));
    float dirAtten = smoothstep(-1.0, 0.0, dotTH);
    return dirAtten * pow(sinTH, exponent);
}

// Render equation (RE) that is going to be called by every light (see lights_fragment_begin.glsl.js)
void RE_Direct_HairKajiya(const in IncidentLight directLight, const in GeometricContext geometry, const in HairKajiyaMaterial material, inout ReflectedLight reflectedLight)// vec3 tangent, vec3 normal, vec3 lightVec, vec3 viewVec, vec2 uv, float ambOcc, float specFactor, vec3 hairColor)
{
    vec3 irradiance = directLight.color;
    // #ifndef PHYSICALLY_CORRECT_LIGHTS
	// 	irradiance *= PI; // punctual light
	// #endif

    // diffuse lighting: the lerp shifts the shadow boundary for a softer look
    vec3 diffuse = vec3(clamp(mix(0.25, 1.0, dot(geometry.normal, directLight.direction)), 0.0, 1.0));
    diffuse *= material.diffuseColor;

    // Add constant diffuse to simulate global scattering in the hair volume
    diffuse += material.diffuseColor * material.constantDiffuseFactor;

    // shift tangents
    vec3 t1 = ShiftTangent(vBitangent, geometry.normal, material.primaryShift + material.shiftValue);
    vec3 t2 = ShiftTangent(vBitangent, geometry.normal, material.secondaryShift + material.shiftValue);

    // specular lighting
    vec3 specularColor1 = directLight.color / max(max(directLight.color.r, directLight.color.g), directLight.color.b); // avoid results >1 and too small ones
    vec3 specular = specularColor1 * StrandSpecular(t1, geometry.viewDir, directLight.direction, material.specularExp1);

    // add 2nd specular term
    vec3 specularColor2 = mix(specularColor1, diffuse, 0.2);    // bleed a bit of the diffuse into the specularity to smooth and simule TRT lobe
    specular += specularColor2 * material.noiseShift * StrandSpecular(t2, geometry.viewDir, directLight.direction, material.specularExp2);

    // update accumulated diffuse and specular
    reflectedLight.directDiffuse += diffuse * irradiance * material.ambientOcclusion;
    reflectedLight.directSpecular += specular * irradiance * material.specularStrength;
}

// NOT USED ATM
void RE_IndirectDiffuse_HairKajiya( const in vec3 irradiance, const in GeometricContext geometry, const in HairKajiyaMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}

#define RE_Direct				RE_Direct_HairKajiya
// #define RE_IndirectDiffuse		RE_IndirectDiffuse_HairKajiya
#define Material_LightProbeLOD( material )	(0)
// --------------------------------------------------------------------------------------------------------------------

void main() {

    // Defined in <common> --> { vec3 directDiffuse; vec3 directSpecular; vec3 indirectDiffuse; vec3 indirectSpecular; }
    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
    
    #include <normal_fragment_begin>
    #include <normal_fragment_maps>
    geometryNormal = normal;

    vec2 uv = vUv;

    // ------------ Analogous block to <lights_phong_fragment.glsl> ------------
    // Fill material properties
    HairKajiyaMaterial material;
    material.diffuseColor = texture2D(u_hairColorMap, uv).rgb * u_diffuseColor;
    material.constantDiffuseFactor = u_constantDiffuseFactor;
    material.specularExp1 = u_specularExp1;
    material.specularExp2 = u_specularExp2;
    material.specularStrength = u_specularStrength;
    material.primaryShift = u_primaryShift;
	material.secondaryShift = u_secondaryShift;
    material.ambientOcclusion = 1.0;
    material.shiftValue = material.diffuseColor.r * 4.0;    // use r component as pseudo-unique strand id to offset the tangent
    material.noiseShift = material.diffuseColor.b * 4.0;    // use b component as pseudo-unique strand id to modulate sparkles (todo: use proper noise texture instead)
    // --------------------------------------------------------------------------

    // This iterates over all discrete light sources and calls the hair BSDF (rendering equation RE_Direct_HairKajiya)
    #include <lights_fragment_begin>
    
    // used in <lights_fragment_end>
    vec3 iblIrradiance = vec3( 0.0 );
    vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

    // Calls BRDF to apply for indirect lighting (rendering equation RE_IndirectDiffuse_HairKajiya)
	#include <lights_fragment_end>

    // Get final color output
    vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 totalSpecular = reflectedLight.directSpecular;
    vec3 outgoingLight = totalDiffuse + totalSpecular;

    // Get opacity for alpha to coverage
    float alphaSample = texture2D(alphaMap, vUv).r;

    fragColor = vec4(outgoingLight, alphaSample);

    // Analogous to <tonemapping_fragment>
    fragColor.rgb = toneMapping(fragColor.rgb);
}