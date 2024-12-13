var version = 1.2;
var server = null;
server = "https://janus.jsflux.co.kr/janus"; //jsflux janus server url

var janus = null;
var sfutest = null;
var opaqueId = "videoroomtest-"+Janus.randomString(12);


$(document).ready(function() {
	// Initialize the library (all console debuggers enabled)

	Janus.init({debug: "all", callback: function() {
		
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
								
							Janus.log("Room List > ");
							//roomList();
							},
							error: function(error) {
								Janus.error("  -- Error attaching plugin...", error);
								bootbox.alert("Error attaching plugin... " + error);
							},
							consentDialog: function(on) {},
							iceState: function(state) {},
							mediaState: function(medium, on) {},
							webrtcState: function(on) {},
							onmessage: function(msg, jsep) {},
							onlocalstream: function(stream) {},
							onremotestream: function(stream) {},
							oncleanup: function() {}
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
	}});
});

function checkEnter(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if(theCode == 13) {
		publisher_mode();
		return false;
	} else {
		return true;
	}
}

//방생성
function publisher_mode() {

	/*
	broadcastModeSelect : 0 회의 모드
	broadcastModeSelect : 1 개인 방송 모드
	0이든 1이든 방 생성까지는 동일
	이후 링크 주소가 다름
	*/
	let broadcastModeSelect = $("#broadcastModeSelect").val();
	
	let room = $("#txtRoom").val();
	if(room === "") {
		alert("방송 번호를 입력하세요");
		$("#txtRoom").focus();
		return;
	}

	if(isNaN(room)){
		alert("방송 번호를 숫자만 가능합니다.");
		$("#txtRoom").focus();
		return;
	}

	let username = $("#txtName").val();
	if(username === ""){
		alert("닉네임을 입력하세요")
		$("#txtName").focus();
		return;
	}
	
	room = Number(room); //사용자 입력 방 아이디
	var createRoom = {
		request : "create",
		room : room,
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
		
		console.log(result); 
		/* result 내용 => 배열 값으로 리턴
		방이 제대로 생성되었으면 created
		{videoroom: 'created', room: 3353, permanent: false}

		기존 방이 존재하면 event
		{videoroom: 'event', error_code: 427, error: 'Room 3353 already exists'}
		*/

		if(result["videoroom"] === "event"){
			alert("방송이 이미 존재합니다.");
			return;
		}
		
		if(broadcastModeSelect === "0"){ //회의 모드의 판매자 1
			location.href = "./detailMeeting.html?username="+username+"&room="+room+"&usermode=1";
		}else if(broadcastModeSelect === "1"){ //개인 방송 모드의 판매자 1
			location.href = "./detailPersonal.html?username="+username+"&room="+room+"&usermode=1";
		}else{
			console.log("broadcastModeSelect error");
		}
	}});
}


//방 참가
function subscriber_mode(){

	//참가는 바로 주소만 넘겨준다. 해당 주소에서 바로 join

	let broadcastModeSelect = $("#broadcastModeSelect").val();
	
	let room = $("#txtRoom").val();
	if(room === "") {
		alert("방송 번호를 입력하세요");
		$("#txtRoom").focus();
		return;
	}

	if(isNaN(room)){
		alert("방송 번호를 숫자만 가능합니다.");
		$("#txtRoom").focus();
		return;
	}

	let username = $("#txtName").val();
	if(username === ""){
		alert("닉네임을 입력하세요")
		$("#txtName").focus();
		return;
	}

	if(broadcastModeSelect === "0"){ //회의 모드의 구매자 0
		location.href = "./detailMeeting.html?username="+username+"&room="+room+"&usermode=0";
	}else if(broadcastModeSelect === "1"){ //개인 방송 모드의 구매자 0
		location.href = "./detailPersonal.html?username="+username+"&room="+room+"&usermode=0";
	}else{
		console.log("broadcastModeSelect error");
	}
}