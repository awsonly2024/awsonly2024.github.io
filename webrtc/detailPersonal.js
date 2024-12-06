var version = 1.2;
var server = null;
server = "https://janus.jsflux.co.kr/janus"; //jsflux janus server url

var janus = null;
var sfutest = null;
var opaqueId = "videoroomtest-"+Janus.randomString(12);

//-------------- url에서 값 가져오기
var urlParams = new URLSearchParams(window.location.search);

var username = urlParams.get('username');
var room = urlParams.get('room');
var usermode = urlParams.get('usermode'); //0:구매자, 1:판매자
alert("myVideoRoom username"+ username + " ,room:" + room + ',usermode:'+usermode);
//-------------- * *

var myid = null;
var mystream = null;
var mypvtid = null;

var feeds = [];
var bitrateTimer = [];

var doSimulcast = (getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true");
var doSimulcast2 = (getQueryStringValue("simulcast2") === "yes" || getQueryStringValue("simulcast2") === "true");
var subscriber_mode = (getQueryStringValue("subscriber-mode") === "yes" || getQueryStringValue("subscriber-mode") === "true");

/**
 * 판매자 : 1 => publisher
 * 구매자 : 0 => subscriber
 * 최초 방을 만든 사람만 publisher, 나머지 입장자는 전부 subscriber
 * publisher는 모든 subscriber를 구독,
 * subscriber는 publisher 한 사람만 구독
 * 
 * M to M 방식은 publiser와 subscriber가 모두 수신과 송신을 하기 때문에 mentor를 구별할 방법이 없다
 * 그래서, username이 mentor인지 아닌지로 구별
 * 
 * O to M 방식은 pulisher는 송신만, subscriber는 수신만 하기 때문에 
 * registerUsername()나 publishOwnFeed() 메소드 등을 사용할 때 메소드 안에서 조건을 usermode으로 구분할 수 있다
 * M to M은 송신과 수신이 일치하기 때문에 구분되는 것이 없다.
 * 
 * O to M은 메소드 내부에서 조건을 걸어 송신이냐 수신이냐로 구분
 * M to M은 mentor인지 아닌지로 메소드 실행여부를 구분
 */


$(document).ready(function() {
	// Initialize the library (all console debuggers enabled)
	Janus.init({debug: "all", callback: function() {
		// Use a button to start the demo

			// Create session
	janus = new Janus(
		{
			server: server,
			success: function() {
				// Attach to VideoRoom plugin

				janus.attach(
					{
						/*
							start -> stop
							밑에 부분에 Room Name, My Name, 대화방 참여 나타남
						*/
						plugin: "janus.plugin.videoroom",
						opaqueId: opaqueId,
						success: function(pluginHandle) {
							
							sfutest = pluginHandle;
							Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
							Janus.log("  -- This is a publisher/manager");
							
							registerUsername(); //자신을 pubilsher인지 subscriber인지 등록

						Janus.log("Room List > ");
						//roomList();
						}  ,
						error: function(error) {
							Janus.error("  -- Error attaching plugin...", error);
							//bootbox.alert("Error attaching plugin... " + error);
						},
						
						//on이면 화면앞에 있는 publish글자를 지우고 화면 활성화
						webrtcState: function(on) {
							Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
							$("#videolocal").parent().parent().unblock();
							if(!on)
								return;
							//$('#publish').remove();
							$('#publish').css('display','none');
							// This controls allows us to override the global room bitrate cap
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

						/*
						** Janus에서 비디오룸 관련 메시지를 받을 때 호출됩니다. **
						Janus WebRTC Gateway에서 비디오 룸 플러그인(videoroom)의 이벤트를 처리하는 함수입니다. 사용자가 방에 참여하거나 새로운 참가자가 들어올 때, 또는 방이 삭제되는 등의 이벤트에 대해 적절한 동작을 수행하도록 설계되었습니다.
						"joined": 방에 성공적으로 참여.
						"destroyed": 방이 삭제됨.
						"event": 방 내에서 새로운 피드(publisher)가 추가되거나, 기존 피드가 변경됨.

						jsep는 보통 아래 두 가지 중 하나의 SDP 메시지를 포함합니다:
						Offer: 클라이언트가 연결을 제안할 때 생성.
						Answer: Offer를 수락할 때 생성.
						*/
						onmessage: function(msg, jsep) {
							Janus.debug(" ::: Got a message (publisher) :::", msg);
							var event = msg["videoroom"];
							Janus.debug("Event: " + event);
							if(event) {
								if(event === "joined") { //페이지 로드된 자신이 join
									myid = msg["id"];
									mypvtid = msg["private_id"];
									Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
									/* if(subscriber_mode) {
										$('#videojoin').hide();
										$('#videos').removeClass('hide').show();
									} else {
										publishOwnFeed(true);
									} */
									publishOwnFeed(true); //화면 송출 설정

									/**
									 * 1) mentor가 최초 입장, newRemoteFeed를 수행할 list가 없음
									 * 2) subscriber가 입장, mentor만 newRemoteFeed로 등록
									 */

									/*
									밑에 if문은 새로 들어온 사람이 기존 방에 있던 사람들 구독하는 기능을 가진다
									mentor는 방 입장시 항상 대기자가 없으므로 mentor가 if문에서 newRemoteFeed()할 필요는 없다
									subscriber가 입장하면 방에 있던 사람 중 mentor만 구독하면 된다.
									*/
									if(msg["publishers"]) { 
										var list = msg["publishers"];
										Janus.debug("Got a list of available publishers/feeds:", list);
										for(var f in list) {
											var id = list[f]["id"];
											var display = list[f]["display"];
											var audio = list[f]["audio_codec"];
											var video = list[f]["video_codec"];
											Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");

											if(display === "mentor"){
												newRemoteFeed(id, display, audio, video);
											}
										}
									}
								} else if(event === "destroyed") {
									// The room has been destroyed
									Janus.warn("The room has been destroyed!");
									window.location.reload();
									/*bootbox.alert("The room has been destroyed", function() {
										window.location.reload();
									});*/

								/**
								밑에 if문은 기존 방에 있던 사람의 입장에서 누군가 들어오거나 나갈 때 
								발생하는 이벤트.
								1)mentor : 들어오는 모든 사람들 구독
								2)subscriber : 들어오는 사람들 모두 구독할 필요 없음
								*/

								} else if(event === "event") { //기존 방에 있던 사람들이 받는 event
									// Any new feed to attach to?
									if(msg["publishers"]) { //기존 방에 있던 사람이 새로 들어온 사람들을 구독
										var list = msg["publishers"];
										Janus.debug("Got a list of available publishers/feeds:", list);
										for(var f in list) {
											var id = list[f]["id"];
											var display = list[f]["display"];
											var audio = list[f]["audio_codec"];
											var video = list[f]["video_codec"];
											Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");

											if(usermode === "1")
											newRemoteFeed(id, display, audio, video);
											/*
											왜 if(mentor == "1") 가 아닌가?
											현재 방 입장 자가 누구인지 알 수 있는 방법이 없다.
											*/
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
											alert(
												"<p>Apparently room <code>" + room + "</code> (the one this demo uses as a test room) " +
												"does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
												"configuration file? If not, make sure you copy the details of room <code>" + room + "</code> " +
												"from that sample in your current configuration file, then restart Janus and try again."
											);
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
						/*
						로컬 스트림이 성공적으로 생성되거나 캡처된 후 호출 :
						사용자가 자신의 비디오와 오디오를 캡처한 미디어 스트림입니다. 예를 들어, 사용자가 웹캠을 활성화하거나 마이크를 켤 때 생성되는 스트림입니다.
						*/
						onlocalstream: function(stream) {
							Janus.debug(" ::: Got a local stream :::", stream);
							mystream = stream;
							$('#videojoin').hide();
							$('#videos').removeClass('hide').show();
							if($('#myvideo').length === 0) {
								$('#videolocal').append('<video class="rounded centered" id="myvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
								// Add a 'mute' button
								/* $('#videolocal').append('<button class="btn btn-warning btn-xs" id="mute" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;">Mute</button>'); */
								$('#mute').click(toggleMute);
								// Add an 'unpublish' button
								/* $('#videolocal').append('<button class="btn btn-warning btn-xs" id="unpublish" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;">Unpublish</button>'); */
								$('#unpublish').click(unpublishOwnFeed);
							}
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
						/*
						onremotestream: function(stream)은 원격 피어로부터 미디어 스트림이 도착했을 때 호출되는 콜백 함수입니다.

						이 함수는 원격 피어(WebRTC 연결의 상대방)에서 전송된 오디오 및 비디오 데이터를 로컬 브라우저에서 표시하거나 처리할 때 사용됩니다.
						*/
						onremotestream: function(stream) {
							// The publisher stream is sendonly, we don't expect anything here
						},
						/*
						이 함수는 스트림이 중단되었을 때 사용자의 UI와 상태를 초기화하는 역할을 합니다. 이후 사용자가 원한다면 Publish 버튼을 통해 새로운 스트림을 퍼블리시할 수 있습니다.
						*/
						oncleanup: function() {
							Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
							mystream = null;
							/* $('#videolocal').html('<button id="publish" class="btn btn-primary">Publish</button>'); */
							$('#publish').click(function() { publishOwnFeed(true); });
							$("#videolocal").parent().parent().unblock();
							$('#bitrate').parent().parent().addClass('hide');
							$('#bitrate a').unbind('click');
						}
					});
			},
			error: function(error) {
				Janus.error(error); 
				window.location.reload();
				/*
				bootbox.alert(error, function() {
					window.location.reload();
				});*/
			},
			destroyed: function() {
				window.location.reload();
			}
		});
	}});
});


//방 조인
function registerUsername() {

	if(usermode === "1"){
		var register = { "request": "join", "room": parseInt(room), "ptype": "publisher", "display": username }; 
	}else{
		var register = { "request": "join", "room": parseInt(room), "ptype": "subscriber", "display": username }; 
	}

	sfutest.send({
		"message": register, success: () => {}
		});
	}


// [jsflux] 방 참여자
/* function participantsList(room){
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
} */

// [jsflux] 내 화상화면 시작
function publishOwnFeed(useAudio) {
	
	$('#publish').css('display','none');
	$('#unpublish').css('display','block');

	var mediaset = null;
	var publishset = null;
	if(usermode === "1"){
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
	}else{
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
		//edia: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	
		media : mediaset,
		simulcast: doSimulcast,
		simulcast2: doSimulcast2,
		success: function(jsep) {
			Janus.debug("Got publisher SDP!", jsep);
			//var publish = { request: "configure", audio: useAudio, video: true };
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

//화면 공유
async function publishOwnFeed2(useAudio) {
	// Publish our stream
	//$('#publish').attr('disabled', true).unbind('click');

	try{
		const screenStream = await navigator.mediaDevices.getDisplayMedia({
         video: true,
         audio: false,
      });
	
		sfutest.createOffer(
		{
			stream: screenStream,
			media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	
			simulcast: doSimulcast,
			simulcast2: doSimulcast2,
			success: function(jsep) {
				Janus.debug("Got publisher SDP!", jsep);
				var publish = { request: "configure", audio: useAudio, video: true }; //미디어 송출 설정
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
	} catch (err) {
      console.error("화면 공유 실패:", err);
   }
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
	// Unpublish our stream
	//$('#unpublish').attr('disabled', true).unbind('click');

	$('#publish').css('display','block');
	$('#unpublish').css('display','none');

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
					$('#videoremote'+remoteFeed.rfindex).append(
						'<span class="label label-primary hide" id="curres'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>' +
						'<span class="label label-info hide" id="curbitrate'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;"></span>');
					// Show the video, hide the spinner and show the resolution when we get a playing event
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
//해상도, FPS(프레임속도) 버튼 생성 적용
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

//해상도, FPS(프레임속도) 변경 후 적용
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
