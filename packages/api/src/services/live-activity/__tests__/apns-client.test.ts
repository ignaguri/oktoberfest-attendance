import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  ApnsClient,
  type ApnsConfig,
  type ApnsTransport,
  createApnsJwt,
  isDeadApnsToken,
  readApnsConfig,
} from "../apns-client";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const config: ApnsConfig = {
  keyId: "KEY123",
  teamId: "TEAM456",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  bundleId: "com.prostcounter.app",
};

describe("createApnsJwt", () => {
  it("signs an ES256 token APNs can verify", () => {
    const jwt = createApnsJwt(config, 1_700_000_000_000);
    const [header, payload, signature] = jwt.split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "KEY123",
    });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      iss: "TEAM456",
      iat: 1_700_000_000,
    });
    const valid = verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    );
    expect(valid).toBe(true);
  });
});

describe("ApnsClient", () => {
  it("sends a liveactivity push to the right host with the right headers", async () => {
    const transport = vi.fn<ApnsTransport>().mockResolvedValue({ status: 200, reason: null });
    const client = new ApnsClient(config, transport, () => 1_700_000_000_000);

    await client.sendLiveActivity({ token: "devtoken", environment: "sandbox", payload: { aps: {} } });

    const call = transport.mock.calls[0][0];
    expect(call.host).toBe("api.sandbox.push.apple.com");
    expect(call.path).toBe("/3/device/devtoken");
    expect(call.headers["apns-push-type"]).toBe("liveactivity");
    expect(call.headers["apns-topic"]).toBe("com.prostcounter.app.push-type.liveactivity");
    expect(call.headers["apns-priority"]).toBe("10");
    expect(call.headers.authorization.startsWith("bearer ")).toBe(true);
    expect(call.body).toBe(JSON.stringify({ aps: {} }));
  });

  it("encodes the token in the request path", async () => {
    const transport = vi.fn<ApnsTransport>().mockResolvedValue({ status: 200, reason: null });
    const client = new ApnsClient(config, transport, () => 1_700_000_000_000);

    await client.sendLiveActivity({ token: "a/../b?c", environment: "production", payload: {} });

    expect(transport.mock.calls[0][0].path).toBe("/3/device/a%2F..%2Fb%3Fc");
  });

  it("uses the production host for production tokens", async () => {
    const transport = vi.fn<ApnsTransport>().mockResolvedValue({ status: 200, reason: null });
    const client = new ApnsClient(config, transport, () => 1_700_000_000_000);

    await client.sendLiveActivity({ token: "t", environment: "production", payload: {} });

    expect(transport.mock.calls[0][0].host).toBe("api.push.apple.com");
  });

  it("reuses the JWT for 50 minutes and then signs a new one", async () => {
    let now = 1_700_000_000_000;
    const transport = vi.fn<ApnsTransport>().mockResolvedValue({ status: 200, reason: null });
    const client = new ApnsClient(config, transport, () => now);

    await client.sendLiveActivity({ token: "t", environment: "production", payload: {} });
    now += 49 * 60 * 1000;
    await client.sendLiveActivity({ token: "t", environment: "production", payload: {} });
    now += 2 * 60 * 1000;
    await client.sendLiveActivity({ token: "t", environment: "production", payload: {} });

    const auth = transport.mock.calls.map((call) => call[0].headers.authorization);
    expect(auth[0]).toBe(auth[1]);
    expect(auth[2]).not.toBe(auth[1]);
  });
});

describe("isDeadApnsToken", () => {
  it("treats 410 and bad-token 400s as dead", () => {
    expect(isDeadApnsToken({ status: 410, reason: "Unregistered" })).toBe(true);
    expect(isDeadApnsToken({ status: 400, reason: "BadDeviceToken" })).toBe(true);
    expect(isDeadApnsToken({ status: 400, reason: "DeviceTokenNotForTopic" })).toBe(true);
    expect(isDeadApnsToken({ status: 400, reason: "BadPriority" })).toBe(false);
    expect(isDeadApnsToken({ status: 500, reason: null })).toBe(false);
  });
});

describe("readApnsConfig", () => {
  it("returns null unless all three variables are set", () => {
    expect(readApnsConfig({ APNS_KEY_ID: "a", APNS_TEAM_ID: "b" })).toBeNull();
  });

  it("restores escaped newlines in the key", () => {
    const result = readApnsConfig({
      APNS_KEY_ID: "a",
      APNS_TEAM_ID: "b",
      APNS_PRIVATE_KEY: "line1\\nline2",
    });
    expect(result?.privateKey).toBe("line1\nline2");
    expect(result?.bundleId).toBe("com.prostcounter.app");
  });
});
