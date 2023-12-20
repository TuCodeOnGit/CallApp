import http from "http";
import { Server, Socket } from "socket.io";

const server = http.createServer();
let room: Socket[] = [];
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
  pingInterval: 3000,
  pingTimeout: 4000,
});

io.on("connection", (s: Socket) => {
  console.log('connect', s.id)
  s.on("joinRoom", d => {
    console.log(`id:${s.id}, name${d.name} join room`)
    room.push(s);
    s.emit('joinRoomSuccess', {
      serverSocketId: s.id,
      room: room.map(s => s.id)
    })
    room
      .filter(o => o.id !== s.id)
      .forEach(o => o.emit('newUserJoin', { newUserId: s.id }))
  })
  s.on('call', (d: { callId: string }) => {
    if (room.length <= 1) return
    const caller: Socket = room.find(s => s.id == d.callId) as Socket
    room.filter(s => s != caller).forEach((s: Socket) => {
      caller.emit('offer', {
        to: s.id
      })
    })
  })
  s.on('offer', (d: {to: string, offer: RTCSessionDescriptionInit }) => {
    const so = room.find(s => s.id == d.to) as Socket
    so.emit('receiveOffer', {
      from: s.id,
      offer: d.offer
    })
  })
  s.on('answer', (d: { to: string, answer: RTCSessionDescriptionInit }) => {
    const so = room.find(s => s.id == d.to) as Socket
    so.emit('receiveAnswer', {
      from: s.id,
      answer: d.answer
    })
  })
  s.on('icecandidate', (d: RTCIceCandidate | null) => {
    room
      .filter(o => o.id !== s.id)
      .forEach(o => o.emit('icecandidate', {
        from: s.id,
        icecandidate: d
      }))
  })
  s.on('disconnect', () => {
    room = room.filter(o => s.id !== o.id)
  })
});

const port = 4000;
server
  .listen(port)
  .on("error", console.error)
  .on("listening", () => {
    console.log(`listening on port ${port}`);
  });
