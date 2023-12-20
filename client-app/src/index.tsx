import { createRoot } from "react-dom/client"

import { Socket, io } from "socket.io-client"
import { makeAutoObservable } from "mobx"
import { observer } from "mobx-react-lite"
import { useEffect, useRef } from "react"

import "./index.scss"

class State {
  constructor() {
    makeAutoObservable(this)
  }
  localStream?: MediaStream
  remoteStreams: { 
    [userId: string]: 
    {  
      stream?: MediaStream,
      peer?: RTCPeerConnection 
    } 
  } = {}
  camOn = true
  micOn = true
  socketId: string

  toggleCam() {
    this.camOn = !this.camOn
    if (this.camOn) {
      startLocalStream(state.camOn, state.micOn)
    }
    else {
      state.localStream?.getVideoTracks()
        .forEach((track) => track.stop())
    }
  }
  toggleMic() {
    this.micOn = !this.micOn
    if (this.micOn) {
      startLocalStream(state.camOn, state.micOn)
    } else {
      state.localStream?.getAudioTracks()
        .forEach((track) => track.stop())
    }
  }
  setLocalStream(stream: MediaStream) {
    this.localStream = stream
  }
}

const state = new State()

let ws: Socket = io("localhost:4000")

const createPeerConnection = async (id: string, offerSdp?: RTCSessionDescriptionInit) => {
  console.log('create peer connection for ' + id)
  const configuration = { 'iceServers': [{ 'urls': ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] }
  const peer = state.remoteStreams[id].peer = new RTCPeerConnection(configuration)
  peer.onicecandidate = onPeerIceCandidate
  peer.ontrack = onPeerTrack
  state.localStream?.getTracks().forEach(t => peer?.addTrack(t))
  if (!offerSdp) {
    const localSdp = await peer.createOffer()
    peer.setLocalDescription(localSdp)
    ws.emit('offer', {
      to: id,
      offer: localSdp
    })
    return
  }
  peer.setRemoteDescription(new RTCSessionDescription(offerSdp))
  const localSdp = await peer.createAnswer()
  peer.setLocalDescription(localSdp)
  ws.emit('answer', {
    to: id,
    answer: localSdp
  })
}
const onPeerTrack = (e: RTCTrackEvent) => {
  Object.keys(state.remoteStreams).forEach(key => {
    state.remoteStreams[key].stream?.addTrack(e.track);
  })
}

const joinRoom = () => {
  ws.emit('joinRoom', { name: "Tu" })
}
const onJoinRoomSuccess = (d: { serverSocketId: string, room: string[] }) => {
  console.log('join room success', d.serverSocketId)
  state.socketId = d.serverSocketId
  d.room.forEach(id => {
    if (!(id in state.remoteStreams) && id != state.socketId) {
      state.remoteStreams[id] = {
        stream: new MediaStream()
      }
    }
  });
  ws.emit('call', {
    callId: d.serverSocketId
  })
}
const onNewUserJoin = (d: { newUserId: string }) => {
  state.remoteStreams[d.newUserId] = {
    stream: new MediaStream()
  }
  console.log(Object.keys(state.remoteStreams).length)
}
const onOffer = (d: { to: string }) => {
  createPeerConnection(d.to)
}
const onReceiveOffer = (d: { from: string, offer: RTCSessionDescriptionInit }) => {
  createPeerConnection(d.from, d.offer)
}
const onReceiveAnswer = (d: { from: string, answer: RTCSessionDescriptionInit }) => {
  console.log('receiver answer', d.answer)
  state.remoteStreams[d.from].peer?.setRemoteDescription(d.answer)
}
const onWsIcecandidate = (d: { from: string, icecandidate: RTCIceCandidate | null }) => {
  console.log('on ws icecandidate')
  if (d.icecandidate) {
    state.remoteStreams[d.from].peer?.addIceCandidate(new RTCIceCandidate(d.icecandidate))
    return
  }
}

ws.on('joinRoomSuccess', onJoinRoomSuccess)
ws.on('newUserJoin', onNewUserJoin)
ws.on('offer', onOffer)
ws.on('receiveOffer', onReceiveOffer)
ws.on('receiveAnswer', onReceiveAnswer)
ws.on('icecandidate', onWsIcecandidate)


const startLocalStream = (camOn: boolean, micOn: boolean) => {
  navigator.mediaDevices
    .getUserMedia({ video: camOn, audio: micOn })
    .then((stream) => {
      state.setLocalStream(stream)
    })
}

const onPeerIceCandidate = (e: RTCPeerConnectionIceEvent) => {
  ws.emit('icecandidate', e.candidate)
}

const Video = ({
  stream,
  name,
  children,
}: {
  name: string,
  stream: MediaStream | undefined
  children?: React.ReactNode
}) => {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (!stream || !ref.current) return
    ref.current.srcObject = stream
  }, [stream])
  return (
    <div className="video-wrapper">
      name: {name}
      <video className="video" ref={ref} playsInline autoPlay muted></video>
      {children}
    </div>
  )
}

const Controls = observer(() => {
  return (
    <div className="controls">
      <button className="button" onClick={() => state.toggleCam()}>
        {!state.camOn ? "▶️" : "⏹️"}
      </button>
      <button className="button" onClick={() => state.toggleMic()}>
        {!state.micOn ? "🔉" : "🔇"}
      </button>
    </div>
  )
})

const App = observer(() => {
  useEffect(() => {
    startLocalStream(true, true)
  }, [])
  return (
    <div className="app">
      <div className="app-container">
        <h1>One Call</h1>
        <button className="join-button" onClick={() => joinRoom()}>Join Party</button>
        <div className="grid-layout">
          <Video name={state.socketId} stream={state.localStream}>
            <Controls />
          </Video>
          {Object.keys(state.remoteStreams)
            .map(id => <Video key={id} stream={state.remoteStreams[id].stream} name={id} />)}
        </div>
      </div>
    </div>
  )
})

const root = document.getElementById("root") as HTMLElement
createRoot(root).render(<App />)
