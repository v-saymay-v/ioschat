// 日本語
(function() {

	var chat;
	if ('undefined' === typeof module) {
		chat = this.chat = {};
	} else {
		chat = module.exports = {};
	}

	var cbInitialized;
	var cbConnected;
	var cbHangup;
	var cbError;
	chat.phono = undefined;
	chat.call = undefined;
	chat.username = undefined;
	chat.password = undefined;
	chat.audio = 'auto';
	chat.connectionUrl = undefined;
	chat.rtmpServer = undefined;
	chat.xmppServer = undefined;
	chat.sipServer = undefined;
	chat.pttEnabled = undefined;
	chat.audioInput = [];
	chat.javaPlugin = "plugins/audio/phono.audio.jar";
	chat.flashPlugin = "plugins/audio/phono.audio.swf";

	/* use code like this to sepcifiy a particular codec. */
	Phono.util.filterWideband = function(offer, wideband) {
		var codecs = new Array();
		Phono.util.each(offer, function() {
			if (!wideband) {
				if (this.name.toUpperCase() == "G722" && this.rate == "8000") {
					codecs.push(this);
				} else if (this.name == "telephone-event"){
					codecs.push(this);
				}
			} else {
				codecs.push(this);
			}
		});
		return codecs;
	};   

	chat.setParam = function(name, value) {
		if (value != undefined) {
			if (name == 'username') {
				chat.username = value;
			} else if (name == 'password') {
				chat.password = value;
			} else if (name == 'audio') {
				chat.audio = value;
			} else if (name == 'connectionUrl') {
				chat.connectionUrl = value;
			} else if (name == 'rtmpServer') {
				chat.rtmpServer = value;
			} else if (name == 'xmppServer') {
				chat.xmppServer = value;
			} else if (name == 'sipServer') {
				chat.sipServer = value;
			} else if (name == 'pttEnabled') {
				chat.pttEnabled = value;
			} else if (name == 'javaPlugin') {
				chat.javaPlugin = value;
			} else if (name == 'flashPlugin') {
				chat.flashPlugin = value;
			}
		}
	}

	chat.createNewPhono = function() {
		var audioType = chat.audio;
		var directP2P = false;
		var connectionUrl = window.location.protocol + "//" + window.location.host + "/http-bind/";
		var gw = window.location.hostname;
		var username = chat.username;
		var password = chat.password;
		var jid = username == undefined ? gw : username + "@" + (chat.xmppServer ? chat.xmppServer : window.location.hostname) + "/" + username;

        // Do we have URL parameters to override here?
		if (chat.audio != undefined)
			audioType = chat.audio;
		if (chat.connectionUrl != undefined)
			connectionUrl = chat.connectionUrl;

        console.log("audioType = " + audioType);

		var audio = audioType;
		var protocol = "sip:";

		if (audioType == "webrtc")
			protocol = "xmpp:";

		if (audioType == "flash") {
			gw = window.location.hostname;
			audio = "flash";
			directP2P = false;
		}

		if (audioType == "panda") {
			gw = window.location.hostname;
			audio = "flash";
			directP2P = true;
		}

		chat.phono = $.phono({
			jid: jid,
			password: password,	    
			connectionUrl:connectionUrl,
			gateway:gw,

			onReady: function(event) {
				if (this.audio.audioInDevices){
					var inList = this.audio.audioInDevices();
					console.log("devices are :"+inList);
					for (l=0;l<inList.length;l++){
						chat.audioInput.push(inList[l]);
					}
				}
				if( ! this.audio.permission() ){
					this.audio.showPermissionBox();
				}
				if (cbInitialized) {
					cbInitialized();
				}
				console.log("Phono loaded"); 
			},
			onUnready: function(event) {
				console.log("Phono disconnected");
            },
			onError: function(event) {
				if (cbError) {
					cbError(event.reason);
				}
				console.log(event.reason);
			},
			audio: {
				type: audio,
				jar: chat.javaPlugin,
				swf: chat.flashPlugin,
				media: {audio:true, video:false},
				phoneCallback: "sip:1000@192.168.1.97",                
				direct: directP2P,
				rtmpsvr: chat.rtmpServer || 'streaming.asusa.net',
				xmppsvr: chat.xmppServer || 'streaming.asusa.net',
				onPermissionBoxShow: function(event) {
					console.log("Flash permission box loaded"); 
				},
				onPermissionBoxHide: function(event) {
					console.log("Flash permission box closed");
					if (!this.permission()) {
						this.showPermissionBox();
					}
				}
			},
			phone: {
				ringTone: "ringtones/Diggztone_Marimba.mp3",
				ringbackTone: "ringtones/ringback-us.mp3",
				onIncomingCall: function(event) {
					// was push to talk enabled for calls?
					var pttEnabled = chat.pttEnabled || false;
					chat.call = event.call;
					console.log("New incoming call");

					//Bind events from this call
					Phono.events.bind(chat.call, {
						onHangup: function(event) {
							chat.call = null;
							console.log("Call hungup");
             	        },
						onError: function(event) {
							console.log("Error: [" + event.reason + "]");
						}
					});
				},
				onError: function(event) {
					console.log("Error: [" + event.reason + "]");
				}
			},
			messaging: {
				onMessage: function(event, message) {
					var JID = message.from.split("/");
					console.log("Message from " + JID[0] + " [" + message.body + "]");
					routeMessage(newPhonoID,"incoming",JID[0],message.body);
				}
		    }
		});
	}

	//Creates a new call
	chat.createNewCall = function(to) {
		// was push to talk enabled for calls?
		var pttEnabled = chat.pttEnabled || false;
		console.log("Calling " + to);

		chat.call = chat.phono.phone.dial(to, {
			tones: true,
			pushToTalk: pttEnabled,
			onAnswer: function(event) {
				chat.call.energyPoll = window.setInterval(function() {
					var me = chat.call.energy().mic;
					var se = chat.call.energy().spk;
					//console.log("mic => " + me + " / spk => " + se);
				},500);
				if (cbConnected) {
					cbConnected();
				}
				console.log("Call answered using " + chat.call.codec.name + "/" + chat.call.codec.rate);
			},
			onHangup: function() {
				if (chat.call)
					window.clearInterval(chat.call.energyPoll);
				chat.call = null;
				if (cbHangup) {
					cbHangup();
				}
				console.log("Call hungup");
			}
		});
	}

	chat.InitRoom = function(init) {
		cbInitialized = init;
		chat.createNewPhono();
	}

	chat.JoinRoom = function(room, connect, hungup, error) {
		var callTo = 'sip:19' + room + "@" + (chat.sipServer ? chat.sipServer : '');
		if (chat.phono) {
			cbConnected = connect;
			cbHangup = hungup;
			cbError = error;
			chat.createNewCall(callTo);
		}
	};

	chat.HeadSet = function(headsetEnabled) {
		console.log("HeadsetEnabled: " + headsetEnabled);
		chat.phono.phone.headset(headsetEnabled);
	};

	chat.WideBand = function(widebandDisabled) {
		console.log("WidebandDisabled: " + widebandDisabled);
		chat.phono.phone.wideband(!widebandDisabled);
	};

	chat.RingTone = function(ringTone) {
		chat.phono.phone.ringTone(ringTone);
		console.log("Ring tone set: " + ringTone);
	};

	chat.RingBackTone = function(ringBackTone) {
		chat.phono.phone.ringbackTone(ringBackTone);
		console.log("Ringback tone set: " + ringBackTone);
	};

	chat.AudioInput = function(audioInput) {
		for (var i = 0; i < chat.audioInput.length; ++i) {
			var device = chat.audioInput[i];
			if (device === audioInput) {
				console.log("Audio Input set: " + device);
				chat.phono.phone.audioInput(device);
			}
		}
	};

	chat.LeaveRoom = function() {
		if (chat.call)
			chat.call.hangup();
	};

	chat.Answer = function() {
		chat.call.answer();
		console.log("Call answered");
    };

	chat.Mute = function() {
		chat.call.mute(true);
	};

	chat.UnMute = function() {
		chat.call.mute(false);
	};

	chat.Digit = function(theDigit) {
		chat.call.digit(theDigit);
	};

	chat.TalkStart = function() {
		chat.call.talking(true);
	};

	chat.TalkStop = function() {
		chat.call.talking(false);
	};
}).call(this);
