import {type FC, useEffect, useState} from 'react';

type Props = {
  tx: RTCDataChannel;
  rx: RTCDataChannel;
};

export const Channel: FC<Props> = ({tx, rx}) => {
  const [msgs, setMsgs] = useState<{msg: string; id: number}[]>([]);

  useEffect(() => {
    let msgID = 0;

    const onMsg = (msg: RTCDataChannelEventMap['message']) => {
      console.log('got a message:', msg.data);
      setMsgs(m => [...m, {id: msgID++, msg: msg.data}]);
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
      <form action={send}>
        <input type='text' name='msg' />
        <button type='submit'>Submit</button>
      </form>
    </div>
  );
};
