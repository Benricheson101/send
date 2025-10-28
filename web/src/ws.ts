export class SignalingChannel {
  ws: WebSocket;

  constructor(wssUrl: 'ws://localhost:8080') {
    this.ws = new WebSocket(wssUrl);
  }

  send(msg: unknown) {
    this.ws.send(JSON.stringify(msg));
  }
}
