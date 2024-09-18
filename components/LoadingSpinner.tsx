import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: number;
}

const sizeMap = {
  16: "w-4 h-4",
  24: "w-6 h-6",
  32: "w-8 h-8",
  48: "w-12 h-12",
  64: "w-16 h-16",
};

export default function LoadingSpinner({ size = 32 }: LoadingSpinnerProps) {
  const sizeClass = sizeMap[size as keyof typeof sizeMap];

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
