"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFestival } from "@/contexts/FestivalContext";
import { useWrappedAccess } from "@/hooks/useWrapped";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

export function WrappedCTA() {
  const { currentFestival } = useFestival();
  const { data: accessResult, loading } = useWrappedAccess(currentFestival?.id);

  // Don't show if loading or access not allowed
  if (loading || !accessResult || !accessResult.allowed || !currentFestival) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <motion.div
              animate={{
                rotate: [0, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
              className="text-5xl"
            >
              🍻
            </motion.div>

            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-1">
                Your Wrapped is Ready!
              </h3>
              <p className="text-gray-600">
                See your personalized {currentFestival.name} story
              </p>
            </div>

            <Button
              asChild
              size="lg"
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <Link href={`/wrapped/${currentFestival.id}`}>
                <Sparkles className="mr-2 size-5" />
                View Your Wrapped
              </Link>
            </Button>

            <p className="text-xs text-gray-500">
              Your festival highlights, stats, and personality 🎉
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
