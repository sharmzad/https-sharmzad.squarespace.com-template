import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// A stack of coins that drops in one by one — great for "salary", "savings", etc.
export const CoinStack: React.FC<{ count: number; position?: [number, number, number]; delay?: number }> = ({
  count,
  position = [0, 0, 0],
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const s = spring({ frame: frame - delay - i * 3, fps, config: { damping: 12 } });
        const y = i * 0.16 + (1 - s) * 4;
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[0, i * 0.4, 0]} castShadow visible={s > 0.01}>
            <cylinderGeometry args={[0.45, 0.45, 0.14, 40]} />
            <meshStandardMaterial color={theme.gold} metalness={0.15} roughness={0.35} emissive={theme.gold} emissiveIntensity={0.15} />
          </mesh>
        );
      })}
    </group>
  );
};
