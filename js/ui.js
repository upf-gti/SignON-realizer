
const DisplayUI = {

    // Lights
    'intensity' : { min: 0, max: 10, step: 0.1 },
    'decay' : { min: 0, max: 10, step: 0.1 },
    'penumbra' : { min: 0, max: 10, step: 0.1 },
    'translucencyScale' : { min: 0, max: 10, step: 0.1 },
    'specularIntensity' : { min: 1, max: 100, step: 1 },
    
    // Shadows
    'bias' : { min: -0.001, max: 0.001, step: 0.00001 },
    'normalBias' : { min: -0.01, max: 0.1, step: 0.001 },
    'radius' : { min: 0, max: 15, step: 0.1 },
    
    // Cameras
    'angle' : { min: -Math.PI, max: Math.PI, step: 0.01 },
    'fov' : { min: 0, max: 100, step: 1 },
    'near' : { min: 0.1, max: 10, step: 0.1 },
    'far' : { min: 10, max: 1000, step: 1 },
    'cameraNear' : { min: 0.1, max: 10, step: 0.1 },
    'cameraFar' : { min: 10, max: 1000, step: 1 },

    // Orthografic:
    'left' : { min: -100, max: 100, step: 1 },
    'right' : { min: -100, max: 100, step: 1 },
    'top' : { min: -100, max: 100, step: 1 },
    'bottom' : { min: -100, max: 100, step: 1 },

    // SSS
    'shadowShrinking' : { min: 0, max: 10, step: 0.1 },
    'sssLevel' : { min: 0, max: 5, step: 0.01 },
    'correction' : { min: 0, max: 1200, step: 50 },
    'maxdd' : { min: 0, max: 0.01, step: 0.001 },

    'u_diffuseFactor' : {min: 0, max: 3, step: 0.01},
    'u_irisRoughness' : {min: 0, max: 0.3, step: 0.001},
    'u_scleraRoughness' : {min: 0, max: 0.3, step: 0.001},
    'u_scleraNormalScale': {min: 0.0, max: 2.0, step: 0.01 },
    'u_limbusSize': {min: 0.0, max: 0.1, step: 0.001 },
    'u_specularExp1': {min: 10, max: 200, step: 0.1 },
    'u_primaryShift': {min: -1, max: 1, step: 0.01 },
    'u_secondaryShift': {min: -1, max: 1, step: 0.01 },
    'u_specularExp2': {min: 10, max: 200, step: 0.1 },
    'u_specularStrength': {min: 0, max: 0.3, step: 0.001 },
    'u_corneaIOR' : {min: 1, max: 3, step: 0.01},

    // Combos
    combos: {

        'blending': { 
            NoBlending: 0,
            NormalBlending: 1,
            AdditiveBlending: 2,
            SubtractiveBlending: 3,
            MultiplyBlending: 4,
            CustomBlending: 5
        },

        'blendSrc': { 
            ZeroFactor: 200,
            OneFactor: 201,
            SrcColorFactor: 202,
            OneMinusSrcColorFactor: 203,
            SrcAlphaFactor: 204,
            OneMinusSrcAlphaFactor: 205,
            DstAlphaFactor: 206,
            OneMinusDstAlphaFactor: 207,
            DstColorFactor: 208,
            OneMinusDstColorFactor: 209,
            SrcAlphaSaturateFactor: 210
        },

        'blendDst': { 
            ZeroFactor: 200,
            OneFactor: 201,
            SrcColorFactor: 202,
            OneMinusSrcColorFactor: 203,
            SrcAlphaFactor: 204,
            OneMinusSrcAlphaFactor: 205,
            DstAlphaFactor: 206,
            OneMinusDstAlphaFactor: 207,
            DstColorFactor: 208,
            OneMinusDstColorFactor: 209,
            SrcAlphaSaturateFactor: 210
        }
    },

    discarded: [
        '_viewportCount',
        '_alphaTest',
        'aspect',
        'filmGauge',
        'filmOffset',
        'focus',
        'zoom',
        'renderOrder',
        'vertexShader',
        'fragmentShader',
        'vertexColors',
        'defaultAttributeValues',
        'blurSamples',
        'uuid',
        'fog',
        'up'
    ],

    Off( v ) {
        return this.discarded.indexOf( v ) > -1 || v.substring(0, 2) === 'is';
    },

    IsCombo( v ) {
        return !!this.combos[ v ];
    }
}

export { DisplayUI };