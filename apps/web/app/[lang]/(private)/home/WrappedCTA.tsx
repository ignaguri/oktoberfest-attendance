"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useHighlights, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { getWrappedHomeState } from "@prostcounter/shared/utils";
import { motion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trans, useTranslation } from "@/lib/i18n/client";

/** Countdown over the festival's last days, the way into the Wrapped, then a compact pointer to the Profile */
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
  const teaser = !highlights
    ? null
    : highlights.totalDays === 0
      ? t("wrapped.cta.teaserEmpty")
      : t("wrapped.cta.teaser", {
          beers: t("wrapped.story.units.beers", { count: highlights.totalBeers }),
          days: t("wrapped.cta.days", { count: highlights.totalDays }),
        });

  if (state.kind === "countdown") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border border-yellow-300 bg-yellow-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 shrink-0 text-yellow-600" />
            <div className="min-w-0 text-left">
              <p className="text-base font-semibold text-gray-800">
                <Trans
                  t={t}
                  i18nKey="wrapped.cta.countdown"
                  count={state.daysUntilUnlock}
                  components={{ when: <span className="font-bold text-yellow-700" /> }}
                />
              </p>
              {teaser && <p className="text-sm text-gray-600">{teaser}</p>}
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (state.kind === "viewed") {
    return (
      <Link href="/profile" className="block">
        <Card className="border border-yellow-300 bg-yellow-50 px-4 py-3 transition-colors hover:bg-yellow-100">
          <div className="flex items-center gap-3 text-left">
            <Sparkles className="size-5 shrink-0 text-yellow-600" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-gray-800">
                {t("wrapped.cta.relive", { festivalName })}
              </p>
              <p className="text-sm text-gray-600">{t("wrapped.cta.reliveDescription")}</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-gray-400" />
          </div>
        </Card>
      </Link>
    );
  }

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
              <h3 className="text-xl font-bold text-gray-800">{t("wrapped.cta.ready")}</h3>
            </motion.div>

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
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
