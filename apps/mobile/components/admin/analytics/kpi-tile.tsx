import Svg, { Path } from "react-native-svg";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { sparklinePath } from "@/lib/charts/sparkline-path";
import { Colors } from "@/lib/constants/colors";

const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 28;

interface KpiTileProps {
  label: string;
  value: string;
  /** Oldest first. Drawn only with two or more points. */
  series?: readonly number[];
}

export function KpiTile({ label, value, series }: KpiTileProps) {
  return (
    <Card size="sm" variant="outline" className="flex-1">
      <VStack space="xs">
        <Text className="text-xs text-typography-500">{label}</Text>
        <Text className="text-2xl font-semibold text-typography-900">{value}</Text>
        {series && series.length > 1 && (
          <Svg
            width={SPARKLINE_WIDTH}
            height={SPARKLINE_HEIGHT}
            viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
          >
            <Path
              d={sparklinePath(series, SPARKLINE_WIDTH, SPARKLINE_HEIGHT)}
              stroke={Colors.primary[500]}
              strokeWidth={2}
              fill="none"
            />
          </Svg>
        )}
      </VStack>
    </Card>
  );
}
