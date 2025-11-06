import {defer} from '@benricheson101/util';
import {useRef, useState} from 'react';

import {REST_URL} from '../util/rest';
import {
  PeerRole,
  SignalingServer,
  type WSMessage,
  WSMessageType,
} from '../util/signaling';
import {sendFlow} from '../util/sendFlow';

const WSS = REST_URL.replace('http', 'ws') + '/ws';

const DATA_CHANNEL_NAME = 'data';

const rtcConfig: RTCConfiguration = {
  iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
};

export const useWebRTC = () => {
  const [peer, setPeer] = useState<RTCPeerConnection | null>(null);
  const signaling = useRef<SignalingServer>(null);
  const [tx, setTx] = useState<RTCDataChannel | null>(null);
  const [rx, setRx] = useState<RTCDataChannel | null>(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [role, setRole] = useState<PeerRole | null>(null);
  const [_maxMsgSize, setMaxMsgSize] = useState(64_000);

  const connect = async (role: PeerRole, code: string) => {
    const options = {
      maxMsgSize: 64_000,
    };

    setRole(role);

    const s = await SignalingServer.connect(WSS);
    signaling.current = s;
    await s.auth(code, role);

    if (role === PeerRole.Send) {
      await s.waitFor(m => m.type === WSMessageType.Join);
    }

    const pc = new RTCPeerConnection(rtcConfig);
    setPeer(pc);

    const tx = pc.createDataChannel(DATA_CHANNEL_NAME, {
      ordered: true,
    });
    setTx(tx);

    let rx: RTCDataChannel;

    s.addEventListener('icecandidate', async _ev => {
      const ev = _ev as CustomEvent<RTCIceCandidateInit>;
      try {
        await pc.addIceCandidate(ev.detail);
        console.log('added ice candidate', ev.detail);
      } catch (err) {
        console.error('Error adding ice candidate', err);
      }
    });

    pc.addEventListener('icecandidate', event => {
      if (event.candidate) {
        s.send({type: WSMessageType.ICECandidate, data: event.candidate});
      }
    });

    const [recvRx, _setRecvRx] = defer();
    pc.addEventListener('datachannel', event => {
      if (event.channel.label === DATA_CHANNEL_NAME) {
        rx = event.channel;
        setRx(rx);
        _setRecvRx();
      }
    });

    const [connected, _setConnected] = defer();
    pc.addEventListener('connectionstatechange', event => {
      setConnectionState(pc.connectionState);

      console.log('connectionstatechange', pc.connectionState, event);
      if (pc.connectionState === 'connected') {
        console.log('Peer connected');

        const re = /^a=max-message-size:(\d+)$/m;
        const localMax = pc.localDescription?.sdp.match(re)?.[1];
        const remoteMax = pc.remoteDescription?.sdp.match(re)?.[1];

        let maxMessageSize = Math.min(Number(localMax), Number(remoteMax));

        if (!localMax || !remoteMax) {
          console.error("Couldn't negotiate max-message-size", {
            localMax,
            remoteMax,
            local: pc.localDescription?.sdp,
            remote: pc.remoteDescription?.sdp,
          });
          maxMessageSize = 64_000;
        }

        options.maxMsgSize = maxMessageSize;
        setMaxMsgSize(maxMessageSize);

        console.log('max message size:', maxMessageSize);

        s.close();
        _setConnected();
      }

      // TODO: how do I do reconnects?
    });

    if (role === PeerRole.Send) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      s.send({type: WSMessageType.Offer, data: offer});

      s.waitFor(m => m.type === WSMessageType.Answer).then(ans => {
        console.log('got answer', ans);
        pc.setRemoteDescription(ans.data as RTCSessionDescriptionInit);
      });
    } else {
      const {data: offer} = (await s.waitFor(
        m => m.type === WSMessageType.Offer
      )) as Extract<WSMessage, {type: WSMessageType.Offer}>;
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      s.send({type: WSMessageType.Answer, data: answer});
    }

    await Promise.all([connected, recvRx]);
    console.log('peers are connected!', options);

    return {pc, tx, rx: rx!, options};
  };

  const sendFile = async (file: File, code: string) => {
    if (role === PeerRole.Recv) {
      throw new Error('cannot send as a receiver');
    }

    const {
      tx,
      options: {maxMsgSize},
    } = await connect(PeerRole.Send, code);

    const chunkSize = maxMsgSize;
    const chunks = Math.ceil(file.size / chunkSize);
    // let offset = startIndex * chunkSize;
    let offset = 0;

    console.log({chunkSize, chunks, size: file.size});

    tx.send(
      JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type,
        chunks,
      })
    );

    // TODO: should there be in intermediate step here where the recvr accepts the file before it sends? this could also be used to resuume/send partial files

    for await (const _ of sendFlow(tx, chunkSize * 4)) {
      if (offset >= file.size) {
        break;
      }

      const data = file.slice(offset, offset + chunkSize);
      offset += data.size;

      tx.send(data);
    }
  };

  const recvFile = async (code: string) => {
    if (role === PeerRole.Send) {
      throw new Error('cannot recv as a sender');
    }

    const {rx} = await connect(PeerRole.Recv, code);

    let gotHeader = false;
    let header: {name: string; chunks: number; size: number; type: string};
    let chunksRecv = 0;
    const parts: Blob[] = [];

    const [file, doneFile] = defer<File>();

    rx.addEventListener('message', async event => {
      console.log('got a message:', event.data);

      if (!gotHeader) {
        gotHeader = true;
        const m = JSON.parse(event.data);
        header = m;
        console.log('header:', header);

        return;
      }

      chunksRecv++;
      console.log('Got chunk', chunksRecv);
      parts.push(event.data);

      if (header && chunksRecv === header.chunks) {
        console.log('got all chunks');

        const file = new File(parts, header.name, {type: header.type});
        doneFile(file);
      }
    });

    return file;
  };

  return {
    peer,
    signaling: signaling.current,
    tx,
    rx,
    connectionState,

    connect,
    sendFile,
    recvFile,
  };
};
