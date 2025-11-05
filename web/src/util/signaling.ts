import {defer} from '@benricheson101/util';

export enum WSMessageType {
  Auth = 'auth',
  Offer = 'offer',
  Answer = 'answer',
  ICECandidate = 'icecandidate',
  Join = 'join',
}

type MakeWSMessage<Type extends WSMessageType, Data> = {type: Type; data: Data};

export enum PeerRole {
  Send = 'send',
  Recv = 'recv',
}

// TODO: make a state machine?
type WSMessageInbound =
  | MakeWSMessage<WSMessageType.Auth, {code: string; role: PeerRole}>
  | MakeWSMessage<WSMessageType.Offer, RTCSessionDescriptionInit>
  | MakeWSMessage<WSMessageType.Answer, RTCSessionDescriptionInit>
  | MakeWSMessage<WSMessageType.ICECandidate, RTCIceCandidateInit>
  | MakeWSMessage<WSMessageType.Join, null>;

type WSMessageOutbound = MakeWSMessage<WSMessageType.Auth, null>;
export type WSMessage = WSMessageInbound | WSMessageOutbound;

export class SignalingServer extends EventTarget {
  ws: WebSocket;
  protected authed = false;

  #waitFor = new Set<{
    pred(msg: WSMessage): boolean;
    resolve(msg: WSMessage): void;
    reject(e: unknown): void;
  }>();

  constructor(readonly wss: string) {
    super();

    this.ws = new WebSocket(wss);
    this.ws.addEventListener('message', this.#onMessage.bind(this));
    this.ws.addEventListener('open', this.#onOpen.bind(this));
    this.ws.addEventListener('close', this.#onClose.bind(this));
  }

  static connect(wss: string) {
    const ss = new SignalingServer(wss);

    const [promise, resolve] = defer<SignalingServer>();
    ss.ws.addEventListener('open', () => resolve(ss), {once: true});

    return promise;
  }

  async waitFor(pred: (msg: WSMessage) => boolean): Promise<WSMessage> {
    const [promise, resolve, reject] = defer<WSMessage>();
    this.#waitFor.add({pred, resolve, reject});
    return promise;
  }

  send(msg: WSMessageInbound) {
    console.info('send', msg);
    this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws.close();
  }

  async auth(code: string, role: PeerRole) {
    if (this.authed) {
      throw new Error('Cannot authenticate twice');
    }

    this.send({type: WSMessageType.Auth, data: {code, role}});
    await this.waitFor(m => m.type === 'auth');
    this.authed = true;
    return this;
  }

  async #onMessage(event: MessageEvent<any>) {
    const msg: WSMessage = JSON.parse(event.data);
    console.log(msg);

    this.dispatchEvent(new CustomEvent('message', {detail: msg}));
    this.dispatchEvent(new CustomEvent(msg.type, {detail: msg.data}));

    this.#waitFor.forEach(w => {
      try {
        if (w.pred(msg)) {
          console.log(true, w.pred.toString());
          w.resolve(msg);
          this.#waitFor.delete(w);
          return;
        } else {
          console.log(false, w.pred.toString());
        }
      } catch (err) {
        console.error('Error in waitFor function', err);
        w.reject(err);
      }
    });
  }

  async #onOpen() {
    this.dispatchEvent(new CustomEvent('open'));
    console.log('websocket connected');
  }

  async #onClose() {
    this.dispatchEvent(new CustomEvent('close'));
    console.log('websocket closed');
  }
}
