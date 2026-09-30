import { MugLoader } from "@/components/ui/mug-loader";

export default function LoadingSpinner() {
  return (
    <div className="grid min-h-[140px] w-full place-items-center overflow-x-scroll rounded-lg p-6 lg:overflow-visible">
      <MugLoader />
    </div>
  );
}
