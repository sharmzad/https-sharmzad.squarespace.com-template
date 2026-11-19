import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { theme } from "../theme";

// Word-by-word captions. Feed it a Caption[] (from Whisper / ElevenLabs timestamps).
export const Captions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 900 }),
    [captions],
  );
  const page = pages.find((p) => nowMs >= p.startMs && nowMs < p.startMs + p.durationMs);
  if (!page) return null;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 90 }}>
      <div
        style={{
          fontFamily: theme.font,
          fontSize: 68,
          fontWeight: 900,
          textTransform: "uppercase",
          background: "rgba(255,255,255,0.92)",
          border: `5px solid ${theme.ink}`,
          borderRadius: 22,
          padding: "14px 34px",
          whiteSpace: "pre",
          boxShadow: `8px 8px 0 ${theme.ink}`,
        }}
      >
        {page.tokens.map((t) => {
          const active = nowMs >= t.fromMs && nowMs < t.toMs;
          return (
            <span key={t.fromMs} style={{ color: active ? theme.accent : theme.ink }}>
              {t.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
