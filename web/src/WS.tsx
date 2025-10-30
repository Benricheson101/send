import {useState, type FC} from 'react';
import {SignalingServer} from './util/signaling';
import {createTicket} from './util/rest';

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
