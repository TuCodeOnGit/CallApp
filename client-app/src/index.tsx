import { createRoot } from "react-dom/client";

import './index.scss'
import { Socket, io } from "socket.io-client";

let ws: Socket =  io('localhost:4000');

const App = () => {
  return <>Hello react</>;
};
const root = document.getElementById("root") as HTMLElement;
createRoot(root).render(<App />);
