import { headers } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";

const APP_STORE_URL = "https://apps.apple.com/de/app/prostcounter/id6758376527";
// TODO: Replace with actual Play Store URL when Android app is published
const PLAY_STORE_URL = "";

export default async function DownloadPage() {
  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";

  if (/iPad|iPhone|iPod/.test(ua)) {
    redirect(APP_STORE_URL);
  }

  if (/Android/.test(ua)) {
    redirect(PLAY_STORE_URL || "/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <span className="text-6xl">🍺</span>
          <h1 className="text-3xl font-bold tracking-tight">ProstCounter</h1>
          <p className="text-center text-gray-500">
            Track your Oktoberfest attendance and compete with friends.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-xl bg-amber-500 px-6 py-3 text-center text-base font-semibold text-white shadow transition hover:bg-amber-600 active:bg-amber-700"
          >
            Download on the App Store
          </a>

          <div className="flex flex-col items-center gap-2">
            <Image
              src="/images/qrcode.svg"
              alt="QR Code"
              width={200}
              height={200}
            />
            <p className="text-center text-xs text-gray-400">
              Scan to open on your iPhone
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400">
          Coming soon on Android
        </p>
      </div>
    </div>
  );
}
