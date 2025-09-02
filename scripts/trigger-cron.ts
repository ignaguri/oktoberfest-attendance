/*
  Helper to trigger the cron scheduler locally.
  Usage:
    CRON_SECRET=your-secret pnpm cron:trigger
  Optional args:
    --url http://localhost:3000 (defaults to localhost:3000)
*/

const args = process.argv.slice(2);
const urlArgIndex = args.indexOf("--url");
const baseUrl =
  urlArgIndex !== -1 && args[urlArgIndex + 1]
    ? args[urlArgIndex + 1]
    : "http://localhost:3000";

const cronSecret: string =
  process.env.CRON_SECRET ??
  (() => {
    throw new Error("CRON_SECRET env var is required");
  })();

async function main() {
  const endpoint = `${baseUrl}/api/cron/scheduler`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-cron-secret": cronSecret,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Request failed (${res.status}):`, text);
    process.exit(1);
  }
  console.log("OK:", text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
