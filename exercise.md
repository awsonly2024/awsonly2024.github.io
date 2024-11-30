
```java

페이지를 나눠서 처리
방법
방 생성 페이지:

방을 생성하고 서버와 연결.
생성된 방 ID 및 기타 정보를 저장(예: 데이터베이스, 쿠키, 세션스토리지 등).
방 ID를 다른 페이지로 전달(예: URL 파라미터, API 호출, 세션스토리지).
화면 표시 페이지:

전달받은 방 ID를 기반으로 Janus 서버에 연결.
WebRTC 스트림을 표시.
장점
각 페이지가 독립적으로 작동하여 코드 구조가 깔끔.
다양한 사용자 흐름(예: 방 생성 후 다른 사용자 초대)이 가능.
단점
상태를 전달하거나 공유해야 하는 추가 작업 필요.
두 페이지 간의 데이터 전달을 위한 방법을 신경 써야 함.
페이지 분리 방법
1. 방 생성 페이지에서 방 ID 전달
방 생성 페이지:

javascript
코드 복사
var roomId; // Janus에서 생성된 방 ID
sfutest.send({ 
  message: createRoom, 
  success: function(result) {
    if(result["videoroom"] === "created") {
      roomId = result["room"];
      console.log("Room created with ID:", roomId);
      // 방 ID를 다음 페이지로 전달
      window.location.href = `display.html?room=${roomId}`;
    }
  }
});
화면 표시 페이지:

javascript
코드 복사
// URL에서 방 ID 가져오기
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if(roomId) {
  console.log("Joining room:", roomId);
  sfutest.send({
    message: {
      request: "join",
      room: parseInt(roomId),
      ptype: "subscriber",
      display: "Viewer"
    }
  });
} else {
  console.error("Room ID not found in URL.");
}
2. 세션스토리지나 로컬스토리지 사용
방 생성 페이지:

javascript
코드 복사
localStorage.setItem('roomId', result["room"]);
window.location.href = "display.html";
화면 표시 페이지:

javascript
코드 복사
const roomId = localStorage.getItem('roomId');
if(roomId) {
  sfutest.send({
    message: {
      request: "join",
      room: parseInt(roomId),
      ptype: "subscriber",
      display: "Viewer"
    }
  });
} else {
  console.error("Room ID not found in storage.");
}
3. 서버를 통한 데이터 전달
방 생성 후 서버에 정보를 저장하고, 새로운 페이지에서 서버로부터 방 정보를 가져옴.

방 생성 페이지:

javascript
코드 복사
fetch('/api/createRoom', {
  method: 'POST',
  body: JSON.stringify({}),
  headers: { 'Content-Type': 'application/json' }
})
.then(response => response.json())
.then(data => {
  const roomId = data.roomId;
  window.location.href = `display.html?room=${roomId}`;
});
화면 표시 페이지:

javascript
코드 복사
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

fetch(`/api/getRoomInfo?roomId=${roomId}`)
  .then(response => response.json())
  .then(data => {
    // 서버로부터 방 정보를 받아서 Janus에 연결
  });

```