import React from "react";
import { View, ViewProps } from "react-native";
import { cardStyle } from "./styles";

// Import contract types from shared UI package
import type { CardSize, CardVariant } from "@prostcounter/ui";

/**
 * Card Props - implements @prostcounter/ui CardProps contract
 */
type ICardProps = ViewProps & {
  /** Size of the card - from contract */
  size?: CardSize;
  /** Variant style of the card - from contract */
  variant?: CardVariant;
  /** Additional className for styling */
  className?: string;
};

const Card = React.forwardRef<React.ComponentRef<typeof View>, ICardProps>(
  function Card(
    { className, size = "md", variant = "elevated", ...props },
    ref,
  ) {
    return (
      <View
        className={cardStyle({ size, variant, class: className })}
        {...props}
        ref={ref}
      />
    );
  },
);

Card.displayName = "Card";

export { Card };
