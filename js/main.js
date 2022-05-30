window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

import { Player } from "./PlayerScene.js";
import { MindRemote } from "./MindRemote.js";
var recognition = new window.SpeechRecognition();

recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.maxAlternatives = 1;
var final_transcript = "";

var state = 0; //WAITING	
var lastState = state;
var counter = 0;

//App states
var REST = 0;
var SPEAKING = 1;
var LISTENING = 2;
var WAITING = 3;

var mute = false;
var recognition_enabled = false;
var url = "dtic-recepcionist.upf.edu/port/8765/ws/" //"ws://dtic-recepcionist-kbnli.s.upf.edu:8765"//webglstudio.org/port/9001/ws/"//"dtic-recepcionist-kbnli.s.upf.edu:8765";
var tabUrl = "dtic-recepcionist.upf.edu/port/3001/ws/"
//var tabUrl = "dtic-recepcionist.upf.edu:3001"
var VirtualClerk = {
	state: REST,
	nextState : SPEAKING,
	lastSpeakingTime: 0,
	socket: null,
	isFirstMsg:true,
	lastQuestion: "",
	finder: null,
	start: false,
	start_recognition: false,
    player: new Player(),
    start: function()
    {
        this.player.init(this.init.bind(this))
    },
	init: function (  )
	{
		var that = this;
		//-------------------------------------------------------Recognition Events	
		recognition.onstart = function(event){	
			that.start_recognition = true;	
			console.log("Recognition Start");	
			if(that.tabRemote)	
				that.tabRemote.sendMessage({type: "app_action", action: "recognition_start" })	
			
		}	
		recognition.onspeechstart = function(){	
			// var LS = window.LS;	
			// if(LS)	
			// {			
			// 	state = this.player.ECAcontroller.LISTENING;	
			// 	this.player.ECAcontroller.processMsg(JSON.stringify({type:'control',control:this.player.ECAcontroller.LISTENING}), true);	
			// }
			state = this.player.ECAcontroller.LISTENING;
			this.player.ECAcontroller.processMsg(JSON.stringify({type:'control',control: state}), true);	
			var that = this;
			if(that.tabRemote)
				that.tabRemote.sendMessage({type: "app_action", action: "speech_start" })

		}.bind(this)

		recognition.onspeechend = function(){
			state = this.player.ECAcontroller.PROCESSING
			var that = this;
			if(that.tabRemote)
				that.tabRemote.sendMessage({type: "app_action", action: "speech_end" })
			
		}.bind(this)

		recognition.onend = function(event){	
			if(that.tabRemote)	
				that.tabRemote.sendMessage({type: "app_action", action: "recognition_end" })	
			console.log("Recognition stopped from recognition.onend()");	
			that.start_recognition = false;	
			this.state = this.nextState;
		}
		recognition.onresult = function(event) {
			var interim_transcript = '';
			if (typeof(event.results) == 'undefined') {
				return;
			}

			for (var i = event.resultIndex; i < event.results.length; ++i) {

			  if (event.results[i].isFinal) {
				
				state = this.player.ECAcontroller.PROCESSING;

				final_transcript += event.results[i][0].transcript;
				
				interim_transcript = ""

			  } else {
				interim_transcript += event.results[i][0].transcript;
			  }
			}
			final_transcript = capitalize(final_transcript);

			that.userMessage( final_transcript );
		
			final_transcript = "";
			recognition.stop();
		}

		//use TALN server
		var protocol = location.protocol == "https:" ? "wss://" : "ws:";
		//var protocol = "ws://"
		this.mindRemote = new MindRemote();
		this.mindRemote.connect(protocol+url, this.onConnectionStarted.bind(this, "nlp"), this.onConnectionError.bind(this, "nlp"));
		this.mindRemote.onMessage = this.processMessage.bind(this);
		// connect to Tablet Server
		this.tabRemote = new MindRemote();
		this.tabRemote.connect(protocol+tabUrl, this.onConnectionStarted.bind(this,"tablet"), this.onConnectionError.bind(this,"tablet"));
		this.tabRemote.onMessage = this.processTabletMessage.bind(this);
		var that = this;

		//Reconnecting Modal
		var modal = document.getElementById("reconnecting");
		var span = document.getElementById("reconnecting-close");
		// When the user clicks on <span> (x), close the modal
		span.onclick = function() {
		 
			modal.style.display = "none";
		}

		//Server session Modal
		var s_modal = document.getElementById("session");
		var s_span = document.getElementById("session-close");
		var btn_session = document.getElementById("btn-session");
		btn_session.addEventListener("click", function(){
			
			var s_input = document.getElementById("token");
			if(that.tabRemote.socket && that.tabRemote.socket.readyState== WebSocket.OPEN)
			{
				that.tabRemote.sendMessage({type: "session", data: {action: "vc_connection", token: s_input.value}})
				s_modal.style.display = "none";
				//Wait for server response (client connected to this session)!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
			}
			else{
				s_modal.innerText = "Try again in a few minutes."
			}
		})
		// When the user clicks on <span> (x), close the modal
		s_span.onclick = function() {
			var s_input = document.getElementById("token");
			if(s_input.value!="")
				s_modal.style.display = "none";
		}
	

	},
	appLoop: function(dt)
	{

		if(window && this.start)	
		{	
			switch(this.state){
				case REST:
					counter = 0;

					if(!this.mindRemote.sendMessage( {type:"start", content:""} )){	
						this.onConnectionError("nlp");	
						return;	
					}	
					this.player.ECAcontroller.notSpeakingTime = 0;
					this.state = SPEAKING; //sure? doing taht onProcessMessage?
					mute = false;
					this.player.ECAcontroller.processMsg(JSON.stringify({type:'control',control: this.player.ECAcontroller.SPEAKING}), true);	
					break;
				case LISTENING:
					

					if(!this.start_recognition && !mute) recognition.start();
					if(state != this.player.ECAcontroller.LISTENING)
					{
						state = this.player.ECAcontroller.LISTENING;
						this.player.ECAcontroller.processMsg(JSON.stringify({type:'control',control: state}), true);	
					}

					counter+=1;
					if(counter>60)	
					{	
						counter = 0;
						this.mindRemote.sendMessage( {type:"end", content:""} );	
					}
					setTimeout(this.appLoop.bind(this), 3000);
					break;
				case SPEAKING:
					counter = 0;
					if(this.start_recognition) recognition.abort();

					if(this.player.ECAcontroller){	
						var isSpeaking = this.player.ECAcontroller.speaking;
						this.lastSpeakingTime+= 1;
						if(isSpeaking){
							this.lastSpeakingTime = 0;

						}else{// if(this.lastSpeakingTime>100){ //make sure she finished speaking
							this.state = this.nextState;//LISTENING;
							this.lastSpeakingTime = 0;
							if(this.state == REST){
								this.isFirstMsg = true;	
								this.start = false;	
								recognition_enabled = false	
								state = this.player.ECAcontroller.WAITING;
								this.player.ECAcontroller.processMsg(JSON.stringify({type:'control',control: state}), true);
							}
						}			
					}
					window.requestAnimationFrame(this.appLoop.bind(this));
					break;
				case WAITING:
					if(this.start_recognition) recognition.abort();

					counter+=1;
					if(counter>60)	
					{	
						counter = 0;	
						this.mindRemote.sendMessage( {type:"end", content:""} );
					}
					break;
			}
				
		}
		
	},
	onConnectionStarted: function(type)
	{
		console.log("Connection started! " + type)
		if(type == "tablet")
		{
			if(this.tabRemote.socket && this.tabRemote.socket.readyState== WebSocket.OPEN)
			{
				this.tabRemote.sendMessage({type: "session", data: {action: "vc_connection", token: "dev"}})
				
				//Wait for server response (client connected to this session)!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
			}else{
				setTimeout(this.onConnectionStarted.bind(this,type), 3000)
			}
		}
		this.displayModal(false);
		
		recognition.continuous = true;

	},
	onConnectionError: function(server, error)
	{
		var that = this;
		console.log(error)
		this.isFirstMsg = true;
		this.start = false;
		if(that.start_recognition) recognition.stop()
		this.displayModal(true, "Connection error. Trying to reconnect.");
		
		
		setTimeout(function(){
			var protocol = location.protocol == "https:" ? "wss://" : "ws:";
			//var protocol = "ws://"
			if(server == "nlp")
				that.mindRemote.connect(protocol+url, that.onConnectionStarted.bind(that, "nlp"), that.onConnectionError.bind(that,"nlp"));
			else if(server == "tablet")
				that.tabRemote.connect(protocol+tabUrl, that.onConnectionStarted.bind(that, "tablet"), that.onConnectionError.bind(that,"tablet"));
		},5000);
	},

	userMessage: function( text_message )
	{
		
		var mind = this.mindRemote;
	
		text_message = text_message.replace(/\b\w/g, l => l.toUpperCase());

		if(text_message.toLowerCase().includes("bye") || text_message.toLowerCase().includes("shut up")){
			mind.sendMessage( {type:"end", content:""} );
		
		}
			if(!mind.requestAnswer( text_message ))
				this.onConnectionError("nlp")

	},

	processMessage: function( msg )
	{
        if(msg.type=="system")
            return;
        var LS = window.LS;
        
        if(msg.type == "request" && msg.content=="")
        {
            window.requestAnimationFrame(this.appLoop.bind(this));
            return;
        }
        this.state = SPEAKING;
        this.nextState = LISTENING;
        this.player.ECAcontroller.speaking = true;

        var obj = {type: "behaviours", data : []};
        if(msg.content && msg.content.data)
            if(msg.content.data.constructor == Array){
                var t = 0;
                
                for(var i = 0; i< msg.content.data.length; i++){
                    var audio = msg.content.data[i];
                    var duration = audio.duration;
                
                    var d = {type:"lg", text: audio.audio_name, audio: audio.audio, start:t, end:t+duration};
                    obj.data.push(d);
                    if(msg.content.text.includes("Great") || audio.audio_name&& audio.audio_name.includes("leader"))
                        t+=duration+0.1;
                    else
                        t+=duration+0.02;
                }

            }
            else
                obj.data= [ { type:"lg", text: msg.content.text, audio: msg.content.data.audio, start:0, end:4 }]; //speaking
        else
            obj = { type: "behaviours", data: [ { type:"lg", text: msg.content.text,  start:0.1, end:4 }]};
        
        if(msg.content && msg.content.text)
        {
            if(msg.content.text.includes("Hi"))
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.4, start: 0.2, attackPeak: 0.3, relax: 0.4, end: 1.1, composition: "OVERWRITE"})
            
            else if(msg.content.text.includes("Good morning"))
            {
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.4, start: 1.5, attackPeak: 2.1, relax: 2.8, end: 3.8, composition: "MERGE"}) //welcome
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.2, start: 19.6, attackPeak: 20, relax: 20.5, end: 20.9, composition: "MERGE"}) //community
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.2, start: 25.2, attackPeak: 26, relax: 26.5, end: 26.9, composition: "MERGE"}) //day
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.3, start: 37, attackPeak: 38, relax: 38.9, end: 40, composition: "MERGE"}) //happy
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.4, start: 58.4, attackPeak: 59.1, relax: 59.6, end: 60, composition: "MERGE"})//learning
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.4, start: 61.2, attackPeak: 61.7, relax: 62.1, end: 63, composition: "MERGE"})//celebration
            }
            else if( msg.content.text.includes("Great"))
            {
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.25, start: 0.4, end: 1.2, composition: "MERGE"}) 

            }
            else if(msg.content.text.includes("name and surname"))
            {
                
                this.tabRemote.sendMessage({type:"request_data", data: "person"});
                
                //if(this.start_recognition){ recognition.stop()}
                //recognition_enabled = false;
                this.nextState = WAITING;
            }
            
            else if(msg.content.text.includes("bye"))	
            {	
                // this.isFirstMsg = true;	
                // this.start = false;	
                // recognition_enabled = false	
                // state = this.player.ECAcontroller.WAITING;	
                
                this.nextState = REST;
                if(this.start_recognition) recognition.stop();	
                this.tabRemote.sendMessage({type: "app_action", action:"end_conversation"});
                this.isFirstMsg = true;
                this.start = false;	
                obj.data.push({type:"faceEmotion", emotion: "HAPPINESS", amount:0.3, start: 1.5, attackPeak: 1.8, relax: 2.8, end: 4, composition: "MERGE"})	
            }	
            else if(msg.content.text.includes("Sorry")){	
                obj.data.push({type:"faceEmotion", emotion: "SURPRISE", amount:0.3, start: 0, attackPeak: 0.2, relax: 0.6, end: 1, composition: "MERGE"})	
                    
            }
        }
        
        console.log("message processed: " + msg.content)

        //show on character
        // if(!window.LS)
        //     return;
        // var LS = window.LS;

        // var places = ["cafeteria", "bar", "library", "auditori","auditorium", "restaurant", "secretaria", "library", "550" ,"551", "552", "553","554"];
        // if(msg.content && msg.content.text)
        //     for(var i in places)
        //     {
        //         var place = places[i];
    
        //         if(msg.content.text.toLowerCase().includes(place))
        //         {
        //             if(place=="secretaria")
        //                 place="550";
        //             else if(place=="auditorium")
        //                 place="auditori"
        //             else if(place == "bar" || place == "restaurant")	  //hardcoded
        //                 place = "cafeteria";
        //             else if(place == "Tanger")
        //             {
        //                 var idx = places.map((n)=>msg.content.text.toLowerCase().includes(n)).indexOf(true);
        //                 if(idx>-1)
        //                     place = places[idx];
        //                 else
        //                     continue;
        //             }
        //             var path = "https://dtic-recepcionist.upf.edu/recepcionista/imgs/mapa-"+ place + ".jpg";
        //             var LSQ = window.LSQ;
        //             LS.RM.load(path);
        //             var map = LSQ.get("map");
        //             var woman = LSQ.get("background");
        //             if(map)
        //             {
        //                 map.material.textures.color.texture = path;
        //                 var mapPos = map.transform.position.clone();
        //                 var mapTarget = LSQ.get("mapTarget").transform.position;
        //                 LS.Tween.easeProperty( map.transform, "position", mapTarget, 1)
        //                 setTimeout(function(){LS.Tween.easeProperty(map.transform, "position", mapPos, 1)}	, 8000)
        //             }
        //         }
        //     }
        this.player.ECAcontroller.processMsg(JSON.stringify(obj), true);
        window.requestAnimationFrame(this.appLoop.bind(this));

	}, 

	// messages recieved from RecepcionistaDTIC Tablet
	processTabletMessage: function(message) 
	{
		// try to decode json (I assume that each message
		// from server is json)
		try {
			var json = message;
			console.log(json);
			//Get current time
			var date = new Date();
			var hours = (date.getHours()>9)? date.getHours(): "0"+date.getHours();
			var minutes = (date.getMinutes()>9)? date.getMinutes(): "0"+date.getMinutes();
			var seconds = (date.getSeconds()>9) ? date.getSeconds(): "0"+date.getSeconds();
			var time = hours+ ":"+ minutes+":"+seconds;
	
			//Show messages
			switch (json.type) 
			{
				case "response_data":
					
					if(!this.mindRemote.requestAnswer( json.data ))
						onConnectionError("nlp")
					recognition_enabled = true;
					// json.data;
					break;
		
				case "tab_action":
					if(json.action == "init_conversation")
					{
						//start_conversation
						this.start = true;
						this.state = REST
						this.nextState = SPEAKING
						window.requestAnimationFrame(this.appLoop.bind(this));
					}
					if(json.action == "mute")
					{
						//disable recognition in the app so it does not try to listen as the tablet is muted
						mute = !mute;
						if(mute) 
							this.state = WAITING;
						else 
							this.state = LISTENING;

						if(this.start_recognition) recognition.abort()
						// Sennd ACK message to tablet to change styles, views...
						if(this.tabRemote)
						{
							// console.log("Sending mute message");
							this.tabRemote.sendMessage({type: "app_action", action: "mute_toggled" })
							window.requestAnimationFrame(this.appLoop.bind(this));	
						}
					}
					break;
				case "info":
					if(json.data.includes("tablet disconnected")){
						this.mindRemote.sendMessage( {type:"end", content:""} );
						// this.isFirstMsg = true;
						// this.start = false;
						/*this.nextState = REST;
						window.requestAnimationFrame(this.appLoop.bind(this));*/
						//recognition.stop()
					}
					break;
			}
		}
		catch (e) {
			console.log('This doesn\'t look like a valid JSON: ',  message.data);
			return;
		}
	},
	displayModal: function (showModal, msg) {

		var modal = document.getElementById("reconnecting");

		if(showModal && msg)
		{
			var content = document.getElementById("modal-msg");
			content.innerHTML = msg;
			modal.style.display = "block";
		}
		else
			modal.style.display = "none";


	},
	
};
var first_char = /\S/;
function capitalize(s) {
  return s.replace(first_char, function(m) { return m.toUpperCase(); });
}

function eventFire(el, etype){
	if (el.fireEvent) {
	  el.fireEvent('on' + etype);
	} else {
	  var evObj = document.createEvent('Events');
	  evObj.initEvent(etype, true, false);
	  el.dispatchEvent(evObj);
	}
  }
  VirtualClerk.start()
  export {VirtualClerk}