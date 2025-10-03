import {
  WrappedContainer,
  WrappedError,
} from "@/components/wrapped/core/WrappedContainer";
import { getWrappedData, canAccessWrapped } from "@/lib/actions/wrapped";

export default async function WrappedPage() {
  const [wrappedData, accessResult] = await Promise.all([
    getWrappedData(),
    canAccessWrapped(),
  ]);

  // Access denied
  if (!accessResult.allowed) {
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
