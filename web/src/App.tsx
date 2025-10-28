import {Channel} from './Channel';
import {useWebRTC} from './providers/WebRTC';

function App() {
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
