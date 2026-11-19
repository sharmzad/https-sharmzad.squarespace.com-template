import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";

// Keeps the camera aimed at the action every frame (frame-accurate, no useFrame).
export const CameraRig: React.FC<{ x: number; y?: number; z?: number; target: [number, number, number] }> = ({
  x,
  y = 2.2,
  z = 8,
  target,
}) => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(x, y, z);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, x, y, z, target[0], target[1], target[2]]);
  return null;
};
