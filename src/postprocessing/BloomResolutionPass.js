import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export class BloomResolutionPass extends UnrealBloomPass {
  constructor(resolution, strength, radius, threshold, resolutionScale = 0.5) {
    super(resolution, strength, radius, threshold);
    this.resolutionScale = resolutionScale;
    this.setSize(resolution.x, resolution.y);
  }

  setSize(width, height) {
    // UnrealBloomPass starts its pyramid at half of the supplied dimensions.
    // Compensate here so the first bloom level follows the requested render scale.
    const inputScale = 2 * (this.resolutionScale ?? 0.5);
    super.setSize(width * inputScale, height * inputScale);
  }
}
