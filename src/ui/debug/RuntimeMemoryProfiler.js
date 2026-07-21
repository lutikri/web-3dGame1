export function createRuntimeMemoryProfiler({ renderer, getTextureSets, cacheMs = 1000 }) {
  let cachedSnapshot = null;
  let cachedAt = 0;

  function getSnapshot() {
    const now = performance.now();
    if (!cachedSnapshot || now - cachedAt > cacheMs) {
      cachedSnapshot = collectSnapshot();
      cachedAt = now;
    }
    return cachedSnapshot;
  }

  function collectSnapshot() {
    const textures = [];
    const sets = [];
    getTextureSets().forEach((set) => {
      let setBytes = 0;
      set.textures.forEach((entry) => {
        const bytes = estimateTextureGpuBytes(entry.texture);
        setBytes += bytes;
        textures.push({
          label: set.label,
          tier: set.tier,
          mapName: entry.mapName,
          path: entry.path,
          bytes,
          width: getTextureDimension(entry.texture, "width"),
          height: getTextureDimension(entry.texture, "height"),
        });
      });
      sets.push({ label: set.label, tier: set.tier, bytes: setBytes });
    });
    textures.sort((a, b) => b.bytes - a.bytes);
    sets.sort((a, b) => b.bytes - a.bytes);
    const heap = performance?.memory ?? null;
    return {
      runtimeTextureBytes: textures.reduce((total, texture) => total + texture.bytes, 0),
      largestTexture: textures[0] ?? null,
      largestSet: sets[0] ?? null,
      textureObjectCount: renderer.info.memory.textures,
      geometryObjectCount: renderer.info.memory.geometries,
      heapUsedBytes: heap?.usedJSHeapSize ?? 0,
      heapLimitBytes: heap?.jsHeapSizeLimit ?? 0,
      deviceMemoryGb: Number(navigator.deviceMemory ?? 0),
    };
  }

  return { getSnapshot };
}

export function getTextureDimension(texture, axis) {
  const image = texture?.image ?? texture?.source?.data;
  const mip = texture?.mipmaps?.[0];
  return Number(image?.[axis] ?? mip?.[axis] ?? 0);
}

export function estimateTextureGpuBytes(texture) {
  if (!texture) return 0;
  const mipBytes = texture.mipmaps?.reduce((total, mip) => total + Number(mip?.data?.byteLength ?? 0), 0) ?? 0;
  if (mipBytes > 0) return mipBytes;
  const width = getTextureDimension(texture, "width");
  const height = getTextureDimension(texture, "height");
  if (!width || !height) return 0;
  const mipMultiplier = texture.generateMipmaps === false ? 1 : 4 / 3;
  const bytesPerPixel = texture.isCompressedTexture ? 0.5 : 4;
  return width * height * bytesPerPixel * mipMultiplier;
}

export function formatMemoryMiB(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "n/a";
  return `${(bytes / 1048576).toFixed(bytes >= 104857600 ? 0 : 1)} MiB`;
}

export function formatTextureLabel(texture) {
  if (!texture) return "n/a";
  const name = texture.path ? texture.path.split("/").pop() : `${texture.label}:${texture.mapName}`;
  const dimensions = texture.width && texture.height ? `${texture.width}x${texture.height}` : "?x?";
  return `${formatMemoryMiB(texture.bytes)} ${dimensions} ${name}`;
}
