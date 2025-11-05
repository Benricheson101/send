import {type FC, useState, type ChangeEventHandler} from 'react';

import {createTicket} from './util/rest';
import {useWebRTC} from './hooks/useWebRTC';

const App: FC = () => {
  const rtc = useWebRTC();

  const [code, setCode] = useState('');

  const uploadImage: ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }

    // TODO: should this be moved into connect?
    const code = await createTicket();
    setCode(code);
    rtc.sendFile(file, code);
  };

  const onSubmit = async (form: FormData) => {
    const code = form.get('code')!.toString();
    setCode(code);

    const file = await rtc.recvFile(code);
    const url = URL.createObjectURL(file);

    const e = document.createElement('a');
    e.download = file.name;
    e.href = url;
    e.click();
  };

  return (
    <>
      <p>peer connected: {rtc.connectionState}</p>
      <p>tx: {rtc.tx?.readyState || 'not available'}</p>
      <p>rx: {rtc.rx?.readyState || 'not available'}</p>
      <p>code: {code}</p>

      {rtc.connectionState !== 'connected' ? (
        <div>
          <input type='file' onChange={uploadImage} />
          <form action={onSubmit}>
            <input type='text' name='code' />
            <button type='submit'>Connect</button>
          </form>
        </div>
      ) : (
        <>
          <p>connected</p>
        </>
      )}
    </>
  );
};

export default App;
