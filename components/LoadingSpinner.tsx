import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  color?: "gray" | "blue" | "red";
  size?: number;
}

const colorPairs = {
  gray: {
    static: "text-gray-900/50",
    dynamic: "text-gray-900",
  },
  blue: {
    static: "text-blue-500/50",
    dynamic: "text-blue-500",
  },
  red: {
    static: "text-red-500/50",
    dynamic: "text-red-500",
  },
};

export default function LoadingSpinner({
  color = "gray",
  size = 64,
}: LoadingSpinnerProps) {
  const colors = colorPairs[color];

  return (
    <div className="grid min-h-[140px] w-full place-items-center overflow-x-scroll rounded-lg p-6 lg:overflow-visible">
      <div
        className={cn(
          "animate-spin rounded-full border-4 border-t-transparent",
          colors.dynamic,
          `w-${size / 4} h-${size / 4}`,
        )}
      ></div>
    </div>
  );
}
