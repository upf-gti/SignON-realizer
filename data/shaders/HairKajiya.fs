#define USE_TANGENT
#define USE_ALPHAMAP
#define USE_UV 
#define USE_ENVMAP
#define ENVMAP_MODE_REFLECTION
#define ENVMAP_TYPE_CUBE_UV

#include <common>
#include <packing>

in vec2 vUv;
in vec3 vWorldPosition;

// --------- Same as <cube_uv_reflection_fragment> but removing line throwing error ---------
#ifdef ENVMAP_TYPE_CUBE_UV
    #define cubeUV_maxMipLevel 8.0
    #define cubeUV_minMipLevel 4.0
    #define cubeUV_maxTileSize 256.0
    #define cubeUV_minTileSize 16.0
    // These shader functions convert between the UV coordinates of a single face of
    // a cubemap, the 0-5 integer index of a cube face, and the direction vector for
    // sampling a textureCube (not generally normalized ).
    float getFace( vec3 direction ) {
        vec3 absDirection = abs( direction );
        float face = - 1.0;
        if ( absDirection.x > absDirection.z ) {
            if ( absDirection.x > absDirection.y )
                face = direction.x > 0.0 ? 0.0 : 3.0;
            else
                face = direction.y > 0.0 ? 1.0 : 4.0;
        } else {
            if ( absDirection.z > absDirection.y )
                face = direction.z > 0.0 ? 2.0 : 5.0;
            else
                face = direction.y > 0.0 ? 1.0 : 4.0;
        }
        return face;
    }
    // RH coordinate system; PMREM face-indexing convention
    vec2 getUV( vec3 direction, float face ) {
        vec2 uv;
        if ( face == 0.0 ) {
            uv = vec2( direction.z, direction.y ) / abs( direction.x ); // pos x
        } else if ( face == 1.0 ) {
            uv = vec2( - direction.x, - direction.z ) / abs( direction.y ); // pos y
        } else if ( face == 2.0 ) {
            uv = vec2( - direction.x, direction.y ) / abs( direction.z ); // pos z
        } else if ( face == 3.0 ) {
            uv = vec2( - direction.z, direction.y ) / abs( direction.x ); // neg x
        } else if ( face == 4.0 ) {
            uv = vec2( - direction.x, direction.z ) / abs( direction.y ); // neg y
        } else {
            uv = vec2( direction.x, direction.y ) / abs( direction.z ); // neg z
        }
        return 0.5 * ( uv + 1.0 );
    }
    vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
        float face = getFace( direction );
        float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
        mipInt = max( mipInt, cubeUV_minMipLevel );
        float faceSize = exp2( mipInt );
        float texelSize = 1.0 / ( 3.0 * cubeUV_maxTileSize );
        vec2 uv = getUV( direction, face ) * ( faceSize - 1.0 ) + 0.5;
        if ( face > 2.0 ) {
            uv.y += faceSize;
            face -= 3.0;
        }
        uv.x += face * faceSize;
        if ( mipInt < cubeUV_maxMipLevel ) {
            uv.y += 2.0 * cubeUV_maxTileSize;
        }
        uv.y += filterInt * 2.0 * cubeUV_minTileSize;
        uv.x += 3.0 * max( 0.0, cubeUV_maxTileSize - 2.0 * faceSize );
        uv *= texelSize;
        return texture2D( envMap, uv ).rgb;
    }
    // These defines must match with PMREMGenerator
    #define r0 1.0
    #define v0 0.339
    #define m0 - 2.0
    #define r1 0.8
    // #define v1 0.276
    #define m1 - 1.0
    #define r4 0.4
    #define v4 0.046
    #define m4 2.0
    #define r5 0.305
    #define v5 0.016
    #define m5 3.0
    #define r6 0.21
    #define v6 0.0038
    #define m6 4.0
    float roughnessToMip( float roughness ) {
        float mip = 0.0;
        if ( roughness >= r1 ) {
            mip = ( r0 - roughness ) * ( m1 - m0 ) / ( r0 - r1 ) + m0;
        } else if ( roughness >= r4 ) {
            mip = ( r1 - roughness ) * ( m4 - m1 ) / ( r1 - r4 ) + m1;
        } else if ( roughness >= r5 ) {
            mip = ( r4 - roughness ) * ( m5 - m4 ) / ( r4 - r5 ) + m4;
        } else if ( roughness >= r6 ) {
            mip = ( r5 - roughness ) * ( m6 - m5 ) / ( r5 - r6 ) + m5;
        } else {
            mip = - 2.0 * log2( 1.16 * roughness ); // 1.16 = 1.79^0.25
        }
        return mip;
    }
    vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
        float mip = clamp( roughnessToMip( roughness ), m0, cubeUV_maxMipLevel );
        float mipF = fract( mip );
        float mipInt = floor( mip );
        vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
        if ( mipF == 0.0 ) {
            return vec4( color0, 1.0 );
        } else {
            vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
            return vec4( mix( color0, color1, mipF ), 1.0 );
        }
    }
#endif
// ----------------------------------------------------------------------------------=-------

#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>

#include <normal_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <alphamap_pars_fragment>
#include <shadowmap_pars_fragment>
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

    // PBR parameters
    float roughness;
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

vec3 GetHairDiffuse(vec3 irradiance, vec3 normal, vec3 lightDir, vec3 diffuseColor, float constantDiffuseFactor)
{
    // diffuse lighting: the lerp shifts the shadow boundary for a softer look
    vec3 diffuse = vec3(clamp(mix(0.25, 1.0, dot(normal, lightDir)), 0.0, 1.0));
    diffuse *= diffuseColor;

    // Add constant diffuse to simulate global scattering in the hair volume
    diffuse += diffuseColor * constantDiffuseFactor;
    return diffuse;
}

vec3 GetHairSpecular(const in GeometricContext geometry, const in HairKajiyaMaterial material, const vec3 lightColor, const vec3 lightDir)
{
    // shift tangents
    vec3 t1 = ShiftTangent(vBitangent, geometry.normal, material.primaryShift + material.shiftValue);
    vec3 t2 = ShiftTangent(vBitangent, geometry.normal, material.secondaryShift + material.shiftValue);

    // specular lighting
    vec3 specularColor1 = lightColor; // avoid results >1 and too small ones
    vec3 specular = specularColor1 * StrandSpecular(t1, geometry.viewDir, lightDir, material.specularExp1);

    // add 2nd specular term
    vec3 specularColor2 = mix(specularColor1, material.diffuseColor, 0.6);    // bleed a bit of the diffuse into the specularity to smooth and simule TRT lobe
    specular += specularColor2 * StrandSpecular(t2, geometry.viewDir, lightDir, material.specularExp2);

    return specular;
}

// Render equation (RE) that is going to be called by every light (see lights_fragment_begin.glsl.js)
void RE_Direct_HairKajiya(const in IncidentLight directLight, const in GeometricContext geometry, const in HairKajiyaMaterial material, inout ReflectedLight reflectedLight)// vec3 tangent, vec3 normal, vec3 lightVec, vec3 viewVec, vec2 uv, float ambOcc, float specFactor, vec3 hairColor)
{
    vec3 irradiance = directLight.color;
    // #ifndef PHYSICALLY_CORRECT_LIGHTS
	// 	irradiance *= PI; // punctual light
	// #endif

    vec3 diffuse = GetHairDiffuse(irradiance, geometry.normal, directLight.direction, material.diffuseColor, material.constantDiffuseFactor);
    vec3 specular = GetHairSpecular(geometry, material, directLight.color, directLight.direction);

    // update accumulated diffuse and specular
    reflectedLight.directDiffuse += diffuse * irradiance * material.ambientOcclusion;
    reflectedLight.directSpecular += specular * irradiance * material.specularStrength;
}

void RE_IndirectDiffuse_HairKajiya( const in vec3 irradiance, const in GeometricContext geometry, const in HairKajiyaMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse = PI * GetHairDiffuse(irradiance, geometry.normal, geometry.normal, material.diffuseColor, -material.constantDiffuseFactor) * material.ambientOcclusion;
}

void RE_IndirectSpecular_HairKajiya( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in GeometricContext geometry, const in HairKajiyaMaterial material, inout ReflectedLight reflectedLight ) {
    vec3 lightDir = reflect(geometry.viewDir, geometry.normal);
    reflectedLight.indirectSpecular += GetHairSpecular(geometry, material, radiance / 2.0, geometry.viewDir);
}

// #include <alphahash_pars_fragment>

#define RE_Direct				RE_Direct_HairKajiya
#define RE_IndirectDiffuse		RE_IndirectDiffuse_HairKajiya
#define RE_IndirectSpecular     RE_IndirectSpecular_HairKajiya
#define Material_LightProbeLOD( material )	(0)
// --------------------------------------------------------------------------------------------------------------------

void main() {

    // Defined in <common> --> { vec3 directDiffuse; vec3 directSpecular; vec3 indirectDiffuse; vec3 indirectSpecular; }
    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
    
    #include <normal_fragment_begin>
    #include <normal_fragment_maps>

    // invert normal direction if necessary to match view hemisphere for IBL
    if (dot(normal, normalize( vViewPosition )) < 0.0)
    {
        normal = -normal;
    }
    geometryNormal = normal;

    vec2 uv = vUv;

    vec4 diffuse_color = texture2D(u_hairColorMap, uv);

    // ------------ Analogous block to <lights_phong_fragment.glsl> ------------
    // Fill material properties
    HairKajiyaMaterial material;
    material.diffuseColor = diffuse_color.rgb * u_diffuseColor;
    material.constantDiffuseFactor = u_constantDiffuseFactor;
    material.specularExp1 = u_specularExp1;
    material.specularExp2 = u_specularExp2;
    material.specularStrength = u_specularStrength;
    material.primaryShift = u_primaryShift;
	material.secondaryShift = u_secondaryShift;
    material.ambientOcclusion = 1.0;
    material.shiftValue = material.diffuseColor.r * 4.0;    // use r component as pseudo-unique strand id to offset the tangent
    material.noiseShift = material.diffuseColor.b * 4.0;    // use b component as pseudo-unique strand id to modulate sparkles (todo: use proper noise texture instead)
    material.roughness = 0.2;
    // --------------------------------------------------------------------------

    // This iterates over all discrete light sources and calls the hair BSDF (rendering equation RE_Direct_HairKajiya)
    #include <lights_fragment_begin>

#define STANDARD
    #include <lights_fragment_maps>
    irradiance += iblIrradiance;

    // Calls BRDF to apply for indirect lighting (rendering equation RE_IndirectDiffuse_HairKajiya)
	#include <lights_fragment_end>

    float alphaSample = texture2D(alphaMap, vUv).r;
    float alpha = diffuse_color.a;

    vec4 diffuseColor = vec4(material.diffuseColor, alphaSample);

// #include <alphahash_fragment>

    // Get final color output
    vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    vec3 outgoingLight = totalDiffuse + totalSpecular;

    float specularStrength = 1.0;
    float reflectivity = 1.0;

    // Get opacity for alpha to coverage
    // alphaSample = alphaSample * 2.0;
    // alphaSample = clamp(alphaSample, 0.0, 1.0);
    // float alpha = diffuseColor.r + diffuseColor.g + diffuseColor.b;

    alphaSample = (alphaSample - 0.15) / max(fwidth(alphaSample), 0.1) + 1.0;

    //fragColor = vec4(outgoingLight, alpha > 0.0 ? 1.0 : 0.0);
    fragColor = vec4(outgoingLight, alphaSample);

    // Analogous to <tonemapping_fragment>
    //fragColor.rgb = toneMapping(fragColor.rgb);
}