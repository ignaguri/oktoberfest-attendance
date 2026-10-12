import { createServer, type Http2Server } from "node:http2";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { sendHttp2 } from "../apns-client";

const request = { host: "unused", path: "/3/device/t", headers: {}, body: "{}" };
let server: Http2Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
});

async function listen(handler: Parameters<typeof createServer>[1]): Promise<string> {
  server = createServer(handler);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("sendHttp2", () => {
  it("rejects when the server never responds", async () => {
    const origin = await listen(() => {});

    await expect(sendHttp2(request, { origin, timeoutMs: 50 })).rejects.toThrow(/timeout/);
  });

  it("resolves status and reason from the response", async () => {
    const origin = await listen((_req, res) => {
      res.writeHead(410);
      res.end(JSON.stringify({ reason: "Unregistered" }));
    });

    await expect(sendHttp2(request, { origin, timeoutMs: 2000 })).resolves.toEqual({
      status: 410,
      reason: "Unregistered",
    });
  });
});
