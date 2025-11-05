import {defer} from '@benricheson101/util';
import {useRef, useState} from 'react';

import {REST_URL} from '../util/rest';
import {
  PeerRole,
  SignalingServer,
  type WSMessage,
  WSMessageType,
} from '../util/signaling';

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
  const [maxMsgSize, setMaxMsgSize] = useState(64_000);

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

        const localMax = pc.localDescription?.sdp.match(
          /a=max-message-size:(\d+)/
        )?.[1];
        const remoteMax = pc.remoteDescription?.sdp.match(
          /a=max-message-size:(\d+)/
        )?.[1];

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
    console.log('peers are connected!');

    return {pc, tx, rx: rx!, options};
  };

  const sendFile = async (file: File, code: string) => {
    if (role === PeerRole.Recv) {
      throw new Error('cannot send as a receiver');
    }

    const {
      pc,
      tx,
      rx,
      options: {maxMsgSize},
    } = await connect(PeerRole.Send, code);

    const nrChunks = Math.ceil(file.size / maxMsgSize);
    const chunkSize = maxMsgSize;
    const chunks: [number, number][] = Array.from(
      {length: nrChunks},
      (_, i) => [i * chunkSize, (i + 1) * chunkSize]
    );

    const sendChunk = () => {
      if (!chunks.length) {
        console.log('all chunks sent!');
        return;
      }

      tx.send(file.slice(...chunks.shift()!, file.type));
    };

    tx.send(
      JSON.stringify({
        filename: file.name,
        size: file.size,
        chunks: nrChunks,
        type: file.type,
      })
    );

    // TODO: send chunks. saturate internal buffer

    for (let i = 0; i < nrChunks; i++) {
      console.log(`sending chunk ${i + 1}/${nrChunks}`, tx.bufferedAmount);
      sendChunk();
    }
  };

  const recvFile = async (code: string) => {
    if (role === PeerRole.Send) {
      throw new Error('cannot recv as a sender');
    }

    // const handle = window.showSaveFilePicker();

    const {
      pc,
      tx,
      rx,
      options: {maxMsgSize},
    } = await connect(PeerRole.Recv, code);

    let gotHeader = false;
    let header: {filename: string; chunks: number; size: number; type: string};
    let chunksRecv = 0;
    const parts: Blob[] = [];

    const [file, doneFile] = defer<File>();

    // try {
    //   // TODO: move this to recvfile?
    //   const picker = await window.showSaveFilePicker({
    //     startIn: 'downloads',
    //     suggestedName: file.name,
    //     types: [
    //       {
    //         accept: {[file.type]: file.name.slice(file.name.indexOf('.'))},
    //       },
    //     ],
    //   });
    //
    //   console.log({picker})
    //
    //   const writer: FileSystemWritableFileStream = await picker.createWritable();
    //
    //   await writer.write(file);
    //
    //   await writer.close();
    // } catch (err) {
    //   const e = document.createElement('a');
    //   e.download = file.name;
    //   e.href = url;
    //   e.click();
    // }

    let handle: Promise<FileSystemFileHandle | undefined>;
    let writer: FileSystemWritableFileStream | undefined;

    rx.addEventListener('message', async event => {
      console.log('got a message:', event.data);

      if (!gotHeader) {
        gotHeader = true;
        const m = JSON.parse(event.data);
        header = m;
        console.log('header:', header);

        // try {
        //     handle = window.showSaveFilePicker({
        //       startIn: 'downloads',
        //       suggestedName: header.filename,
        //       types: [
        //         {
        //           accept: {[header.type]: header.filename.slice(header.filename.indexOf('.'))},
        //         },
        //       ],
        //     });
        //
        //     writer = await (await handle)!.createWritable();
        //   } catch (err) {
        //     console.warn('browser does not support showSaveFilePicker. falling back to old thing', err);
        //     handle = Promise.resolve(undefined);
        //   }

        return;
      }

      // await handle;

      chunksRecv++;
      console.log('Got chunk', chunksRecv);

      // if (writer) {
      //   await writer.write(event.data);
      // } else {
      parts.push(event.data);
      // }

      if (header && chunksRecv === header.chunks) {
        console.log('got all chunks');

        // const file = new Blob(parts, {type: header.type});

        // if (writer) {
        //   await writer.close();
        //   doneFile();
        // } else {
        const file = new File(parts, header.filename, {type: header.type});
        doneFile(file);
        // }
        // pc.close();
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
