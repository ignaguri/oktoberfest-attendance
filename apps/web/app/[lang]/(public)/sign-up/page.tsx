import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";

import SignUp from "@/components/Auth/SignUp";

export const metadata: Metadata = {
  alternates: {
    canonical: `${PROD_URL}/sign-up`,
  },
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return <SignUp />;
}
