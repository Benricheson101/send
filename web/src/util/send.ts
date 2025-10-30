import {defer} from '@benricheson101/util';
import {createTicket, REST_URL} from './rest';
import {
  PeerRole,
  SignalingServer,
  WSMessageType,
  type WSMessage,
} from './signaling';

const WSS = REST_URL.replace('http', 'ws') + '/ws';

const DATA_CHANNEL_NAME = 'data';

const rtcConfig: RTCConfiguration = {
  iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
};

export const establishConnection = async (role: PeerRole, code: string) => {
  const s = await SignalingServer.connect(WSS);
  await s.auth(code, role);

  if (role === PeerRole.Send) {
    await s.waitFor(m => m.type === WSMessageType.Join);
  }

  const pc = new RTCPeerConnection(rtcConfig);
  const tx = pc.createDataChannel(DATA_CHANNEL_NAME, {
    ordered: true,
  });
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
      _setRecvRx();
    }
  });

  const [connected, _setConnected] = defer();
  pc.addEventListener('connectionstatechange', event => {
    console.log('connectionstatechange', pc.connectionState, event);
    if (pc.connectionState === 'connected') {
      console.log('Peer connected');
      s.close();
      _setConnected();
    }
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

  return {
    pc,
    tx,
    rx: rx!,
  };
};
