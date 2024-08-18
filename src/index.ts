import { FileSink, serve } from "bun";

const expectedPathname = "/" + crypto.randomUUID();

const server = serve<{ fileName: string; sink?: FileSink }>({
  hostname: "localhost",
  async fetch(request) {
    if (new URL(request.url).pathname !== expectedPathname) {
      return new Response("Not found", { status: 404 });
    }

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const now = new Date();
    const fileName = `screen-recording-${now
      .toISOString()
      .replace(/[:.]/g, "-")}.mkv`;
    const success = server.upgrade(request, {
      data: { fileName },
    });
    if (success) {
      // Bun automatically returns a 101 Switching Protocols
      // if the upgrade succeeds
      return undefined;
    }

    return new Response("Upgrade failed", { status: 400 });
  },
  websocket: {
    async open(ws) {
      ws.data.sink = Bun.file("out/" + ws.data.fileName).writer();
      console.log(`Opening: ${ws.data.fileName}`);
    },
    async message(ws, message) {
      ws.data.sink!.write(message);
    },
    async close(ws) {
      ws.data.sink!.end();
      console.log(`Closing: ${ws.data.fileName}`);
    },
  },
});

console.log(new URL(expectedPathname, server.url).href);
