# YouTube Studio — 3D explainer videos with Three.js + Remotion

| Tool | What it does here |
|---|---|
| **Three.js** (`three`, `@react-three/fiber`, `@react-three/drei`) | Builds the 3D characters, props and camera moves |
| **Remotion** (`remotion`, `@remotion/three`, `@remotion/cli`) | Lays scenes out on a timeline and renders the MP4 |
| **@remotion/captions** | Word-by-word highlighted captions |
| **@remotion/media-utils** | Reads audio length and waveforms, for syncing scenes to the voiceover |

## Run it

```bash
cd youtube-studio
npm install
npm run studio        # opens the live editor at http://localhost:3000
npm run render:demo   # writes out/demo.mp4
```

On a machine with no GPU (a cloud server, for example), render with software WebGL: `REMOTION_GL=swangle npm run render:demo`.

## Layout

```
src/
  theme.ts               <- brand colours and font (change these to restyle everything)
  Root.tsx               <- list of videos (compositions)
  Demo.tsx               <- example scene: character + coin stack + big number + captions
  components/
    Character.tsx        <- 3D character built from primitives (moods: idle, shock, cheer)
    CoinStack.tsx        <- coins that drop in one by one
    CameraRig.tsx        <- keeps the camera aimed at the action
    Captions.tsx         <- word-by-word captions
  captions/demo.json     <- caption timings (Caption[] format)
public/                  <- put voiceover .mp3 files here
```

## Making a real episode

1. **Script.** Write about 900 words for 6 minutes (≈150 words per minute) and split it into 3 parts.
2. **Voiceover.** Generate each part in ElevenLabs and save it as `public/part1.mp3`, and so on.
3. **Captions.** Transcribe each MP3 with word timestamps (ElevenLabs speech-to-text or Whisper)
   and save the result as `src/captions/part1.json` in the `Caption[]` format used by `demo.json`.
4. **Scenes.** Ask Claude: *"Build composition Part1 from public/part1.mp3 and src/captions/part1.json
   using the existing components; one visual idea per sentence."* Set the length to the audio
   length × 30 fps.
5. **Render.** Run `npx remotion render src/index.ts Part1 out/part1.mp4`, then join the parts.
