import {useState, type ChangeEventHandler, type FC} from 'react';
import {Channel} from './components/Channel';
import {CodeInput} from './components/CodeInput';
import {useWebRTC} from './providers/WebRTC';
import {establishConnection} from './util/send';
import { PeerRole } from './util/signaling';
import { createTicket } from './util/rest';

// const REST_URL = 'http://127.0.0.1:8000/api'

const App: FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [code, setCode] = useState('');

  const call = async () => {
    const code = await createTicket();
    setCode(code);

    const {pc, rx, tx} = await establishConnection(PeerRole.Send, code);
    setIsConnected(true);
  };

  const onSubmit = async (form: FormData) => {
    const code = form.get('code')!.toString();
    setCode(code);
    const {pc, rx, tx} = await establishConnection(PeerRole.Recv, code);
    setIsConnected(true);
  };

  return (
    <>
    <p>peer connected: {isConnected.toString()}</p>
    <p>code: {code}</p>
    {!isConnected
      ? (
          <div>
            <button onClick={call}>Make Call</button>
            <form action={onSubmit}>
              <input type="text" name='code' />
              <button type="submit">Connect</button>
            </form>
          </div>
        )
      : (<p>connected</p>)
    }
    </>
  );
};

// function App() {
//   const rtc = useWebRTC();
//
//   const tf = (a: unknown) => (!!a).toString();
//
//   // const startCall = async () => {
//   //   const ticket = await fetch(REST_URL + '/tickets', {
//   //     method: 'POST',
//   //   }).then(r => r.json());
//   //
//   //   console.log(ticket);
//   //   const code: string = ticket.code;
//   //
//   //   await rtc.connect(code);
//   // };
//
//   const startCall = async () => {
//     // rtc.call();
//
//     const {pc, tx, rx} = await establishConnection();
//   };
//
//   const uploadImage: ChangeEventHandler<HTMLInputElement> = event => {
//     const file = event.target?.files?.[0];
//     if (!file) {
//       return;
//     }
//
//     const nrChunks = Math.ceil(file.size / rtc.maxMsgSize);
//     console.log(file.name, file.size, nrChunks, rtc.maxMsgSize);
//
//     const chunkSize = rtc.maxMsgSize;
//     const chunks: [number, number][] = Array.from(
//       {length: nrChunks},
//       // (_, i) => [i * chunkSize, (i + 1) * chunkSize - 1]
//
//       (_, i) => [i * chunkSize, (i + 1) * chunkSize]
//     );
//
//     console.log(chunks);
//
//     // const blobChunks = chunks.map(c => file.slice(...c));
//     // console.log(blobChunks);
//
//     const sendChunk = () => {
//       if (!chunks.length) {
//         rtc.dataChannels.tx!.removeEventListener(
//           'bufferedamountlow',
//           sendChunks
//         );
//         return;
//       }
//
//       rtc.dataChannels.tx!.send(file!.slice(...chunks.shift()!, file.type));
//     };
//
//     function sendChunks() {
//       console.log('bufferedamountlow', event);
//       sendChunk();
//     }
//
//     rtc.dataChannels.tx?.addEventListener('bufferedamountlow', sendChunks);
//
//     rtc.dataChannels.tx!.send(
//       JSON.stringify({
//         filename: file.name,
//         size: file.size,
//         chunks: nrChunks,
//         type: file.type,
//       })
//     );
//   };
//
//   return (
//     <>
//       <p>ws connected: {tf(rtc.ws?.readyState === rtc.ws?.OPEN)}</p>
//       <p>peer connected: {tf(rtc.isConnected)}</p>
//       <p>tx: {rtc.dataChannels.tx?.readyState || 'not available'}</p>
//       <p>rx: {rtc.dataChannels.rx?.readyState || 'not available'}</p>
//       <p>code: {rtc.code}</p>
//
//       {rtc.isConnected && rtc.dataChannels.tx && rtc.dataChannels.rx ? (
//         <>
//           <Channel tx={rtc.dataChannels.tx} rx={rtc.dataChannels.rx} />
//           <input type='file' onChange={uploadImage} />
//         </>
//       ) : (
//         rtc.code === null && (
//           <>
//             <button type='button' onClick={startCall}>
//               Make Call
//             </button>
//             <CodeInput />
//           </>
//         )
//       )}
//     </>
//   );
// }

export default App;
