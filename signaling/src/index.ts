// import './coordination';

import {randomInt, randomUUID} from 'node:crypto';
import {createServer} from 'node:http';

import fmw from 'find-my-way';
import {WebSocket, WebSocketServer} from 'ws';
import {error} from 'node:console';

const router = fmw();
const wss = new WebSocketServer({noServer: true});

// const tickets = new Map<string, {clients: WebSocket[]}>();
// const tickets = new Map<string, {send?: WebSocket; recv?: WebSocket}>();

// const sessions = new Map<string, string>();

const unclaimedTickets = new Set();

router.post('/tickets', (req, res) => {
  const code = ('000000' + randomInt(1e6).toString()).slice(-6);
  // tickets.set(code, {});
  unclaimedTickets.add(code);

  res
    .writeHead(200, {
      'content-type': 'application/json',
    })
    .end(JSON.stringify({code}));
});

const server = createServer((req, res) => {
  router.lookup(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const {pathname} = new URL(req.url!, 'wss://base.url');

  if (pathname !== '/ws') {
    console.error('tried to upgrade a path that isnt /ws');
    // TODO: how do i write a 400 or something
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws, req) => {
    wss.emit('connection', ws, req);
  });
});

type WSMessage<Type extends string, Data> = {type: Type; data: Data};

// TODO: make a state machine?
type WSMessageInbound =
  | WSMessage<'auth', {code: string; role: 'send' | 'recv'}>
  | WSMessage<'offer', unknown>
  | WSMessage<'answer', unknown>
  | WSMessage<'icecandidate', unknown>
  | WSMessage<'join', null>

type WSMessageOutbound = WSMessage<'auth', null> | WSMessageInbound;

// const clients: WebSocket[] = [];
const clients = new Map<WebSocket, string | null>();
const tickets = new Map<string, {send: WebSocket; recv?: WebSocket}>();
wss.on('connection', ws => {
  const send = <T extends WSMessageOutbound>(
    type: T['type'],
    data?: T['data'] extends null ? undefined : T['data'],
    socket = ws,
  ) => socket.send(JSON.stringify({type, data}));

  clients.set(ws, null);
  console.log(clients.size, 'clients connected');

  ws.on('error', console.error);
  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('message', data => {
    const msg: WSMessageInbound = JSON.parse(data.toString());
    console.log(clients.get(ws), msg);

    const code = clients.get(ws);
    if (code === null && msg.type !== 'auth') {
      console.error('Client is not authed!');
      ws.close();

      return;
    }

    switch (msg.type) {
      case 'auth': {
        const code = msg.data.code;

        if (clients.get(ws) !== null) {
          console.error('Client tried to re-auth with code', code);
          ws.close();
          return;
        }

        if (!code) {
          console.error('Code is empty');
          ws.close();
          return;
        }

        if (unclaimedTickets.has(code)) {
          unclaimedTickets.delete(code);
          tickets.set(code, {send: ws});
          clients.set(ws, code);
          send('auth');
          return;
        }

        const ticket = tickets.get(code);
        if (!ticket) {
          throw new Error('?');
        }

        if (ticket?.recv) {
          console.error('Code already used');
          ws.close();
          return;
        }

        ticket.recv = ws;
        clients.set(ws, code);
        send('auth');
        send('join', null, ticket.send);

        return;
      }

      case 'offer':
      case 'answer':
      case 'icecandidate': {
        if (!code) {
          console.error('Invalid code for client');
          ws.close();
          return;
        }

        const ticket = tickets.get(code);
        if (!ticket) {
          console.error('Code not found');
          ws.close();
          return;
        }

        const sendTo = ws === ticket.send ? ticket.recv : ticket.send;
        if (!sendTo) {
          console.error('Receiver is not connected');
          return;
        }

        send(msg.type, msg.data, sendTo);

        // for (const [client, _code] of clients) {
        //   if (client === ws) {
        //     continue;
        //   }
        //
        //   client.send(data.toString());
        // }

        return;
      }

      default: {
        console.warn('Invalid `type`:', msg.type);
        return;
      }
    }
  });
});

server.listen(8080, () => {
  console.log('server listening');
});
