import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";

import SignIn from "@/components/Auth/SignIn";

export const metadata: Metadata = {
  alternates: {
    canonical: `${PROD_URL}/sign-in`,
  },
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return <SignIn />;
}
