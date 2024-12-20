var version = 1.2;
var server = null;
server = "https://janus.jsflux.co.kr/janus"; //jsflux janus server url

var janus = null;
var sfutest = null;
var opaqueId = "videoroomtest-"+Janus.randomString(12);

//-------------- url에서 값 가져오기
var urlParams = new URLSearchParams(window.location.search);

var username = urlParams.get('username');
var room = Number(urlParams.get('room'));
var usermode = urlParams.get('usermode'); //0:구매자, 1:판매자

//alert("detialMeeting username:"+ username + " ,room:" + room + " ,usermode:"+usermode);
//-------------- 

var myid = null;
var mystream = null;
var mypvtid = null;

var feeds = [];
var bitrateTimer = [];

//화질 설정
var doSimulcast = (getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true");
var doSimulcast2 = (getQueryStringValue("simulcast2") === "yes" || getQueryStringValue("simulcast2") === "true");
var subscriber_mode = (getQueryStringValue("subscriber-mode") === "yes" || getQueryStringValue("subscriber-mode") === "true");


/**
 * 화면이 정상적으로 출력되면 webrtcState 실행 -> unpublish버튼 생성
 * unpublish버튼을 눌러 unpublishOwnFeed()가 실행 -> 화면이 정상적으로 종료되면 oncleanup 이벤트 발생 -> publish버튼 생성
 * publish버튼을 눌러 publishOwnFeed()가 실행 -> 화면이 정상적으로 출력되면 onlocalstream이벤트 발생 -> unpublish버튼 생성
 */

$(document).ready(function() {
	// Initialize the library (all console debuggers enabled)
	Janus.init({debug: "all", callback: function() {
		// Use a button to start the demo

		janus = new Janus(
		{
			server: server,
			success: function() {
				// Attach to VideoRoom plugin
				janus.attach(
					{
						plugin: "janus.plugin.videoroom",
						opaqueId: opaqueId,
						success: function(pluginHandle) {
							
						sfutest = pluginHandle;
						Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
						Janus.log("  -- This is a publisher/manager");
						// Prepare the username registration
							
						joinUser(); //방에 입장

					Janus.log("Room List > ");
					//roomList();
						},
						error: function(error) {
							Janus.error("  -- Error attaching plugin...", error);
							//bootbox.alert("Error attaching plugin... " + error);
						},
						consentDialog: function(on) {
							Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
							if(on) {
								// Darken screen and show hint
								$.blockUI({
									message: '<div><img src="up_arrow.png"/></div>',
									css: {
										border: 'none',
										padding: '15px',
										backgroundColor: 'transparent',
										color: '#aaa',
										top: '10px',
										left: (navigator.mozGetUserMedia ? '-100px' : '300px')
									} });
							} else {
								// Restore screen
								$.unblockUI();
							}
						},
						iceState: function(state) {
							Janus.log("ICE state changed to " + state);
						},
						mediaState: function(medium, on) {
							Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
						},
						webrtcState: function(on) {
							
							Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
							$("#videolocal").parent().parent().unblock();
							if(!on)
								return;

							if($('#unpublish').length === 0){
								$('#publish').remove();
								$('#publishDiv').append('<button id="unpublish">Unpublish</button>'); 
								$('#unpublish').click(unpublishOwnFeed);
							}

							$('#bitrate').parent().parent().removeClass('hide').show();
							$('#bitrate a').click(function() {
								var id = $(this).attr("id");
								var bitrate = parseInt(id)*1000;
								if(bitrate === 0) {
									Janus.log("Not limiting bandwidth via REMB");
								} else {
									Janus.log("Capping bandwidth to " + bitrate + " via REMB");
								}
								$('#bitrateset').html($(this).html() + '<span class="caret"></span>').parent().removeClass('open');
								sfutest.send({ message: { request: "configure", bitrate: bitrate }});
								return false;
							});
						},
						
						onmessage: function(msg, jsep) {
							Janus.debug(" ::: Got a message (publisher) :::", msg);
							var event = msg["videoroom"];
							Janus.debug("Event: " + event);
							if(event) {
								if(event === "joined") { //입장하는 사람이 기존 사람들을 구독
									
									myid = msg["id"];
									mypvtid = msg["private_id"];
									Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);

									publishOwnFeed(true); //내 화면 설정
									
									if(msg["publishers"]) { //기존 방에 있는 사람들 정보
										var list = msg["publishers"];
										
										Janus.debug("Got a list of available publishers/feeds:", list);
										for(var f in list) {
											var id = list[f]["id"];
											var display = list[f]["display"];
											var audio = list[f]["audio_codec"];
											var video = list[f]["video_codec"];
											Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
											//newRemoteFeed(id, display, audio, video); 

											/* mentor 최초 방을 만든 경우 구독할 사람은 없다 */

											/* mentor가 방을 나갔다가 들어온 경우 기존 방에 참가자들을 mentor가 구독*/
											if(usermode === "1"){
												newRemoteFeed(id, display, audio, video);
											}

											/* 구독자들이 방을 최초 들어온 경우 mentor만 구독 */
											if(display === "mentor"){
												console.log("현재 입장자는 mentor만 구독")
												console.log(display)
												newRemoteFeed(id, display, audio, video);
											}
											/*
											newRemoteFeed() 메소드 설정 항목
											var subscribe = {
												request: "join",
												room: room,
												ptype: "subscriber",
												feed: id,
												private_id: mypvtid
											};

											방금 방에 입장한 사람을 기준으로 기존 방에 존재하는 사람들을 구독하겠다
											feed: id를 subscriber한다
											*/
										}
									}
								} else if(event === "destroyed") {
									// The room has been destroyed
									Janus.warn("The room has been destroyed!");
									window.location.reload();
									/* bootbox.alert("The room has been destroyed", function() {
										window.location.reload();
									}); */
								} else if(event === "event") { //기존 사람들이 입장하는 사람을 구독
									// Any new feed to attach to?

									console.log("event => event 부분의 msg");
									console.log(msg);

									if(msg["publishers"]) {
										var list = msg["publishers"];

										console.log("밑에 list는 방에 입장한 사람의 정보여야 한다");
										console.log(list);

										Janus.debug("Got a list of available publishers/feeds:", list);
										for(var f in list) {
											var id = list[f]["id"];
											var display = list[f]["display"];
											var audio = list[f]["audio_codec"];
											var video = list[f]["video_codec"];
											Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
											//newRemoteFeed(id, display, audio, video);

											/* mentor가 방에 있는 경우 참가자들 구독 */
											if(usermode === "1"){ 
												newRemoteFeed(id, display, audio, video)
											};

											/* mentor가 방을 나갔다가 들어온 경우 참여자들이 mentor를 구독 */
											if(display === "mentor"){
												newRemoteFeed(id, display, audio, video)
											}
										}
									} else if(msg["leaving"]) {
										// One of the publishers has gone away?
										var leaving = msg["leaving"];
										Janus.log("Publisher left: " + leaving);
										var remoteFeed = null;
										for(var i=1; i<6; i++) {
											if(feeds[i] && feeds[i].rfid == leaving) {
												remoteFeed = feeds[i];
												break;
											}
										}
										if(remoteFeed != null) {
											Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
											$('#remote'+remoteFeed.rfindex).empty().hide();
											$('#videoremote'+remoteFeed.rfindex).empty();
											feeds[remoteFeed.rfindex] = null;
											remoteFeed.detach();
										}
									} else if(msg["unpublished"]) {
										// One of the publishers has unpublished?
										var unpublished = msg["unpublished"];
										Janus.log("Publisher left: " + unpublished);
										if(unpublished === 'ok') {
											// That's us
											sfutest.hangup();
											return;
										}
										var remoteFeed = null;
										for(var i=1; i<6; i++) {
											if(feeds[i] && feeds[i].rfid == unpublished) {
												remoteFeed = feeds[i];
												break;
											}
										}
										if(remoteFeed != null) {
											Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
											$('#remote'+remoteFeed.rfindex).empty().hide();
											$('#videoremote'+remoteFeed.rfindex).empty();
											feeds[remoteFeed.rfindex] = null;
											remoteFeed.detach();
										}
									} else if(msg["error"]) {
										if(msg["error_code"] === 426) {
											// This is a "no such room" error: give a more meaningful description
											
											/*bootbox.alert(
												"<p>Apparently room <code>" + room + "</code> (the one this demo uses as a test room) " +
												"does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
												"configuration file? If not, make sure you copy the details of room <code>" + room + "</code> " +
												"from that sample in your current configuration file, then restart Janus and try again."
											);*/
										} else {
											//bootbox.alert(msg["error"]);
										}
									}
								}
							}
							if(jsep) {
								Janus.debug("Handling SDP as well...", jsep);
								sfutest.handleRemoteJsep({ jsep: jsep });
								// Check if any of the media we wanted to publish has
								// been rejected (e.g., wrong or unsupported codec)
								var audio = msg["audio_codec"];
								if(mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
									// Audio has been rejected
									toastr.warning("Our audio stream has been rejected, viewers won't hear us");
								}
								var video = msg["video_codec"];
								if(mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
									// Video has been rejected
									toastr.warning("Our video stream has been rejected, viewers won't see us");
									// Hide the webcam video
									$('#myvideo').hide();
									$('#videolocal').append(
										'<div class="no-video-container">' +
											'<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
											'<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
										'</div>');
								}
							}
						},
						onlocalstream: function(stream) { //WebRTC 연결이 생성된 후 사용자의 카메라/마이크 스트림이 성공적으로 로드되었을 때 호출
							Janus.debug(" ::: Got a local stream :::", stream);
							mystream = stream;
							$('#videojoin').hide();
							$('#videos').removeClass('hide').show();
							if($('#myvideo').length === 0) {
								$('#videolocal').append('<video class="rounded centered" id="myvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
								// Add a 'mute' button
								/* $('#videolocal').append('<button class="btn btn-warning btn-xs" id="mute" style="position: relative; bottom: 0px; left: 0px; margin: 15px;">Mute</button>'); */
								$('#mute').click(toggleMute);
								if($('#unpublish').length === 0){
									$('#publish').remove();
									$('#publishDiv').append('<button id="unpublish">Unpublish</button>');
									$('#unpublish').click(unpublishOwnFeed);
								}
							}
							$('#publisher').html(username);	
							/* $('#publisher2').html(username); */
							Janus.attachMediaStream($('#myvideo').get(0), stream);
							$("#myvideo").get(0).muted = "muted";
							if(sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
									sfutest.webrtcStuff.pc.iceConnectionState !== "connected") {
								$("#videolocal").parent().parent().block({
									message: '<b>Publishing...</b>',
									css: {
										border: 'none',
										backgroundColor: 'transparent',
										color: 'white'
									}
								});
							}
							var videoTracks = stream.getVideoTracks();
							if(!videoTracks || videoTracks.length === 0) {
								// No webcam
								$('#myvideo').hide();
								if($('#videolocal .no-video-container').length === 0) {
									$('#videolocal').append(
										'<div class="no-video-container">' +
											'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
											'<span class="no-video-text">No webcam available</span>' +
										'</div>');
								}
							} else {
								$('#videolocal .no-video-container').remove();
								$('#myvideo').removeClass('hide').show();
							}
						},
						onremotestream: function(stream) {
							// The publisher stream is sendonly, we don't expect anything here
						},
						oncleanup: function() {
							Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
							mystream = null;
							 
							if($('#publish').length === 0){
								$('#unpublish').remove();
								$('#publishDiv').html('<button id="publish">Publish</button>'); 
								$('#publish').click(function() { publishOwnFeed(true); });
							}
							$("#videolocal").parent().parent().unblock();
							$('#bitrate').parent().parent().addClass('hide');
							$('#bitrate a').unbind('click');
						}
					});
			},
			error: function(error) {
				Janus.error(error);
				window.location.reload();
				/* bootbox.alert(error, function() {
					window.location.reload();
				}); */
			},
			destroyed: function() {
				window.location.reload();
			}
		});
	}});
});

//방에 조인
function joinUser() {
	var register = { 
		"request": "join", 
		"room": room, 
		"ptype": "publisher", 
		"display": username 
	};
				
	sfutest.send({"message": register, success:function(result){
		console.log(result);
	}});
}

// [jsflux] 방 참여자
function participantsList(room){
    var listHtml = "";
    var roomPQuery = {
        "request" : "listparticipants",
        "room" : Number(room )
    }
    sfutest.send({ "message": roomPQuery, success:function(result){
        console.log("participants List: " + JSON.stringify(result));
        var listP = result["participants"];
        listHtml += '<table>';
        $(listP).each(function(i, object) {
            listHtml += '<tr>';
            listHtml += '   <td>' + object.display + '</td>';
            listHtml += '   <td>' + object.talking + '</td>';
            listHtml += '</tr>';
        });
        listHtml += '</table>';
        $("#room_" + room).html(listHtml);
    }});
}

// [jsflux] 내 화상화면 시작
function publishOwnFeed(useAudio) {

	$('#publish').attr('disabled', true).unbind('click');
	
	var mediaset = null;
	var publishset = null;
	if(usermode === "1"){ //판매자
		mediaset = {
			audioRecv : false,
			videoRecv : false,
			audioSend : true,
			videoSend : true
		},

		publishset = {
			request : "configure",
			audio : true,
			video : true
		}			
	}else{ //구매자
		mediaset = {
			audioRecv : true,
			videoRecv : true,
			audioSend : false,
			videoSend : false
		},

		publishset = {
			request : "configure",
			audio : false,
			video : false
		}	
	}

	sfutest.createOffer(
		{

			/* media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true }, */
			media : mediaset,
			simulcast: doSimulcast,
			simulcast2: doSimulcast2,
			success: function(jsep) {
				Janus.debug("Got publisher SDP!", jsep);
				/* var publish = { request: "configure", audio: useAudio, video: true }; */
				var publish = publishset
				sfutest.send({ message: publish, jsep: jsep });
			},
			error: function(error) {
				Janus.error("WebRTC error:", error);
				if(useAudio) {
					 publishOwnFeed(false);
				} else {
					//bootbox.alert("WebRTC error... " + error.message);
					$('#publish').removeAttr('disabled').click(function() { publishOwnFeed(true); });
				}
			}
		});
}


// [jsflux] 음소거
function toggleMute() {
	var muted = sfutest.isAudioMuted();
	Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
	if(muted)
		sfutest.unmuteAudio();
	else
		sfutest.muteAudio();
	muted = sfutest.isAudioMuted();
	$('#mute').html(muted ? "Unmute" : "Mute");
}

// [jsflux] 방나가기
function unpublishOwnFeed() {

	$('#unpublish').attr('disabled', true).unbind('click');

	var unpublish = { request: "unpublish" };
	sfutest.send({ message: unpublish });
}

// [jsflux] 새로운 유저 들어왔을때
function newRemoteFeed(id, display, audio, video) {
	// A new feed has been published, create a new plugin handle and attach to it as a subscriber
	var remoteFeed = null;
	janus.attach(
		{
			plugin: "janus.plugin.videoroom",
			opaqueId: opaqueId,
			success: function(pluginHandle) {
				remoteFeed = pluginHandle;
				remoteFeed.simulcastStarted = false;
				Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
				Janus.log("  -- This is a subscriber");
				// We wait for the plugin to send us an offer
				var subscribe = {
					request: "join",
					room: room,
					ptype: "subscriber",
					feed: id,
					private_id: mypvtid
				};
				// In case you don't want to receive audio, video or data, even if the
				// publisher is sending them, set the 'offer_audio', 'offer_video' or
				// 'offer_data' properties to false (they're true by default), e.g.:
				// 		subscribe["offer_video"] = false;
				// For example, if the publisher is VP8 and this is Safari, let's avoid video
				if(Janus.webRTCAdapter.browserDetails.browser === "safari" &&
						(video === "vp9" || (video === "vp8" && !Janus.safariVp8))) {
					if(video)
						video = video.toUpperCase()
					toastr.warning("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
					subscribe["offer_video"] = false;
				}
				remoteFeed.videoCodec = video;
				remoteFeed.send({ message: subscribe });
			},
			error: function(error) {
				Janus.error("  -- Error attaching plugin...", error);
				//bootbox.alert("Error attaching plugin... " + error);
			},
			onmessage: function(msg, jsep) {
				Janus.debug(" ::: Got a message (subscriber) :::", msg);
				var event = msg["videoroom"];
				Janus.debug("Event: " + event);
				if(msg["error"]) {
					//bootbox.alert(msg["error"]);
				} else if(event) {
					if(event === "attached") {
						// Subscriber created and attached
						for(var i=1;i<6;i++) {
							if(!feeds[i]) {
								feeds[i] = remoteFeed;
								remoteFeed.rfindex = i;
								break;
							}
						}
						remoteFeed.rfid = msg["id"];
						remoteFeed.rfdisplay = msg["display"];
						if(!remoteFeed.spinner) {
							var target = document.getElementById('videoremote'+remoteFeed.rfindex);
							remoteFeed.spinner = new Spinner({top:100}).spin(target);
						} else {
							remoteFeed.spinner.spin();
						}
						Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
						$('#remote'+remoteFeed.rfindex).removeClass('hide').html(remoteFeed.rfdisplay).show();
						//$('#videoremotename'+remoteFeed.rfindex).text(remoteFeed.rfid);
					} else if(event === "event") {
						// Check if we got a simulcast-related event from this publisher
						var substream = msg["substream"];
						var temporal = msg["temporal"];
						if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
							if(!remoteFeed.simulcastStarted) {
								remoteFeed.simulcastStarted = true;
								// Add some new buttons
								addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8" || remoteFeed.videoCodec === "h264");
							}
							// We just received notice that there's been a switch, update the buttons
							updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
						}
					} else {
						// What has just happened?
					}
				}
				if(jsep) {
					Janus.debug("Handling SDP as well...", jsep);
					// Answer and attach
					remoteFeed.createAnswer(
						{
							jsep: jsep,
							// Add data:true here if you want to subscribe to datachannels as well
							// (obviously only works if the publisher offered them in the first place)
							media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
							success: function(jsep) {
								Janus.debug("Got SDP!", jsep);
								var body = { request: "start", room: room };
								remoteFeed.send({ message: body, jsep: jsep });
							},
							error: function(error) {
								Janus.error("WebRTC error:", error);
								//bootbox.alert("WebRTC error... " + error.message);
							}
						});
				}
			},
			iceState: function(state) {
				Janus.log("ICE state of this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") changed to " + state);
			},
			webrtcState: function(on) {
				Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
			},
			onlocalstream: function(stream) {
				// The subscriber stream is recvonly, we don't expect anything here
			},
			onremotestream: function(stream) {
				Janus.debug("Remote feed #" + remoteFeed.rfindex + ", stream:", stream);
				var addButtons = false;
				if($('#remotevideo'+remoteFeed.rfindex).length === 0) {
					addButtons = true;
					// No remote video yet
					 
					$('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered" id="waitingvideo' + remoteFeed.rfindex + '" width="100%" height="100%" />');
					$('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered relative hide" id="remotevideo' + remoteFeed.rfindex + '" width="100%" height="100%" autoplay playsinline/>');
					/* $('#videoremote'+remoteFeed.rfindex).before(
						'<span class="label label-primary hide" id="curres'+remoteFeed.rfindex+'" style="position: relative; top: 5px; left: 0px; margin-right: 5px;padding:5px"></span>' +
						'<span class="label label-info hide" id="curbitrate'+remoteFeed.rfindex+'" style="position: relative; top: 5px; right: 0px; margin-left: 5px;padding:5px"></span>'); */
					$("#remotevideo"+remoteFeed.rfindex).bind("playing", function () {
						if(remoteFeed.spinner)
							remoteFeed.spinner.stop();
						remoteFeed.spinner = null;
						$('#waitingvideo'+remoteFeed.rfindex).remove();
						if(this.videoWidth)
							$('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
						var width = this.videoWidth;
						var height = this.videoHeight;
						$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
						if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
							// Firefox Stable has a bug: width and height are not immediately available after a playing
							setTimeout(function() {
								var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
								var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
								$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
							}, 2000);
						}
					});
				}
				Janus.attachMediaStream($('#remotevideo'+remoteFeed.rfindex).get(0), stream);
				var videoTracks = stream.getVideoTracks();
				if(!videoTracks || videoTracks.length === 0) {
					// No remote video
					$('#remotevideo'+remoteFeed.rfindex).hide();
					if($('#videoremote'+remoteFeed.rfindex + ' .no-video-container').length === 0) {
						$('#videoremote'+remoteFeed.rfindex).append(
							'<div class="no-video-container">' +
								'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
								'<span class="no-video-text">No remote video available</span>' +
							'</div>');
					}
				} else {
					$('#videoremote'+remoteFeed.rfindex+ ' .no-video-container').remove();
					$('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
				}
				if(!addButtons)
					return;
				if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
						Janus.webRTCAdapter.browserDetails.browser === "safari") {
					$('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
					bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
						// Display updated bitrate, if supported
						var bitrate = remoteFeed.getBitrate();
						$('#curbitrate'+remoteFeed.rfindex).text(bitrate);
						// Check if the resolution changed too
						var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
						var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
						if(width > 0 && height > 0)
							$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
					}, 1000);
				}
			},
			oncleanup: function() {
				Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
				if(remoteFeed.spinner)
					remoteFeed.spinner.stop();
				remoteFeed.spinner = null;
				$('#remotevideo'+remoteFeed.rfindex).remove();
				$('#waitingvideo'+remoteFeed.rfindex).remove();
				$('#novideo'+remoteFeed.rfindex).remove();
				$('#curbitrate'+remoteFeed.rfindex).remove();
				$('#curres'+remoteFeed.rfindex).remove();
				if(bitrateTimer[remoteFeed.rfindex])
					clearInterval(bitrateTimer[remoteFeed.rfindex]);
				bitrateTimer[remoteFeed.rfindex] = null;
				remoteFeed.simulcastStarted = false;
				$('#simulcast'+remoteFeed.rfindex).remove();
			}
		});
}

// Helper to parse query string
function getQueryStringValue(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec(location.search);
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// Helpers to create Simulcast-related UI, if enabled
function addSimulcastButtons(feed, temporal) {
	var index = feed;
	$('#remote'+index).parent().append(
		'<div id="simulcast'+index+'" class="btn-group-vertical btn-group-vertical-xs pull-right">' +
		'	<div class"row">' +
		'		<div class="btn-group btn-group-xs" style="width: 100%">' +
		'			<button id="sl'+index+'-2" type="button" class="btn btn-primary" data-toggle="tooltip" title="Switch to higher quality" style="width: 33%">SL 2</button>' +
		'			<button id="sl'+index+'-1" type="button" class="btn btn-primary" data-toggle="tooltip" title="Switch to normal quality" style="width: 33%">SL 1</button>' +
		'			<button id="sl'+index+'-0" type="button" class="btn btn-primary" data-toggle="tooltip" title="Switch to lower quality" style="width: 34%">SL 0</button>' +
		'		</div>' +
		'	</div>' +
		'	<div class"row">' +
		'		<div class="btn-group btn-group-xs hide" style="width: 100%">' +
		'			<button id="tl'+index+'-2" type="button" class="btn btn-primary" data-toggle="tooltip" title="Cap to temporal layer 2" style="width: 34%">TL 2</button>' +
		'			<button id="tl'+index+'-1" type="button" class="btn btn-primary" data-toggle="tooltip" title="Cap to temporal layer 1" style="width: 33%">TL 1</button>' +
		'			<button id="tl'+index+'-0" type="button" class="btn btn-primary" data-toggle="tooltip" title="Cap to temporal layer 0" style="width: 33%">TL 0</button>' +
		'		</div>' +
		'	</div>' +
		'</div>'
	);
	// Enable the simulcast selection buttons
	$('#sl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Switching simulcast substream, wait for it... (lower quality)", null, {timeOut: 2000});
			if(!$('#sl' + index + '-2').hasClass('btn-success'))
				$('#sl' + index + '-2').removeClass('btn-primary btn-info').addClass('btn-primary');
			if(!$('#sl' + index + '-1').hasClass('btn-success'))
				$('#sl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-primary');
			$('#sl' + index + '-0').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			feeds[index].send({ message: { request: "configure", substream: 0 }});
		});
	$('#sl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Switching simulcast substream, wait for it... (normal quality)", null, {timeOut: 2000});
			if(!$('#sl' + index + '-2').hasClass('btn-success'))
				$('#sl' + index + '-2').removeClass('btn-primary btn-info').addClass('btn-primary');
			$('#sl' + index + '-1').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			if(!$('#sl' + index + '-0').hasClass('btn-success'))
				$('#sl' + index + '-0').removeClass('btn-primary btn-info').addClass('btn-primary');
			feeds[index].send({ message: { request: "configure", substream: 1 }});
		});
	$('#sl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Switching simulcast substream, wait for it... (higher quality)", null, {timeOut: 2000});
			$('#sl' + index + '-2').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			if(!$('#sl' + index + '-1').hasClass('btn-success'))
				$('#sl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-primary');
			if(!$('#sl' + index + '-0').hasClass('btn-success'))
				$('#sl' + index + '-0').removeClass('btn-primary btn-info').addClass('btn-primary');
			feeds[index].send({ message: { request: "configure", substream: 2 }});
		});
	if(!temporal)	// No temporal layer support
		return;
	$('#tl' + index + '-0').parent().removeClass('hide');
	$('#tl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Capping simulcast temporal layer, wait for it... (lowest FPS)", null, {timeOut: 2000});
			if(!$('#tl' + index + '-2').hasClass('btn-success'))
				$('#tl' + index + '-2').removeClass('btn-primary btn-info').addClass('btn-primary');
			if(!$('#tl' + index + '-1').hasClass('btn-success'))
				$('#tl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-primary');
			$('#tl' + index + '-0').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			feeds[index].send({ message: { request: "configure", temporal: 0 }});
		});
	$('#tl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Capping simulcast temporal layer, wait for it... (medium FPS)", null, {timeOut: 2000});
			if(!$('#tl' + index + '-2').hasClass('btn-success'))
				$('#tl' + index + '-2').removeClass('btn-primary btn-info').addClass('btn-primary');
			$('#tl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-info');
			if(!$('#tl' + index + '-0').hasClass('btn-success'))
				$('#tl' + index + '-0').removeClass('btn-primary btn-info').addClass('btn-primary');
			feeds[index].send({ message: { request: "configure", temporal: 1 }});
		});
	$('#tl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Capping simulcast temporal layer, wait for it... (highest FPS)", null, {timeOut: 2000});
			$('#tl' + index + '-2').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			if(!$('#tl' + index + '-1').hasClass('btn-success'))
				$('#tl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-primary');
			if(!$('#tl' + index + '-0').hasClass('btn-success'))
				$('#tl' + index + '-0').removeClass('btn-primary btn-info').addClass('btn-primary');
			feeds[index].send({ message: { request: "configure", temporal: 2 }});
		});
}

function updateSimulcastButtons(feed, substream, temporal) {
	// Check the substream
	var index = feed;
	if(substream === 0) {
		toastr.success("Switched simulcast substream! (lower quality)", null, {timeOut: 2000});
		$('#sl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#sl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#sl' + index + '-0').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
	} else if(substream === 1) {
		toastr.success("Switched simulcast substream! (normal quality)", null, {timeOut: 2000});
		$('#sl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#sl' + index + '-1').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
		$('#sl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary');
	} else if(substream === 2) {
		toastr.success("Switched simulcast substream! (higher quality)", null, {timeOut: 2000});
		$('#sl' + index + '-2').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
		$('#sl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#sl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary');
	}
	// Check the temporal layer
	if(temporal === 0) {
		toastr.success("Capped simulcast temporal layer! (lowest FPS)", null, {timeOut: 2000});
		$('#tl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#tl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#tl' + index + '-0').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
	} else if(temporal === 1) {
		toastr.success("Capped simulcast temporal layer! (medium FPS)", null, {timeOut: 2000});
		$('#tl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#tl' + index + '-1').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
		$('#tl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary');
	} else if(temporal === 2) {
		toastr.success("Capped simulcast temporal layer! (highest FPS)", null, {timeOut: 2000});
		$('#tl' + index + '-2').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
		$('#tl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#tl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary');
	}
}


