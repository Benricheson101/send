import {useEffect, useRef, useState} from 'react';

import {Channel} from './Channel';

const config: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
};

function App() {
  const ws = useRef<WebSocket>(null);
  const pc = useRef<RTCPeerConnection>(null);

  const [txdc, setTxdc] = useState<RTCDataChannel | null>(null);
  const [rxdc, setRxdc] = useState<RTCDataChannel | null>(null);

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const _ws = new WebSocket('ws://localhost:8080');
    pc.current = new RTCPeerConnection(config);

    const tx = pc.current.createDataChannel('data');
    tx.addEventListener('open', () => {});

    setTxdc(tx);
    ws.current = _ws;

    _ws.addEventListener('open', () => {
      console.log('websocket connected');
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

    pc.current.addEventListener('icecandidate', async event => {
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
      setRxdc(event.channel);
    });

    return () => {
      // _ws.close();
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }

      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
    };
  }, []);

  const makeCall = async () => {
    if (!ws.current || !pc.current) {
      throw new Error('no ws or pc');
    }

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    ws.current.send(JSON.stringify({type: 'offer', data: offer}));
  };

  return (
    <>
      {isConnected && txdc && rxdc ? (
        <Channel tx={txdc} rx={rxdc} />
      ) : (
        <button type='button' onClick={makeCall}>
          Make Call
        </button>
      )}
    </>
  );
}

export default App;
