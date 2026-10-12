export interface ExpoPushResult {
  ok: boolean;
  deviceNotRegistered: boolean;
  /** Expo's error code (e.g. InvalidCredentials), for the log. */
  error?: string;
}

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Same budget as APNs: a hung push would keep the waitUntil function alive.
const EXPO_TIMEOUT_MS = 10_000;

/** A silent data message that wakes the app's Android background task. */
export async function sendExpoDataPush(
  token: string,
  data: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  accessToken: string | undefined = process.env.EXPO_ACCESS_TOKEN,
): Promise<ExpoPushResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchImpl(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify([{ to: token, data, priority: "high", _contentAvailable: true }]),
    signal: AbortSignal.timeout(EXPO_TIMEOUT_MS),
  });
  if (!response.ok) {
    return { ok: false, deviceNotRegistered: false, error: `HTTP ${response.status}` };
  }

  const json = (await response.json()) as { data?: ExpoTicket[] };
  const ticket = json.data?.[0];
  return {
    ok: ticket?.status === "ok",
    deviceNotRegistered: ticket?.details?.error === "DeviceNotRegistered",
    error: ticket?.details?.error,
  };
}
