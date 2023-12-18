import http from "http";
import { Server, Socket } from "socket.io";

const server = http.createServer();
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
    s.on("joinRoom", () => {
      console.log(`socket id ${s.id} `)
    })
});
const port = 4000;
server
  .listen(port)
  .on("error", console.error)
  .on("listening", () => {
    console.log(`listening on port ${port}`);
  });
