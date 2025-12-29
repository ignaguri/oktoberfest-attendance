import { cn } from "@/lib/utils";

const sizeMap = {
  16: "size-4",
  24: "size-6",
  32: "size-8",
  48: "size-12",
  64: "size-16",
};

interface LoadingSpinnerProps {
  size?: keyof typeof sizeMap;
}

export default function LoadingSpinner({ size = 32 }: LoadingSpinnerProps) {
  const sizeClass = sizeMap[size];

  return (
    <div className="grid min-h-[140px] w-full place-items-center overflow-x-scroll rounded-lg p-6 lg:overflow-visible">
      <div
        className={cn(
          "animate-spin rounded-full border-4 border-t-transparent",
          sizeClass,
        )}
      ></div>
    </div>
  );
}
