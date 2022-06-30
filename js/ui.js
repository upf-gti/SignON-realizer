
const DisplayUI = {

    // Lights
    'intensity' : { min: 0, max: 10, step: 0.1 },
    'decay' : { min: 0, max: 10, step: 0.1 },
    'penumbra' : { min: 0, max: 10, step: 0.1 },

    // Shadows
    'bias' : { min: -0.001, max: 0.001, step: 0.0001 },
    'normalBias' : { min: -0.001, max: 0.001, step: 0.0001 },
    'radius' : { min: 0, max: 5, step: 0.1 },

    // Cameras
    'angle' : { min: -Math.PI, max: Math.PI, step: 0.01 },
    'fov' : { min: 0, max: 100, step: 1 },
    'near' : { min: 0.1, max: 10, step: 0.1 },
    'far' : { min: 10, max: 1000, step: 1 },

    // Discarded...
    'aspect': null,
    'filmGauge': null,
    'filmOffset': null,
    'focus': null,
    'zoom': null,
    'renderOrder': null,
    '_viewportCount': null
}

export { DisplayUI };