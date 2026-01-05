"use client";

import {
  WrappedContainer,
  WrappedError,
} from "@/components/wrapped/core/WrappedContainer";
import { useFestival } from "@/contexts/FestivalContext";
import { useWrappedAccess, useWrappedData } from "@/hooks/useWrapped";

export default function WrappedPage() {
  const { currentFestival } = useFestival();
  const festivalId = currentFestival?.id;

  // Use direct Supabase call for wrapped data (preserves DB format for slides)
  const { data: wrappedData, loading: wrappedLoading } =
    useWrappedData(festivalId);
  const { data: accessResult, loading: accessLoading } =
    useWrappedAccess(festivalId);

  // Loading state
  if (wrappedLoading || accessLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🍺</div>
          <p className="text-gray-600">Loading your wrapped...</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (accessResult && !accessResult.allowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Wrapped Not Available
          </h2>
          <p className="text-gray-600 mb-6">{accessResult.message}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!wrappedData) {
    return <WrappedError message="Failed to load your wrapped" />;
  }

  // Success - show wrapped
  return <WrappedContainer data={wrappedData} />;
}
