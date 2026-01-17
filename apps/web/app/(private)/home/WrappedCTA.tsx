"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWrappedAccess } from "@/hooks/useWrapped";

export function WrappedCTA({
  isLastDayOfFestival,
}: {
  isLastDayOfFestival?: boolean;
}) {
  const { currentFestival } = useFestival();
  const { data: accessResult, loading } = useWrappedAccess(currentFestival?.id);

  // Don't show if loading or no current festival
  if (loading || !currentFestival) {
    return null;
  }

  // Don't show if not last day and access not allowed
  if (!isLastDayOfFestival && (!accessResult || !accessResult.allowed)) {
    return null;
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
              animate={{
                rotate: [0, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: 3,
                repeatDelay: 3,
              }}
            >
              <h3 className="text-xl font-bold text-gray-800">
                {isLastDayOfFestival
                  ? "Wrapping up your festival!"
                  : "Your Wrapped is ready!"}
              </h3>
            </motion.div>

            <div>
              <p className="text-sm text-gray-600">
                {isLastDayOfFestival
                  ? `We're preparing your personalized ${currentFestival.name} story. Upload your final attendance info - it will be available tomorrow!`
                  : `See your personalized ${currentFestival.name} story`}
              </p>
            </div>

            {!isLastDayOfFestival && (
              <Button
                asChild
                size="lg"
                className="bg-yellow-500 font-semibold text-white shadow-md transition-all hover:bg-yellow-600 hover:shadow-lg"
              >
                <Link href="/wrapped">
                  <Sparkles className="mr-2 size-5" />
                  View Your Wrapped
                </Link>
              </Button>
            )}

            <p className="text-xs text-gray-500">
              {isLastDayOfFestival
                ? "Don't forget to log your final attendance! 📝"
                : "Your festival highlights, stats, and personality 🎉"}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
