"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFestivalConstants } from "@/lib/festivalConstants";
import { useFestival } from "@prostcounter/shared/contexts";
import { ExternalLink } from "lucide-react";
import { Link } from "next-view-transitions";

export default function MapButton() {
  const { currentFestival, isLoading } = useFestival();

  if (isLoading || !currentFestival) {
    return <Skeleton className="h-10 w-32 rounded" />;
  }

  const { festivalMapUrl, festivalName } =
    getFestivalConstants(currentFestival);

  // If no map URL, don't render the button
  if (!festivalMapUrl) {
    return null;
  }

  return (
    <Button asChild variant="outline">
      <Link href={festivalMapUrl} target="_blank">
        <span className="mr-1">{festivalName} Map</span>
        <ExternalLink size={20} />
      </Link>
    </Button>
  );
}
