import {
  createContext,
  type FC,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const WSS = 'ws://localhost:8000/ws';

const rtcConfig: RTCConfiguration = {
  iceServers: [{urls: 'stun:global.turn.twilio.com:3478'}],
};

type WebRTCState = {
  ws: WebSocket | null;
  sendWs(msg: unknown): void;
  connect(): Promise<void>;

  isConnected: boolean;
  dataChannels: {
    tx: RTCDataChannel | null;
    rx: RTCDataChannel | null;
  };
};

const WebRTCContext = createContext<WebRTCState>(undefined!);

type Props = {};

export const WebRTCProvider: FC<PropsWithChildren<Props>> = ({children}) => {
  const ws = useRef<WebSocket>(null);
  const pc = useRef<RTCPeerConnection>(null);

  const [txdc, setTxdc] = useState<RTCDataChannel | null>(null);
  const [rxdc, setRxdc] = useState<RTCDataChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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
          JSON.stringify({type: 'add-ice-candidate', data: event.candidate})
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

        case 'add-ice-candidate': {
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

  const connect = async () => {
    if (!ws.current || ws.current.readyState !== ws.current.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    // if (!pc.current || pc.current.connectionState !== 'disconnected') {
    // FIXME: how do i make this work with closed pcs
    if (!pc.current) {
      throw new Error('RTCPeerConnection is not disconnected');
    }

    const offer = await pc.current.createOffer({
      iceRestart: true,
    });
    await pc.current.setLocalDescription(offer);
    sendWs({type: 'offer', data: offer});
  };

  const sendWs = (msg: unknown) =>
    ws.current?.send(typeof msg === 'string' ? msg : JSON.stringify(msg));

  const value: WebRTCState = {
    ws: ws.current,
    sendWs,
    connect,
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
