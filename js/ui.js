
const DisplayUI = {

    // Lights
    'intensity' : { min: 0, max: 10, step: 0.1 },
    'decay' : { min: 0, max: 10, step: 0.1 },
    'penumbra' : { min: 0, max: 10, step: 0.1 },
    'translucencyScale' : { min: 0, max: 10, step: 0.1 },
    'shadowShrinking' : { min: 0, max: 10, step: 0.1 },

    // Shadows
    'bias' : { min: -0.01, max: 0.01, step: 0.0001 },
    'normalBias' : { min: -0.01, max: 0.01, step: 0.0001 },
    'radius' : { min: 0, max: 15, step: 0.1 },

    // Cameras
    'angle' : { min: -Math.PI, max: Math.PI, step: 0.01 },
    'fov' : { min: 0, max: 100, step: 1 },
    'near' : { min: 0.1, max: 10, step: 0.1 },
    'far' : { min: 10, max: 1000, step: 1 },

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
        'fog'
    ],

    Off( v ) {
        return this.discarded.indexOf( v ) > -1;
    },

    IsCombo( v ) {
        return !!this.combos[ v ];
    }
}

export { DisplayUI };