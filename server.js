const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';
const startedAt = Date.now();
const rooms = new Map();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'winerland-game-server',
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      rooms: rooms.size,
      time: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && req.url === '/') {
    return json(res, 200, {
      name: 'WINERLAND',
      status: 'online',
      websocket: '/game',
      health: '/health',
    });
  }

  return json(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server, path: '/game' });

function broadcast(room, message, except) {
  for (const client of room.clients) {
    if (client !== except && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  }
}

function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = { clients: new Set(), players: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

wss.on('connection', (socket) => {
  let roomId = null;
  let playerId = null;

  socket.send(JSON.stringify({ type: 'connected', serverTime: Date.now() }));

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return socket.send(JSON.stringify({ type: 'error', code: 'INVALID_JSON' }));
    }

    if (message.type === 'join') {
      roomId = String(message.roomId || 'quickmatch').slice(0, 64);
      playerId = String(message.playerId || '').slice(0, 128);
      if (!playerId) {
        return socket.send(JSON.stringify({ type: 'error', code: 'PLAYER_ID_REQUIRED' }));
      }

      const room = getRoom(roomId);
      room.clients.add(socket);
      room.players.set(playerId, { ...message.player, id: playerId });

      socket.send(JSON.stringify({
        type: 'room_state',
        roomId,
        players: [...room.players.values()],
      }));
      broadcast(room, {
        type: 'player_joined',
        player: room.players.get(playerId),
      }, socket);
      return;
    }

    if (!roomId || !playerId) {
      return socket.send(JSON.stringify({ type: 'error', code: 'JOIN_REQUIRED' }));
    }

    const room = rooms.get(roomId);
    if (!room) return;

    if (message.type === 'state') {
      const previous = room.players.get(playerId) || { id: playerId };
      const next = {
        ...previous,
        ...message.player,
        id: playerId,
      };
      room.players.set(playerId, next);
      broadcast(room, { type: 'player_state', player: next }, socket);
      return;
    }

    if (message.type === 'event') {
      broadcast(room, {
        type: 'game_event',
        playerId,
        event: message.event,
        data: message.data,
        serverTime: Date.now(),
      }, socket);
    }
  });

  socket.on('close', () => {
    if (!roomId || !playerId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    room.clients.delete(socket);
    room.players.delete(playerId);
    broadcast(room, { type: 'player_left', playerId });

    if (room.clients.size === 0) rooms.delete(roomId);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`WINERLAND server listening on ${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
