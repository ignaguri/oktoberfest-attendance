"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useTranslation } from "@/lib/i18n/client";

export default function JoinGroupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      router.push("/groups");
      return;
    }

    // Redirect to the API route which handles all the logic
    router.push(`/api/join-group?token=${token}`);
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size={32} />
        <p className="text-gray-600">{t("joinGroup.processing")}</p>
      </div>
    </div>
  );
}
