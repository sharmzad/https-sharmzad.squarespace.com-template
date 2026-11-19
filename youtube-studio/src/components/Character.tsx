import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type Mood = "idle" | "shock" | "cheer";

// A chunky "toy" character built only from primitives — no models to download.
export const Character: React.FC<{
  position?: [number, number, number];
  color?: string;
  mood?: Mood;
  delay?: number;
}> = ({ position = [0, 0, 0], color = theme.character, mood = "idle", delay = 0 }) => {
  const f = useCurrentFrame() - delay;
  const pop = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bob = Math.sin(f / 8) * 0.05;
  const armUp = mood === "cheer" ? -2.4 + Math.sin(f / 4) * 0.3 : mood === "shock" ? -1.4 : -0.2 + Math.sin(f / 10) * 0.1;
  const eyeScale = mood === "shock" ? 1.6 : 1;

  return (
    <group position={[position[0], position[1] + bob, position[2]]} scale={pop}>
      {/* body */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.45, 0.7, 8, 24]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      {/* head */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#FFD9B8" roughness={0.6} />
      </mesh>
      {/* eyes */}
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 2.08, 0.44]} scale={[1, eyeScale, 1]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={theme.ink} />
        </mesh>
      ))}
      {/* mouth */}
      <mesh position={[0, 1.85, 0.46]} rotation={[0, 0, mood === "shock" ? 0 : Math.PI]}>
        <torusGeometry args={[0.1, 0.025, 8, 16, mood === "shock" ? Math.PI * 2 : Math.PI]} />
        <meshStandardMaterial color={theme.ink} />
      </mesh>
      {/* arms */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.5, 1.25, 0]} rotation={[0, 0, side * -armUp]}>
          <mesh position={[side * 0.08, -0.35, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.5, 4, 12]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
        </group>
      ))}
      {/* legs */}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.15, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.35, 4, 12]} />
          <meshStandardMaterial color={theme.ink} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
};
