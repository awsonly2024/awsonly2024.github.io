var version = 1.2;
var server = null;
server = "https://janus.jsflux.co.kr/janus"; //jsflux janus server url

var janus = null;
var sfutest = null;
var opaqueId = "videoroomtest-"+Janus.randomString(12);

var myroom = 1234;	// Demo room
if(getQueryStringValue("room") !== "")
	myroom = parseInt(getQueryStringValue("room"));
var myusername = null;
var myid = null;
var mystream = null;
var mypvtid = null;

var feeds = [];
var bitrateTimer = [];

var doSimulcast = (getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true");
var doSimulcast2 = (getQueryStringValue("simulcast2") === "yes" || getQueryStringValue("simulcast2") === "true");
var subscriber_mode = (getQueryStringValue("subscriber-mode") === "yes" || getQueryStringValue("subscriber-mode") === "true");

$(document).ready(function() {
	// Initialize the library (all console debuggers enabled)
	Janus.init({debug: "all", callback: function() {
		// Use a button to start the demo
		$('#start').one('click', function() {

			$(this).attr('disabled', true).unbind('click');
			// Make sure the browser supports WebRTC
			if(!Janus.isWebrtcSupported()) {
				bootbox.alert("No WebRTC support... ");
				return;
			}
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
									$('#details').remove();
									sfutest = pluginHandle;
									Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
									Janus.log("  -- This is a publisher/manager");
									/* Room Name, My Name, 대화방 참여 버튼 활성화 */
									$('#videojoin').removeClass('hide').show();
									$('#registernow').removeClass('hide').show();
									$('#roomname').focus();
									$('#start').removeAttr('disabled').html("Stop")
									.click(function() {
										$(this).attr('disabled', true);
										janus.destroy();
									});
									//대화방 참여 버튼을 누르면 대화방은 만들어진다
									$('#register').click(registerUsername);

                    		Janus.log("Room List > ");
                   
								} ,
								error: function(error) {
									Janus.error("  -- Error attaching plugin...", error);
									bootbox.alert("Error attaching plugin... " + error);
								},
							});
					},
					error: function(error) {
						Janus.error(error);
						bootbox.alert(error, function() {
							window.location.reload();
						});
					},
					destroyed: function() {
						window.location.reload();
					}
				});
		});
	}});
});

function checkEnter(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if(theCode == 13) { //keyCode 13 => endter키
		registerUsername();
		return false;
	} else {
		return true;
	}
} 

// [jsflux] 방생성 및 조인
function registerUsername() {
	if($('#roomname').length === 0) {
		// Create fields to register
        $('#register').click(registerUsername);
		$('#roomname').focus();
    } else if($('#username').length === 0) {
		// Create fields to register
		$('#register').click(registerUsername);
		$('#username').focus();
	} else {
		// Try a registration
		$('#username').attr('disabled', true);
		$('#register').attr('disabled', true).unbind('click');

        var roomname = $('#roomname').val();
		if(roomname === "") {
			$('#room')
				.removeClass().addClass('label label-warning')
				.html("채팅방 아이디(번호)를 넣으세요. ex) 1234");
			$('#roomname').removeAttr('disabled');
			$('#register').removeAttr('disabled').click(registerUsername);
			return;
		}
		if(/[^0-9]/.test(roomname)) {
			$('#room')
				.removeClass().addClass('label label-warning')
				.html('채팅방 아이디는 숫자만 가능합니다.');
			$('#roomname').removeAttr('disabled').val("");
			$('#register').removeAttr('disabled').click(registerUsername);
			return;
		}

		var username = $('#username').val();
		if(username === "") {
			$('#you')
				.removeClass().addClass('label label-warning')
				.html("채팅방에서 사용할 닉네임을 입력해주세요.");
			$('#username').removeAttr('disabled');
			$('#register').removeAttr('disabled').click(registerUsername);
			return;
		}
		if(/[^a-zA-Z0-9]/.test(username)) {
			$('#you')
				.removeClass().addClass('label label-warning')
				.html('닉네임은 영문만 가능합니다.');
			$('#username').removeAttr('disabled').val("");
			$('#register').removeAttr('disabled').click(registerUsername);
			return;
		}
        
        myroom = Number(roomname); //사용자 입력 방 아이디

        var createRoom = {
            request : "create",
            room : myroom,
            permanent : false,
            record: false,
            publishers: 6,
            bitrate : 128000,
            fir_freq : 10,
            ptype: "publisher",
            description: "test",
            is_private: false
        }

        sfutest.send({ message: createRoom, success:function(result){
            var event = result["videoroom"]; Janus.debug("Event: " + event);
            if(event != undefined && event != null) {
                //야누스 서버에 방 생성
					 console.log(result)
                console.log("Room Create Result: " + result);
                console.log("error: " + result["error"]);
                room = result["room"];
                console.log("Screen sharing session created: " + room);

					 //생성된 방에 자신을 참여 시킴
              /*  var username = $('#username').val(); //myusername = randomString(12);
                var register = { "request": "join", "room": myroom, "ptype": "publisher", "display": username };
                myusername = username;
                sfutest.send({"message": register}); */

					 location.href = "./myVideoRoom.html?username="+username+"&room="+room;

					 /*
					 사용자의 방 참여를 요청합니다.
					register 객체:
					request: "join": 방에 참여 요청.
					room: 생성된 방 번호를 지정.
					ptype: "publisher": 이 클라이언트는 방에 미디어를 송출하는 역할을 담당.
					display: 방 참여 시 표시될 사용자 이름.
					요청이 성공하면 사용자는 방에 **퍼블리셔(방송 송출자)**로 참여합니다.
					 */
            }
        }});
	}
}


// Helper to parse query string
function getQueryStringValue(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec(location.search);
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
