import { createRoot } from "react-dom/client"

import { Socket, io } from "socket.io-client"
import { makeAutoObservable } from "mobx"
import { observer } from "mobx-react-lite"
import { useEffect, useRef } from "react"

import "./index.scss"

let ws: Socket = io("localhost:4000")

type RemoteUser = {
  id: string;
  stream?: MediaStream;
  peer?: RTCPeerConnection
}
class State {
  constructor() {
    makeAutoObservable(this)
  }
  localStream?: MediaStream
  remoteUsers: RemoteUser[] = []
  camOn = true
  micOn = true
  socketId: string

  toggleCam() {
    console.log('toggle camera');
    this.camOn = !this.camOn
    if (!this.camOn) {
      state.localStream?.getVideoTracks().forEach((track) => track.stop())
    } else {
      startLocalStream(state.camOn, state.micOn)
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
}
const state = new State()

const startLocalStream = (camOn: boolean, micOn: boolean) => {
  navigator.mediaDevices
    .getUserMedia({ video: camOn, audio: micOn })
    .then((stream) => {
      state.localStream = stream
      console.log('length', state.remoteUsers.length)
      if (state.remoteUsers.length > 0) {
        state.remoteUsers.forEach(r => {
          createPeerConnection(r.id)
        })
      }
    })
}

const createPeerConnection = async (id: string, offerSdp?: RTCSessionDescriptionInit) => {
  console.log('create peer connection to ' + id)
  const remote = state.remoteUsers.find(r => r.id === id)
  remote!.stream = new MediaStream(); // reset stream
  const configuration = { 'iceServers': [{ 'urls': ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] }
  const peer = new RTCPeerConnection(configuration)
  peer.onicecandidate = onPeerIceCandidate
  peer.ontrack = (e) => {
    console.log('remote stream', remote?.stream)
    onPeerTrack(e, remote?.stream)
  }
  remote!.peer = peer
  state.localStream?.getTracks().forEach(t => remote!.peer?.addTrack(t))
  if (!offerSdp) {
    const localSdp = await remote!.peer!.createOffer({ iceRestart: true })
    remote!.peer!.setLocalDescription(localSdp)
    console.log('emit offer')
    ws.emit('offer', {
      to: id,
      offer: localSdp
    })
  } else {
    console.log('set remote')
    remote!.peer!.setRemoteDescription(new RTCSessionDescription(offerSdp))
    const localSdp = await remote!.peer!.createAnswer()
    remote!.peer!.setLocalDescription(localSdp)
    ws.emit('answer', {
      to: id,
      answer: localSdp
    })
  }
}


const onPeerTrack = (e: RTCTrackEvent, stream?: MediaStream) => {
  console.log('onpeertrack')
  stream?.addTrack(e.track)
}

const onPeerIceCandidate = (e: RTCPeerConnectionIceEvent) => {
  ws.emit('icecandidate', e.candidate)
}

const joinRoom = () => {
  ws.emit('joinRoom', { name: "Tu" })
}

const onJoinRoomSuccess = (d: { serverSocketId: string, room: string[] }) => {
  console.log('join room success', d.serverSocketId)
  state.socketId = d.serverSocketId
  d.room.forEach(id => {
    if (!(state.remoteUsers.some(r => r.id === id)) && id != state.socketId) {
      state.remoteUsers.push({
        id,
        stream: new MediaStream(),
      })
    }
  });
  ws.emit('call', {
    callId: d.serverSocketId
  })
}
const onNewUserJoin = (d: { newUserId: string }) => {
  state.remoteUsers.push({
    id: d.newUserId,
    stream: new MediaStream()
  })
}
const onOffer = (d: { to: string }) => {
  console.log('on offer')
  createPeerConnection(d.to)
}
const onReceiveOffer = (d: { from: string, offer: RTCSessionDescriptionInit }) => {
  console.log('receiver offer', d.offer)
  const remote = state.remoteUsers.find(r => r.id === d.from);
  if (remote?.peer) {
    cleanupPeer(remote.peer)
  }
  createPeerConnection(d.from, d.offer)
}
const cleanupPeer = (peer: RTCPeerConnection | undefined) => {
  if (!peer) {
    return
  }
  peer.onicecandidate = null
  peer.onicecandidateerror = null
  peer.ontrack = null
  peer.close()
  peer = undefined
}
const onReceiveAnswer = (d: { from: string, answer: RTCSessionDescriptionInit }) => {
  console.log('receive answer')
  const remote = state.remoteUsers.find(r => r.id === d.from);
  remote?.peer?.setRemoteDescription(d.answer)
  console.log('set remote desc', d.answer)
}
const onWsIcecandidate = (d: { from: string, icecandidate: RTCIceCandidate | null }) => {
  console.log('on ws icecandidate')
  if (d.icecandidate) {
    const remote = state.remoteUsers.find(r => r.id === d.from);
    remote?.peer?.addIceCandidate(new RTCIceCandidate(d.icecandidate))
    return
  }
}

ws.on('joinRoomSuccess', onJoinRoomSuccess)
ws.on('newUserJoin', onNewUserJoin)
ws.on('offer', onOffer)
ws.on('receiveOffer', onReceiveOffer)
ws.on('receiveAnswer', onReceiveAnswer)
ws.on('icecandidate', onWsIcecandidate)

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
      <video className="video" ref={ref} playsInline autoPlay></video>
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
  useEffect(() => {
    console.log('remote streams');

  }, [JSON.stringify(state.remoteUsers)])
  return (
    <div className="app">
      <div className="app-container">
        <h1>One Call</h1>
        <button className="join-button" onClick={() => joinRoom()}>Join Party</button>
        <div className="grid-layout">
          <Video name={state.socketId} stream={state.localStream}>
            <Controls />
          </Video>
          {state.remoteUsers.map(u => <Video key={u.id} name={u.id} stream={u.stream} />)}
        </div>
      </div>
    </div>
  )
})

const root = document.getElementById("root") as HTMLElement
createRoot(root).render(<App />)
