> [!IMPORTANT]  
> This GitHub repository serves as a legacy archive, marking the culmination of past contributions within the SignON European project. A new repository has been created to build upon this foundation, where ongoing work and advancements can be found. Please visit the successor repository ([here](https://github.com/upf-gti/performs)) to stay up-to-date with the latest developments.

# SignON-realizer

<img src="./docs/SignOn_Favicon_500x500px.png" height="200" align="right">

>[SignON](https://signon-project.eu/) is a user-centric and community-driven project that aims to facilitate the exchange of information among Deaf, hard of hearing and hearing individuals across Europe, targeting the Irish, British, Dutch, Flemish and Spanish sign as well as the English, Irish, Dutch and Spanish spoken languages.


SignON-Realizer aims at synthesising the different BML instructions related to both Manual Features (MF) and Non Manual Features (NMF) into animations. The current state of the project allows already for a solid synthesis of the NMF, which represents a key factor on understanding and making signs more humane. 

The current supported NMF instructions are explained in detail in [NMF BML Instructions](./docs/InstructionsBML.md).
An example:
``` javascript
{
    type: "faceLexeme",
    start: 0.1,
    attackPeak: 0.6,
    relax: 1.5,
    end: 1.8,
    amount: 0.1,
    lexeme: "NMF_ARCH"
}
```

## Architecture

The realizer is divided into main sections, each containing several files. 
The whole pipeline is warpped inside the CharacterController class which is in charge of receiving a BML block and triggering and executing its instructions when required.

#### __Controllers section__

Files in this block: _CharacterController_ and _FacialController_

- _CharacterController_: is the main entry. Everything is controller from here. Every instance of facialcontroller, behaviourManager and Behaviour planner is automatically created and managed by this class.
Users only need to instantiated this class and call its functions
    - _start_
    - _update_
    - _processMsg_: receives all the instructions of a block and triggers the whole pipeline to be synthesise the actions specified. 



- _FacialController_: manages the blending of the diferent animations involved in the face including facial gestures, eye movement and head displacement.

#### __BML section__

The files in this block: _BehaviourManager_, _BehavhourPlanner_ and _BehaviourRealizer_

- _BevahiourPlanner_: automatically generates some instructions such as blinking
- _BehaviourManager_: deals with all instruction blocks. Is in charge of triggering instructions when their time comes.
- _BehaviourRealizer_: a set of diverse functionalities to execute some particular instruction

## Collaborators
- Víctor Ubieto [@victorubieto](https://github.com/victorubieto)
- Eva Valls [@evallsg](https://github.com/evallsg)
- Jaume Pozo [@japopra](https://github.com/japopra)  
- Pablo García [@PZerua](https://github.com/PZerua)
- Alex Rodríguez [@jxarco](https://github.com/jxarco)

## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

## Acknowledgments
We would like to thank the [Three.js](https://threejs.org/) library for providing the 3D animation capabilities in this tool.
