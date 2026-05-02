import Breadcrumbs from "@/components/Breadcrumbs/Breadcrumbs";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { OfflineBanner } from "@/components/OfflineBanner";

// Public pages (sign-in, sign-up, etc.) are dynamic due to auth checks
export const revalidate = 0;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center pb-2">
      <Navbar showUserMenu={false} />
      <OfflineBanner />
      <main className="flex w-full flex-1 shrink-0 flex-col items-center p-2 text-center sm:justify-start sm:px-20">
        <Breadcrumbs />
        {children}
      </main>
      <Footer isLoggedIn={false} />
    </div>
  );
}
