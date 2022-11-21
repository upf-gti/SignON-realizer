// #define USE_TANGENT
// #define USE_ALPHAMAP
#define USE_UV 
#define USE_ENVMAP
#define ENVMAP_MODE_REFLECTION
#define ENVMAP_TYPE_CUBE_UV

#include <common>
#include <packing>
#include <bsdfs>

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

// This uses PhysicalMaterial which contains:
// - vec3 diffuseColor
// - float roughness
// - vec3 specularColor
// - float specularF90
#include <lights_physical_pars_fragment>

// Uniforms to fill material data afterwards
uniform sampler2D u_irisAlbedo;
uniform vec3 u_irisColor;
uniform sampler2D u_irisNormal;
uniform float u_irisRoughness;
uniform sampler2D u_scleraAlbedo;
uniform sampler2D u_scleraNormal;
uniform float u_scleraRoughness;
uniform float u_limbusSize;
uniform float u_limbusDarkening;
uniform float u_specularF90;
uniform float u_corneaIOR;

uniform mat4 modelMatrix;
uniform mat3 normalMatrix;

out vec4 fragColor;


// ------------------------------- Analogous block to <lights_phong_pars_fragment.glsl> -------------------------------

in vec3 vViewPosition;
in vec3 position;
in vec3 vLocalPosition;

// --------------------------------------------------------------------------------------------------------------------


vec3 GetIrisRadiance(vec2 uv)
{
    #include <normal_fragment_begin>
    #include <normal_fragment_maps>
    geometryNormal = normal;

    // Defined in <common> --> { vec3 directDiffuse; vec3 directSpecular; vec3 indirectDiffuse; vec3 indirectSpecular; }
    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );

    // ------------ Analogous block to <lights_physical_fragment.glsl> ------------
    // Fill material properties
    PhysicalMaterial material;
    material.diffuseColor = texture2D(u_irisAlbedo, uv).rgb * u_irisColor;
    material.specularColor = vec3(1.0, 1.0, 1.0);
    material.roughness = u_irisRoughness;
    material.specularF90 = u_specularF90;
    // --------------------------------------------------------------------------

    // This iterates over all discrete light sources and calls the hair BSDF (rendering equation in <lights_physical_pars_fragment>)
    #include <lights_fragment_begin>

#define STANDARD
    #include <lights_fragment_maps>
    irradiance += iblIrradiance;

    // Calls BRDF to apply for indirect lighting (rendering equation <lights_physical_pars_fragment>)
	#include <lights_fragment_end>

    // Get final color output
    vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    return totalDiffuse + totalSpecular;
}

vec3 GetScleraRadiance(vec2 uv)
{
    #include <normal_fragment_begin>
    #include <normal_fragment_maps>
    geometryNormal = normal;

    // Defined in <common> --> { vec3 directDiffuse; vec3 directSpecular; vec3 indirectDiffuse; vec3 indirectSpecular; }
    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );

    // ------------ Analogous block to <lights_physical_fragment.glsl> ------------
    // Fill material properties
    PhysicalMaterial material;
    material.diffuseColor = texture2D(u_scleraAlbedo, uv).rgb;
    material.specularColor = vec3(1.0, 1.0, 1.0);
    material.roughness = u_scleraRoughness;
    material.specularF90 = u_specularF90;
    // --------------------------------------------------------------------------

    // This iterates over all discrete light sources and calls the hair BSDF (rendering equation in <lights_physical_pars_fragment>)
    #include <lights_fragment_begin>

#define STANDARD
    #include <lights_fragment_maps>
    irradiance += iblIrradiance;

    // Calls BRDF to apply for indirect lighting (rendering equation <lights_physical_pars_fragment>)
	#include <lights_fragment_end>

    // Get final color output
    vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    return totalDiffuse + totalSpecular;
}

vec2 GetRefractedUVs(vec2 inUV, vec3 normal)
{
    // Get refracted vector
    const float airIOR = 1.0;
    float refractionFactor = airIOR/u_corneaIOR;
    vec3 refractedDir = refract(vViewPosition, normal, refractionFactor);

    // Get UV offset due to refraction (based on http://www.iryoku.com/stare-into-the-future)

    // Gaze direction corresponds to the front vector (in WS) 
    vec3 gazeDirWS = normalize((modelMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
    vec3 gazeDirVS = normalize(viewMatrix * vec4(gazeDirWS, 0.0)).xyz;

    // Position direction corresponds to the vector from the object's center to the point in WS (in order to support refraction in all orientations)
    vec3 positionDirWS = (modelMatrix * vec4(vLocalPosition, 0.0)).xyz;

    // Object scale of the front vector (Z) 
    float scaleZ = length(vec3(modelMatrix[0][2], modelMatrix[1][2], modelMatrix[2][2]));
    // float scaleY = length(float3(worldMatrix._12, worldMatrix._22, worldMatrix._32));

    // Compute distance from current point to the iris plane 
    // m_irisDepth corresponds to the distance from the object origin to the local plane (XY) where the iris lays.
    // By multiplying this parameter by the scale we avoid having to re-tune it everytime we change the object's scale.
    float irisDepth = 0.412 * scaleZ * 0.0242 / 0.01;
    float height = max(dot(gazeDirWS, positionDirWS) - irisDepth, 0.0); 

    // Height encodes the length of the refracted ray projected in (local) Y, but we are interested in the (local) XY coordinates 
    // of the ray since these will be directly related to the offset to apply in texture space. Hence, we apply basic trigonometry 
    // to get the actual length of the ray
    float cosAlpha = dot(gazeDirVS, -refractedDir);
    float refractedRayLength = height / cosAlpha;
    vec3 refractedRay = refractedRayLength * refractedDir;

    // Convert ray to object local space and fetch XZ coordinates (which map to -XY in texture space)
    vec2 refractionUVOffset = (refractedRay * normalMatrix).xy;
    refractionUVOffset *= vec2(-1.0, 1.0);

    // Apply offset to the current UVs
    return inUV + refractionUVOffset;
}

void main() {
    // ------- Iris/Sclera Layer Setup -------
    #include <normal_fragment_begin>

    // Use a sigmoid to determine the sclera/iris contribution for each point
    const float irisRadius = 0.19;
    float eyeballDiameter = 0.0242 / 0.01; // Measure / scale in original glb 
    float distFromCenter = length(vLocalPosition.xy) / eyeballDiameter;
    float mask = 1.0/(1.0 + exp(-(distFromCenter - irisRadius) / (u_limbusSize)));
    vec2 uv = GetRefractedUVs(vUv, normal);
    
    vec3 irisRadiance = GetIrisRadiance(uv);
    vec3 scleraRadiance = GetScleraRadiance(uv);
    vec3 outputRadiance = mix(irisRadiance, scleraRadiance, mask);
    vec3 darkValue = vec3(0.0);
    outputRadiance = mix(darkValue, outputRadiance, saturate(abs(mask - 0.5) * 2.0 + (1.0 - u_limbusDarkening)));
    float specularStrength = 1.0;
    float reflectivity = 1.0;

    fragColor = vec4(outputRadiance, 1.0); 
    //fragColor = vec4(saturate(vec3((distFromCenter - irisRadius) < 0.0 ? 0.0 : 1.0)), 1.0);
    // Analogous to <tonemapping_fragment>
    fragColor.rgb = toneMapping(fragColor.rgb);
}