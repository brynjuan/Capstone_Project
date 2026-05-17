import { createHash } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.WS_PORT || 3001);
const clients = new Set();

const sendFrame = (socket, payload) => {
  const message = Buffer.from(payload);
  const header =
    message.length < 126
      ? Buffer.from([0x81, message.length])
      : Buffer.from([0x81, 126, message.length >> 8, message.length & 0xff]);

  socket.write(Buffer.concat([header, message]));
};

const broadcast = (event) => {
  const payload = JSON.stringify({
    event,
    at: new Date().toISOString(),
  });

  for (const client of clients) {
    if (!client.destroyed) {
      sendFrame(client, payload);
    }
  }
};

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, clients: clients.size }));
    return;
  }

  if (req.method === "POST" && req.url === "/notify") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const data = body ? JSON.parse(body) : {};
        broadcast(String(data.event || "visitor-updated"));
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, clients: clients.size }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false }));
      }
    });

    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];

  if (!key) {
    socket.destroy();
    return;
  }

  const accept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"),
  );

  clients.add(socket);
  sendFrame(socket, JSON.stringify({ event: "connected", at: new Date().toISOString() }));

  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
});

server.listen(port, () => {
  console.log(`WebSocket realtime server running on ws://localhost:${port}`);
});
