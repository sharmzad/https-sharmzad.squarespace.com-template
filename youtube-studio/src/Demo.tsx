import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { CameraRig } from "./components/CameraRig";
import type { Caption } from "@remotion/captions";
import { Character } from "./components/Character";
import { CoinStack } from "./components/CoinStack";
import { Captions } from "./components/Captions";
import { theme } from "./theme";
import captionsJson from "./captions/demo.json";

export type DemoProps = { voiceover?: string };

export const Demo: React.FC<DemoProps> = ({ voiceover }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  // slow cinematic camera drift
  const camX = interpolate(frame, [0, 240], [-1.2, 1.2]);
  const shock = frame > fps * 5.6;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ position: [camX, 2.2, 8], fov: 38 }}>
        <CameraRig x={camX} target={[0.6, 1.3, 0]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 8, 5]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
        {/* floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[9, 64]} />
          <meshStandardMaterial color="#E9DCC6" />
        </mesh>
        <Character position={[-1.6, 0, 0]} mood={shock ? "shock" : frame > fps * 3.2 ? "cheer" : "idle"} />
        <Sequence from={Math.round(fps * 3.2)} layout="none">
          <CoinStack count={12} position={[1.4, 0, 0]} />
        </Sequence>
        <Sequence from={Math.round(fps * 5.6)} layout="none">
          <Character position={[3.2, 0, -1]} color={theme.warn} />
        </Sequence>
      </ThreeCanvas>

      {/* big number overlay */}
      <Sequence from={Math.round(fps * 3.2)} durationInFrames={Math.round(fps * 2.2)}>
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 40 }}>
          <div style={{ fontFamily: theme.font, fontSize: 130, fontWeight: 900, color: theme.accent, WebkitTextStroke: `6px ${theme.ink}` }}>
            $75,000
          </div>
        </AbsoluteFill>
      </Sequence>

      <Captions captions={captionsJson as Caption[]} />
      {voiceover ? <Audio src={staticFile(voiceover)} /> : null}
    </AbsoluteFill>
  );
};
