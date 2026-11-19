import { Config } from "@remotion/cli/config";

// Three.js needs WebGL. "angle" uses the GPU when present; on a GPU-less
// machine (like a cloud server) switch to "swangle" (software rendering).
Config.setChromiumOpenGlRenderer(process.env.REMOTION_GL === "swangle" ? "swangle" : "angle");
Config.setVideoImageFormat("jpeg");
Config.setConcurrency(1); // WebGL scenes are safest rendered one tab at a time
