"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function JoinGroupPage() {
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
    <div className="min-h-screen flex items-start justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size={32} />
        <p className="text-gray-600">Processing your invitation...</p>
      </div>
    </div>
  );
}
