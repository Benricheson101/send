import type {FC} from 'react';

import {useWebRTC} from '../providers/WebRTC';

export const CodeInput: FC = () => {
  const rtc = useWebRTC();

  const onSubmit = (form: FormData) => {
    const code = form.get('code')!.toString();
    rtc.auth(code);
    // rtc.connect(code);
  };

  return (
    <form action={onSubmit}>
      <input type='text' name='code' />
      <button type='submit'>Connect</button>
    </form>
  );
};
