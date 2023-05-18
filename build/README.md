# SignON-realizer embedded code

This code is packed into fewer files for easy integration into other applications.

To embed all the realizer application into your app, you must include the following files and folders:

- [index.html](/index.html)
- [build/js/](js) --> put this code into a folder named "js"
- [data/](/data)
- [external/](/external)

The organisation of folders and files should be as follows:

    project/
        - index.html
        - js/
            - App.js
            - BML.js
            - CharacterController.js
            - IKSolver.js
            - SigmlToBML.js

        - data/
            - dictionaries/
            - hdrs/
            - imgs/
            - textures/
            - EvaHandsEyesFixed.glb

        - external/ 
            - three/
            - es-module-shims.js
            - jquery-3.6.0.min.js
