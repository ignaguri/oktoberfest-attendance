import { createPrivateKey, sign } from "node:crypto";
import { connect, constants } from "node:http2";

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  privateKey: string;
  bundleId: string;
}

export type ApnsEnvironment = "sandbox" | "production";

export interface ApnsSendResult {
  status: number;
  reason: string | null;
}

export type ApnsTransport = (args: {
  host: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<ApnsSendResult>;

// APNs rejects tokens older than an hour and throttles re-signing faster than every 20 minutes.
const JWT_TTL_MS = 50 * 60 * 1000;

export function readApnsConfig(env: NodeJS.ProcessEnv = process.env): ApnsConfig | null {
  const keyId = env.APNS_KEY_ID;
  const teamId = env.APNS_TEAM_ID;
  const privateKey = env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !privateKey) {
    return null;
  }
  // Vercel env values keep the .p8's newlines as literal "\n".
  return { keyId, teamId, privateKey: privateKey.replace(/\\n/g, "\n"), bundleId: "com.prostcounter.app" };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function createApnsJwt(config: ApnsConfig, nowMs: number): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64url(JSON.stringify({ iss: config.teamId, iat: Math.floor(nowMs / 1000) }));
  const signingInput = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}

const APNS_TIMEOUT_MS = 10_000;

export function sendHttp2(
  { host, path, headers, body }: Parameters<ApnsTransport>[0],
  options: { origin?: string; timeoutMs?: number } = {},
): Promise<ApnsSendResult> {
  return new Promise((resolve, reject) => {
    const client = connect(options.origin ?? `https://${host}`);
    let settled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const succeed = (result: ApnsSendResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timerId);
      client.close();
      resolve(result);
    };
    const fail = (cause: string) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timerId);
      client.destroy();
      reject(new Error(`APNs request failed: ${cause}`));
    };

    timerId = setTimeout(() => fail("timeout"), options.timeoutMs ?? APNS_TIMEOUT_MS);
    client.on("error", (error) => fail(error.message));

    const request = client.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: path,
      ...headers,
    });
    let status = 0;
    let responseBody = "";
    request.setEncoding("utf8");
    request.on("response", (responseHeaders) => {
      status = Number(responseHeaders[constants.HTTP2_HEADER_STATUS]);
    });
    request.on("data", (chunk: string) => {
      responseBody += chunk;
    });
    request.on("end", () => {
      let reason: string | null = null;
      if (responseBody) {
        try {
          reason = (JSON.parse(responseBody) as { reason?: string }).reason ?? null;
        } catch {
          reason = null;
        }
      }
      succeed({ status, reason });
    });
    request.on("error", (error) => fail(error.message));
    request.on("close", () => fail("stream closed before a response"));
    request.end(body);
  });
}

export const http2Transport: ApnsTransport = (args) => sendHttp2(args);

export class ApnsClient {
  private cachedJwt: { token: string; createdAt: number } | null = null;

  constructor(
    private config: ApnsConfig,
    private transport: ApnsTransport = http2Transport,
    private now: () => number = () => Date.now(),
  ) {}

  private jwt(): string {
    const now = this.now();
    if (!this.cachedJwt || now - this.cachedJwt.createdAt >= JWT_TTL_MS) {
      this.cachedJwt = { token: createApnsJwt(this.config, now), createdAt: now };
    }
    return this.cachedJwt.token;
  }

  async sendLiveActivity(args: {
    token: string;
    environment: ApnsEnvironment;
    payload: unknown;
  }): Promise<ApnsSendResult> {
    const host = args.environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    return this.transport({
      host,
      path: `/3/device/${encodeURIComponent(args.token)}`,
      headers: {
        authorization: `bearer ${this.jwt()}`,
        "apns-push-type": "liveactivity",
        "apns-topic": `${this.config.bundleId}.push-type.liveactivity`,
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify(args.payload),
    });
  }
}

export function isDeadApnsToken(result: ApnsSendResult): boolean {
  if (result.status === 410) {
    return true;
  }
  return result.status === 400 && (result.reason === "BadDeviceToken" || result.reason === "DeviceTokenNotForTopic");
}
