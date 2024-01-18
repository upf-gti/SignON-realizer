> [!IMPORTANT]  
> This GitHub repository serves as a legacy archive, marking the culmination of past contributions within the SignON European project. A new repository has been created to build upon this foundation, where ongoing work and advancements can be found. Please visit the successor repository ([here](https://github.com/upf-gti/performs)) to stay up-to-date with the latest developments.

# SignON-realizer

<img src="./docs/SignOn_Favicon_500x500px.png" height="200" align="right">

>[SignON](https://signon-project.eu/) is a user-centric and community-driven project that aims to facilitate the exchange of information among Deaf, hard of hearing and hearing individuals across Europe, targeting the Irish, British, Dutch, Flemish and Spanish sign as well as the English, Irish, Dutch and Spanish spoken languages.


SignON-Realizer  is designed to integrate a variety of BML (Behavior Markup Language) instructions pertaining to both Manual Features (MF) and Non-Manual Features (NMF) into cohesive animations. The current progress of the project has achieved a robust synthesis of NMF, crucial for enhancing the realism of sign language animations.

The current supported instructions are explained in detail in [BML Instructions](./docs/InstructionsBML.md).
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
## Installation and Running
Clone the repository:
```
git clone https://github.com/upf-gti/SignON-realizer.git
```
To run locally, host a server from the main project folder.

## Adding avatars
> [!IMPORTANT]  
> Currently only glTF and glb are supported. If you happen to use another format, please convert it to either glTF or glb.

To add a new avatar to SignON-Realizer, you must follow this steps:

 1. Make sure the avatar is rigged (if it is not rigged, we recommend using [Mixamo](https://www.mixamo.com)) 
 2. Check that your avatar has the correct scale and orientation
 3. Use the [performs-atelier](https://github.com/upf-gti/performs-atelier) tool to configure all the parameters needed for the application, this will generate a configuration .json file containing all the needed information.
 4. Select `upload your avatar` in  the application avatar selection combo and select your files.
 5. Change to your avatar inside the application avatar selection combo

## Examples
Some examples on simple NGT (Dutch Sign Language) 
Kind lezen boek (child reads a book):
![Alt Text](https://iili.io/JYsmKzX.gif)
Man rijden fiets (Man rides a bicycle) :
![Alt Text](https://iili.io/JYL9aBn.gif)
## Architecture

The realizer is divided into main sections, each containing several files. 
The whole pipeline is warpped inside the CharacterController class which is in charge of receiving a BML block and triggering and executing its instructions when required.

#### __Controllers section__

Files in this block: _CharacterController_, _FacialController_ and _BodyController_

- _CharacterController_: is the main entry. Everything is controlled from here. Every instance of FacialController, BodyController, BehaviourManager and BehaviourPlanner is automatically created and managed by this class.
Users only need to instantiated this class and call its functions
    - _start_
    - _update_
    - _processMsg_: receives all the instructions of a block and triggers the whole pipeline to be synthesise the actions specified. 

- _FacialController_: manages the blending of the diferent animations involved in the face including facial gestures, eye movement and head displacement.

- _BodyController_: manages the blending of the diferent animations involved in the body including trunk, shoulders, arms, hands and fingers movement.

#### __BML section__

The files in this block: _BehaviourManager_, _BehavhourPlanner_ and _BehaviourRealizer_

- _BevahiourPlanner_: automatically generates some instructions such as blinking
- _BehaviourManager_: deals with all instruction blocks. Is in charge of triggering instructions when their time comes.
- _BehaviourRealizer_: a set of diverse functionalities to execute some particular instruction

## Collaborators
- Jaume Pozo [@japopra](https://github.com/japopra)  
- Víctor Ubieto [@victorubieto](https://github.com/victorubieto)
- Eva Valls [@evallsg](https://github.com/evallsg)
- Carolina del Corral [@carolinadcf](https://github.com/carolinadcf)
- Pablo García [@PZerua](https://github.com/PZerua)
- Alex Rodríguez [@jxarco](https://github.com/jxarco)

## Acknowledgments

- [Three.js](https://threejs.org/) - An open-source JavaScript library for creating interactive 3D and 2D graphics in web browsers.
- [Lexgui.js](https://github.com/jxarco/lexgui.js/) - A simple and lightweight GUI library for creating graphical user interfaces for web applications.

We would like to extend our gratitude to the creators and maintainers of these libraries for their invaluable contributions to the open-source community.
