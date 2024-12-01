alert("registerUsername() : 방생성 및 조인");

let username = "aaaaa";
let room = Number(882395);

//var register = { "request": "join", "room": room, "ptype": "subscriber", "display": username };
var register = { "request": "join", "room": room, "ptype": "publisher", "display": username };
sfutest.send({"message": register});