"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useHighlights, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { getWrappedHomeState } from "@prostcounter/shared/utils";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";

/** Countdown over the festival's last days, then the way into the Wrapped until it's viewed */
export function WrappedCTA() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { data: festivals, loading } = useWrappedFestivals();
  const { data: highlights } = useHighlights(currentFestival?.id);

  if (loading || !currentFestival) {
    return null;
  }

  const state = getWrappedHomeState(currentFestival, new Date(), festivals ?? undefined);
  if (!state) {
    return null;
  }

  const festivalName = currentFestival.name;
  const heading =
    state.kind === "ready"
      ? t("wrapped.cta.ready")
      : t("wrapped.cta.countdown", { count: state.daysUntilUnlock });
  const teaser = !highlights
    ? null
    : highlights.totalDays === 0
      ? t("wrapped.cta.teaserEmpty")
      : t("wrapped.cta.teaser", {
          beers: t("wrapped.story.units.beers", { count: highlights.totalBeers }),
          days: t("wrapped.cta.days", { count: highlights.totalDays }),
        });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 p-2 shadow-lg">
        <CardContent>
          <div className="flex flex-col items-center gap-4 text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.1, 1, 1.1, 1] }}
              transition={{ duration: 2, repeat: 3, repeatDelay: 3 }}
            >
              <h3 className="text-xl font-bold text-gray-800">{heading}</h3>
            </motion.div>

            {state.kind === "ready" ? (
              <>
                <p className="text-sm text-gray-600">
                  {t("wrapped.cta.readyDescription", { festivalName })}
                </p>
                <Button
                  asChild
                  size="lg"
                  className="bg-yellow-500 font-semibold text-white shadow-md transition-all hover:bg-yellow-600 hover:shadow-lg"
                >
                  <Link href={`/wrapped?festivalId=${currentFestival.id}`}>
                    <Sparkles className="mr-2 size-5" />
                    {t("wrapped.cta.viewButton")}
                  </Link>
                </Button>
                <p className="text-xs text-gray-500">{t("home.wrappedReady.footer")}</p>
              </>
            ) : (
              teaser && <p className="text-sm text-gray-600">{teaser}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
