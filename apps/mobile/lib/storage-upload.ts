import { safeHost } from "@prostcounter/shared/utils";

import { Sentry } from "@/lib/sentry";

export type UploadFlow = "beer-picture-upload" | "avatar-upload";

interface PutToStorageArgs {
  url: string;
  body: ArrayBuffer;
  mimeType: string;
  /** Client-configured Supabase URL — logged alongside the actual upload host so
   *  a "wrong URL in the build" mismatch jumps out at a glance in Sentry. */
  envSupabaseUrl: string;
  flow: UploadFlow;
}

/**
 * PUT a blob to a signed Supabase-storage URL and report failures to Sentry
 * with enough context (status, body snippet, upload host, env host, mime type,
 * size) to diagnose "why did it fail" from the event alone.
 */
export async function putToStorageWithDiagnostics({
  url,
  body,
  mimeType,
  envSupabaseUrl,
  flow,
}: PutToStorageArgs): Promise<void> {
  const extra = {
    uploadHost: safeHost(url),
    envSupabaseHost: safeHost(envSupabaseUrl),
    mimeType,
    fileSize: body.byteLength,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body,
    });
  } catch (networkErr) {
    // No response at all (DNS, TLS, timeout). The host pair is the single
    // most useful field here — captures "wrong URL in the build" cases.
    Sentry.captureException(networkErr, {
      tags: { flow },
      extra: { stage: "network", ...extra },
    });
    throw networkErr;
  }

  if (!response.ok) {
    const bodySnippet = await response.text().catch(() => "<no body>");
    Sentry.captureMessage("Storage PUT failed", {
      level: "error",
      tags: { flow },
      extra: {
        stage: "http",
        status: response.status,
        statusText: response.statusText,
        body: bodySnippet.slice(0, 500),
        ...extra,
      },
    });
    throw new Error(
      `Storage upload failed (${response.status} on ${extra.uploadHost})`,
    );
  }
}
