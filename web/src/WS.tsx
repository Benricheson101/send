import {type FC, useState} from 'react';

import {createTicket} from './util/rest';
import {SignalingServer} from './util/signaling';

export const WSTestPage: FC = () => {
  const [ss, setSS] = useState<SignalingServer | null>(null);

  const onClick = async () => {
    const s = await SignalingServer.connect('http://localhost:8000/api/ws');
    setSS(s);

    const ticket = await createTicket();

    await s.auth(ticket, 'send');
  };

  return (
    <>
      <button onClick={onClick}>Connect</button>
    </>
  );
};
