import {defer} from '@benricheson101/util';
import {
  createContext,
  type FC,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const REST_URL = 'http://127.0.0.1:8000/api';
const WSS = REST_URL + '/ws';

const rtcConfig: RTCConfiguration = {
  // iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
};

type WebRTCState = {
  ws: WebSocket | null;
  sendWs(msg: unknown): void;
  connect(): Promise<void>;
  waitForWS(pred: (msg: WSMessage) => boolean): Promise<void>;
  call(): Promise<void>;
  auth(code: string): Promise<void>;

  code: string | null;
  isConnected: boolean;
  dataChannels: {
    tx: RTCDataChannel | null;
    rx: RTCDataChannel | null;
  };
};

const enum WSMessageType {
  Auth = 'auth',
  Offer = 'offer',
  Answer = 'answer',
  ICECandidate = 'icecandidate',
  Join = 'join',
}

type MakeWSMessage<Type extends WSMessageType, Data> = {type: Type; data: Data};

// TODO: make a state machine?
type WSMessageInbound =
  | MakeWSMessage<WSMessageType.Auth, {code: string; role: 'send' | 'recv'}>
  | MakeWSMessage<WSMessageType.Offer, unknown>
  | MakeWSMessage<WSMessageType.Answer, unknown>
  | MakeWSMessage<WSMessageType.ICECandidate, unknown>
  | MakeWSMessage<WSMessageType.Join, null>

type WSMessageOutbound = MakeWSMessage<WSMessageType.Auth, null>;
type WSMessage = WSMessageInbound| WSMessageInbound;

const WebRTCContext = createContext<WebRTCState>(undefined!);

type Props = {};

export const WebRTCProvider: FC<PropsWithChildren<Props>> = ({children}) => {
  const ws = useRef<WebSocket>(null);
  const pc = useRef<RTCPeerConnection>(null);

  const [txdc, setTxdc] = useState<RTCDataChannel | null>(null);
  const [rxdc, setRxdc] = useState<RTCDataChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // FIXME: changing code should reset everything?
  const [code, setCode] = useState<string | null>(null);

  // TODO: should this be a state?
  const waitFor = useRef<
    {pred: (msg: WSMessage) => boolean; resolve: () => void}[]
  >([]);

  useEffect(() => {
    pc.current = new RTCPeerConnection(rtcConfig);
    const _ws = new WebSocket(WSS);

    const tx = pc.current.createDataChannel('data');
    tx.addEventListener('open', () => {
      console.log('tx open');
    });

    setTxdc(tx);

    pc.current.addEventListener('icecandidateerror', console.error);

    pc.current.addEventListener('icecandidate', async event => {
      console.log('icecandidate', event);
      if (event.candidate) {
        ws.current!.send(
          JSON.stringify({type: 'icecandidate', data: event.candidate})
        );
      }
    });

    pc.current.addEventListener('signalingstatechange', () => {
      console.log('signalingstatechange', pc.current!.signalingState);
    });

    pc.current.addEventListener('connectionstatechange', () => {
      console.log('connectionstatechange', pc.current!.connectionState);

      switch (pc.current!.connectionState) {
        case 'connected': {
          setIsConnected(true);
          break;
        }

        case 'disconnected': {
          setIsConnected(false);
          setRxdc(null);
          // setTxdc(null);
          break;
        }
      }
    });

    pc.current.addEventListener('negotiationneeded', event => {
      console.log('negotiationneeded', event);
    });

    pc.current.addEventListener('datachannel', event => {
      console.log('got remote datachannel', event.channel.label);
      setRxdc(event.channel);
    });

    _ws.addEventListener('open', () => {
      console.log('websocket connected');
      ws.current = _ws;
    });

    _ws.addEventListener('message', async _msg => {
      console.log(_msg);

      const msg = JSON.parse(_msg.data);

      for (const wait of waitFor.current) {
        try {
          if (wait.pred(msg)) {
            wait.resolve();
            waitFor.current.splice(waitFor.current.indexOf(wait), 1);
          }
        } catch (err) {
          console.warn('error in waitFor function', err);
        }
      }

      switch (msg.type) {
        case 'offer': {
          const remoteDesc = new RTCSessionDescription(msg.data);
          await pc.current!.setRemoteDescription(remoteDesc);

          const answer = await pc.current!.createAnswer();
          await pc.current!.setLocalDescription(answer);

          ws.current!.send(JSON.stringify({type: 'answer', data: answer}));
          break;
        }

        case 'answer': {
          const remoteDesc = new RTCSessionDescription(msg.data);
          await pc.current!.setRemoteDescription(remoteDesc);
          break;
        }

        case 'icecandidate': {
          try {
            await pc.current!.addIceCandidate(msg.data);
            console.log('added ice candidate');
          } catch (err) {
            console.error('error adding ice candidate:', err);
          }
          break;
        }
      }
    });

    return () => {
      _ws.close();
      ws.current = null;

      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
    };
  }, []);

  const waitForWS = (pred: (msg: WSMessage) => boolean) => {
    const [promise, resolve] = defer<void>();
    waitFor.current.push({pred, resolve});
    return promise;
  };

  const connect = async () => {
    if (!ws.current || ws.current.readyState !== ws.current.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    // if (!pc.current || pc.current.connectionState !== 'disconnected') {
    // FIXME: how do i make this work with closed pcs
    if (!pc.current) {
      throw new Error('RTCPeerConnection is not disconnected');
    }

    await waitForWS((m: WSMessage) => m.type === 'join');

    const offer = await pc.current.createOffer({
      // iceRestart: true,
    });
    await pc.current.setLocalDescription(offer);
    sendWs({type: 'offer', data: offer});
  };

  const sendWs = (msg: unknown) =>
    ws.current?.send(typeof msg === 'string' ? msg : JSON.stringify(msg));

  const createTicket = async () => {
    const ticket = await fetch(REST_URL + '/tickets', {
      method: 'POST',
    }).then(r => r.json());

    console.log(ticket);
    const code: string = ticket.code;
    return code;
  };

  const auth = async (code: string) => {
    setCode(code);

    sendWs({type: 'auth', data: {code}});
    await waitForWS((m: any) => m.type === 'auth');
    console.log('got auth back!');
  };

  const call = async () => {
    const code = await createTicket();
    await auth(code);
    await connect();
  };

  const value: WebRTCState = {
    ws: ws.current,
    sendWs,
    connect,
    waitForWS,
    call,
    code,
    auth,
    isConnected,
    dataChannels: {
      tx: txdc,
      rx: rxdc,
    },
  };

  return (
    <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
  );
};

export const useWebRTC = () => useContext(WebRTCContext);
