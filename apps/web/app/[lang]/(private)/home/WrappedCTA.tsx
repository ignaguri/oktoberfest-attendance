"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useWrappedFestivals } from "@prostcounter/shared/hooks";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";

export function WrappedCTA({ isLastDayOfFestival }: { isLastDayOfFestival?: boolean }) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { data: festivals, loading } = useWrappedFestivals();

  if (loading || !currentFestival) {
    return null;
  }

  const isUnlocked = festivals?.some((festival) => festival.festivalId === currentFestival.id) ?? false;

  if (!isLastDayOfFestival && !isUnlocked) {
    return null;
  }

  const festivalName = currentFestival.name;

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
              <h3 className="text-xl font-bold text-gray-800">
                {isLastDayOfFestival ? t("wrapped.cta.preparing") : t("wrapped.cta.ready")}
              </h3>
            </motion.div>

            <p className="text-sm text-gray-600">
              {isLastDayOfFestival
                ? t("wrapped.cta.preparingDescription", { festivalName })
                : t("wrapped.cta.readyDescription", { festivalName })}
            </p>

            {!isLastDayOfFestival && (
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
            )}

            <p className="text-xs text-gray-500">
              {isLastDayOfFestival ? t("wrapped.cta.preparingFooter") : t("home.wrappedReady.footer")}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
