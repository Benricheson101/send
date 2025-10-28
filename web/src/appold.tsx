// import {useEffect, useRef, useState} from 'react';
import {Channel} from './Channel';
import {useWebRTC} from './providers/WebRTC';

// const config: RTCConfiguration = {
//   iceServers: [
//     {urls: 'stun:global.turn.twilio.com:3478'},
//   ],
// };

function App() {
  // const ws = useRef<WebSocket>(null);
  // const pc = useRef<RTCPeerConnection>(null);
  //
  // const [txdc, setTxdc] = useState<RTCDataChannel | null>(null);
  // const [rxdc, setRxdc] = useState<RTCDataChannel | null>(null);
  //
  // const [isConnected, setIsConnected] = useState(false);
  //
  // useEffect(() => {
  //   pc.current = new RTCPeerConnection(config);
  //   const _ws = new WebSocket('ws://localhost:8000/ws');
  //
  //   const tx = pc.current.createDataChannel('data');
  //   tx.addEventListener('open', () => {
  //     console.log('tx open');
  //   });
  //
  //   setTxdc(tx);
  //
  //   pc.current.addEventListener('icecandidateerror', console.error);
  //
  //   _ws.addEventListener('open', () => {
  //     console.log('websocket connected');
  //     ws.current = _ws;
  //   });
  //
  //   _ws.addEventListener('message', async _msg => {
  //     console.log(_msg);
  //
  //     const msg = JSON.parse(_msg.data);
  //
  //     switch (msg.type) {
  //       case 'offer': {
  //         const remoteDesc = new RTCSessionDescription(msg.data);
  //         await pc.current!.setRemoteDescription(remoteDesc);
  //
  //         const answer = await pc.current!.createAnswer();
  //         await pc.current!.setLocalDescription(answer);
  //
  //         ws.current!.send(JSON.stringify({type: 'answer', data: answer}));
  //         break;
  //       }
  //
  //       case 'answer': {
  //         const remoteDesc = new RTCSessionDescription(msg.data);
  //         await pc.current!.setRemoteDescription(remoteDesc);
  //         break;
  //       }
  //
  //       case 'add-ice-candidate': {
  //         try {
  //           await pc.current!.addIceCandidate(msg.data);
  //           console.log('added ice candidate');
  //         } catch (err) {
  //           console.error('error adding ice candidate:', err);
  //         }
  //         break;
  //       }
  //     }
  //   });
  //
  //   pc.current.addEventListener('icecandidate', async event => {
  //     console.log('icecandidate', event);
  //     if (event.candidate) {
  //       ws.current!.send(
  //         JSON.stringify({type: 'add-ice-candidate', data: event.candidate})
  //       );
  //     }
  //   });
  //
  //   pc.current.addEventListener('signalingstatechange', () => {
  //     console.log('signalingstatechange', pc.current!.signalingState);
  //   });
  //
  //   pc.current.addEventListener('connectionstatechange', () => {
  //     console.log('connectionstatechange', pc.current!.connectionState);
  //
  //     switch (pc.current!.connectionState) {
  //       case 'connected': {
  //         setIsConnected(true);
  //         break;
  //       }
  //
  //       case 'disconnected': {
  //         setIsConnected(false);
  //         setRxdc(null);
  //         // setTxdc(null);
  //         break;
  //       }
  //     }
  //   });
  //
  //   pc.current.addEventListener('datachannel', event => {
  //     console.log('got remote datachannel', event.channel.label);
  //     setRxdc(event.channel);
  //   });
  //
  //   return () => {
  //     console.log('cleanup');
  //     _ws.close();
  //     ws.current = null;
  //
  //     if (pc.current) {
  //       pc.current.close();
  //       pc.current = null;
  //     }
  //   };
  // }, []);

  // const makeCall = async () => {
  //   if (!ws.current || !pc.current) {
  //     throw new Error('no ws or pc');
  //   }
  //
  //   const offer = await pc.current.createOffer({
  //     iceRestart: true,
  //   });
  //   await pc.current.setLocalDescription(offer);
  //   ws.current.send(JSON.stringify({type: 'offer', data: offer}));
  // };

  const rtc = useWebRTC();

  const tf = (a: unknown) => (!!a).toString();
  return (
    <>
      <p>isConnected: {tf(rtc.isConnected)}</p>
      <p>tx: {tf(rtc.dataChannels.tx)}</p>
      <p>rx: {tf(rtc.dataChannels.rx)}</p>

      {rtc.isConnected && rtc.dataChannels.tx && rtc.dataChannels.rx ? (
        <Channel tx={rtc.dataChannels.tx} rx={rtc.dataChannels.rx} />
      ) : (
        <button type='button' onClick={rtc.connect}>
          Make Call
        </button>
      )}
    </>
  );
}

export default App;
