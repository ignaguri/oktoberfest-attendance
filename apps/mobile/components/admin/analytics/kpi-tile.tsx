import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface KpiTileProps {
  label: string;
  value: string;
}

export function KpiTile({ label, value }: KpiTileProps) {
  return (
    <Card size="sm" variant="outline" className="flex-1">
      <VStack space="xs">
        <Text className="text-xs text-typography-500">{label}</Text>
        <Text className="text-2xl font-semibold text-typography-900">{value}</Text>
      </VStack>
    </Card>
  );
}
