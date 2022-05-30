//Minds are components in charge of coming with an answer to a given question

//used to send question to a remote server 
function MindRemote()
{
	this.socket = null;
	this.onMessage = null;
}

MindRemote.prototype.connect = function( url, on_connected, on_error )
{
	if(this.socket && this.socket.readyState == WebSocket.OPEN)
		this.socket.close();

	var that = this;
	this.socket = new WebSocket(  url );
	this.socket.onopen = function (){
		console.log("SENDING CONNECTING MESSAGE");
		/*this.send( JSON.stringify( { type:"connect", url : "ws://dtic-recepcionist-kbnli.s.upf.edu:8765" } ) )*/
		if(on_connected)
			on_connected();
	};
	this.socket.onmessage = this.processServerMessage.bind(this);		
	this.socket.onerror = on_error;
	this.socket.onclose = function()
	{
	
		//setTimeout(that.connect(url),1000)
	}
}

MindRemote.prototype.requestAnswer = function( question )
{
	var msg = { 
		type: "request",
		content: question
	};
	 return this.sendMessage(msg);
}

MindRemote.prototype.sendMessage = function( message )
{
	if(!this.socket || this.socket.readyState != WebSocket.OPEN)
	{
		console.log("no connection");
		return false;
	}

	var data = JSON.stringify( message );
	this.socket.send(data);
	return true;
}


MindRemote.prototype.processServerMessage = function(event)
{
	var data = event.data;
	var msg = JSON.parse( data );
	//console.log(msg);
	if(this.onMessage)
		this.onMessage(msg);
}
export {MindRemote}