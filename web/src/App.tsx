import {Channel} from './components/Channel';
import {CodeInput} from './components/CodeInput';
import {useWebRTC} from './providers/WebRTC';

// const REST_URL = 'http://127.0.0.1:8000/api'

function App() {
  const rtc = useWebRTC();

  const tf = (a: unknown) => (!!a).toString();

  // const startCall = async () => {
  //   const ticket = await fetch(REST_URL + '/tickets', {
  //     method: 'POST',
  //   }).then(r => r.json());
  //
  //   console.log(ticket);
  //   const code: string = ticket.code;
  //
  //   await rtc.connect(code);
  // };

  const startCall = () => {
    rtc.call();
  };

  return (
    <>
      <p>ws connected: {tf(rtc.ws?.readyState ===  rtc.ws?.OPEN)}</p>
      <p>peer connected: {tf(rtc.isConnected)}</p>
      <p>tx: {tf(rtc.dataChannels.tx)}</p>
      <p>rx: {tf(rtc.dataChannels.rx)}</p>
      <p>code: {rtc.code}</p>

      {rtc.isConnected && rtc.dataChannels.tx && rtc.dataChannels.rx ? (
        <Channel tx={rtc.dataChannels.tx} rx={rtc.dataChannels.rx} />
      ) : (
        rtc.code === null && (
          <>
            <button type='button' onClick={startCall}>
              Make Call
            </button>
            <CodeInput />
          </>
        )
      )}
    </>
  );
}

export default App;
