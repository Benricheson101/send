import {type WebSocket, WebSocketServer} from 'ws';

const wss = new WebSocketServer({port: 8080});

const clients: WebSocket[] = [];

wss.on('connection', ws => {
  clients.push(ws);
  console.log(clients.length, 'clients connected');

  ws.on('error', console.error);
  ws.on('close', () => {
    clients.splice(clients.indexOf(ws), 1);
  });

  ws.on('message', data => {
    for (const client of clients) {
      if (client === ws) {
        continue;
      }

      client.send(data.toString());
    }
  });
});
