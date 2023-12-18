import { createRoot } from "react-dom/client";

import { Socket, io } from "socket.io-client";
import { makeAutoObservable } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import "./index.scss";

let ws: Socket = io("localhost:4000");

const startLocalStream = (camOn: boolean, micOn: boolean) => {
  navigator.mediaDevices
    .getUserMedia({ video: camOn, audio: micOn })
    .then((stream) => state.setLocalStream(stream));
};

const joinRoom = () => {
  ws.emit('joinRoom')
}

class State {
  constructor() {
    makeAutoObservable(this);
  }
  localStream?: MediaStream;
  remoteStreams: MediaStream[];
  camOn = true;
  micOn = true;

  toggleCam() {
    this.camOn = !this.camOn;
    if (this.camOn) {
      startLocalStream(state.camOn, state.micOn);
    }
    else {
      state.localStream?.getVideoTracks().forEach((track) => track.stop());
    }
  }
  toggleMic() {
    this.micOn = !this.micOn;
    if (this.micOn) {
      startLocalStream(state.camOn, state.micOn);
    } else {
      state.localStream?.getAudioTracks().forEach((track) => track.stop());
    }
  }
  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
  }
}

const state = new State();

const Video = ({
  stream,
  children,
}: {
  stream: MediaStream | undefined;
  children?: React.ReactNode;
}) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!stream || !ref.current) return;
    ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="video-wrapper">
      <video className="video" ref={ref} playsInline autoPlay muted></video>
      {children}
    </div>
  );
};

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
  );
});

const App = observer(() => {
  useEffect(() => {
    startLocalStream(true, true);
  }, []);
  return (
    <div className="app">
      <div className="app-container">
        <h1>One Call</h1>
        <button className="join-button" onClick={() => joinRoom()}>Join Party</button>
        <div className="grid-layout">
          <Video stream={state.localStream}>
            <Controls />
          </Video>
        </div>
      </div>
    </div>
  );
});

const root = document.getElementById("root") as HTMLElement;
createRoot(root).render(<App />);
