import {type FC, useState, type ChangeEventHandler, useEffect} from 'react';

import {createTicket} from './util/rest';
import {PeerRole} from './util/signaling';
import {useWebRTC} from './hooks/useWebRTC';

const App: FC = () => {
  const rtc = useWebRTC();

  const [code, setCode] = useState('');
  const [url, setURL] = useState('');

  // const call = async () => {
  //   const code = await createTicket();
  //   setCode(code);
  //
  //   rtc.connect(PeerRole.Send, code);
  //   // rtc.sendFile(null!, code);
  // };

  const uploadImage: ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }

    const code = await createTicket();
    setCode(code);
    rtc.sendFile(file, code);
  };

  const onSubmit = async (form: FormData) => {
    const code = form.get('code')!.toString();
    setCode(code);

    // rtc.connect(PeerRole.Recv, code);
    const file = await rtc.recvFile(code);
    const url = URL.createObjectURL(file);
    // setURL(url);

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
    const e = document.createElement('a');
    e.download = file.name;
    e.href = url;
    e.click();
    // }
  };

  const tf = (a: unknown) => (a ? 'true' : 'false');

  // useEffect(() => {
  //   rtc.rx?.addEventListener('message', event => {
  //     console.log('got bessage')
  //   })
  // },[]);

  return (
    <>
      <p>peer connected: {rtc.connectionState}</p>
      <p>tx: {rtc.tx?.readyState || 'not available'}</p>
      <p>rx: {rtc.rx?.readyState || 'not available'}</p>
      <p>code: {code}</p>

      {rtc.connectionState !== 'connected' ? (
        <div>
          {/* <button onClick={clickCreateTicket}>Create Ticket</button> */}
          <input type='file' onChange={uploadImage} />
          <form action={onSubmit}>
            <input type='text' name='code' />
            <button type='submit'>Connect</button>
          </form>
        </div>
      ) : (
        <>
          <p>connected</p>
          {url && <a href={url}>Save file</a>}
        </>
      )}
    </>
  );
};

function AppOLD() {
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

  const startCall = async () => {
    // rtc.call();
    // const {pc, tx, rx} = await establishConnection();
  };

  const uploadImage: ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }

    const nrChunks = Math.ceil(file.size / rtc.maxMsgSize);
    console.log(file.name, file.size, nrChunks, rtc.maxMsgSize);

    const chunkSize = rtc.maxMsgSize;
    const chunks: [number, number][] = Array.from(
      {length: nrChunks},
      // (_, i) => [i * chunkSize, (i + 1) * chunkSize - 1]

      (_, i) => [i * chunkSize, (i + 1) * chunkSize]
    );

    console.log(chunks);

    // const blobChunks = chunks.map(c => file.slice(...c));
    // console.log(blobChunks);

    const sendChunk = () => {
      if (!chunks.length) {
        rtc.dataChannels.tx!.removeEventListener(
          'bufferedamountlow',
          sendChunks
        );
        return;
      }

      rtc.dataChannels.tx!.send(file!.slice(...chunks.shift()!, file.type));
    };

    function sendChunks() {
      console.log('bufferedamountlow', event);
      sendChunk();
    }

    rtc.dataChannels.tx?.addEventListener('bufferedamountlow', sendChunks);

    rtc.dataChannels.tx!.send(
      JSON.stringify({
        filename: file.name,
        size: file.size,
        chunks: nrChunks,
        type: file.type,
      })
    );
  };

  return (
    <>
      <p>ws connected: {tf(rtc.ws?.readyState === rtc.ws?.OPEN)}</p>
      <p>peer connected: {tf(rtc.isConnected)}</p>
      <p>tx: {rtc.dataChannels.tx?.readyState || 'not available'}</p>
      <p>rx: {rtc.dataChannels.rx?.readyState || 'not available'}</p>
      <p>code: {rtc.code}</p>

      {rtc.isConnected && rtc.dataChannels.tx && rtc.dataChannels.rx ? (
        <>
          <Channel tx={rtc.dataChannels.tx} rx={rtc.dataChannels.rx} />
          <input type='file' onChange={uploadImage} />
        </>
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
