import {type FC, useEffect, useState} from 'react';

type Props = {
  tx: RTCDataChannel;
  rx: RTCDataChannel;
};

// function blobToDataUrl(blob) {
//   return new Promise(r => {let a=new FileReader(); a.onload=r; a.readAsDataURL(blob)}).then(e => e.target.result);
// }

// let dataUrl = await blobToDataUrl(blob);

const blobToDateURL = (b: Blob) =>
  new Promise(resolve => {
    const fr = new FileReader();
    fr.onload = resolve;
    fr.readAsDataURL(b);
  });

export const Channel: FC<Props> = ({tx, rx}) => {
  const [msgs, setMsgs] = useState<{msg: string; id: number}[]>([]);
  const [sentFile, setSentFile] = useState<string | null>(null);

  useEffect(() => {
    const msgID = 0;

    let gotFirstMsg = false;
    const parts: Blob[] = [];

    let chunksRecv = 0;

    let header: {filename: string; chunks: number; size: number; type: string};

    const onMsg = async (msg: RTCDataChannelEventMap['message']) => {
      console.log('got a message:', msg.data);
      // setMsgs(m => [...m, {id: msgID++, msg: msg.data}]);

      if (!gotFirstMsg) {
        gotFirstMsg = true;
        const m = JSON.parse(msg.data);
        header = m;
        console.log('header', m);

        // const handle = await window.showSaveFilePicker();
        return;
      }

      parts.push((msg.data as Blob).slice(0, msg.data.size, header.type));
      chunksRecv++;

      if (header && chunksRecv === header.chunks) {
        console.log('got all chunks!');
        const file = new Blob(parts, {type: header.type});
        // const dataURL = await blobToDateURL(file).then(e => e.target.result);

        const url = URL.createObjectURL(file);
        setSentFile(url);

        // setSentFile(dataURL);
      }
    };

    rx.addEventListener('message', onMsg);

    return () => {
      rx.removeEventListener('message', onMsg);
    };
  }, [rx]);

  const send = (form: FormData) => {
    console.log(form);
    const msg = form.get('msg')!.toString();
    tx.send(msg);
  };

  return (
    <div>
      <ul>{...msgs.map(m => <li key={m.id}>{m.msg}</li>)}</ul>
      {/* <form action={send}> */}
      {/*   <input type='text' name='msg' /> */}
      {/*   <button type='submit'>Submit</button> */}
      {/* </form> */}
      {/* {sentFile && <image src={sentFile} />} */}
      {sentFile && <a href={sentFile}>Click to download file</a>}
    </div>
  );
};
