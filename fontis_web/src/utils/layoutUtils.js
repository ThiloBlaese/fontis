export const GRID_SIZE = 32;
export const DEFAULT_FIELD_WIDTH = 288;
export const DEFAULT_FIELD_HEIGHT = 128;

export const getFieldRect = (field) => ({
  x: field.x || 0,
  y: field.y || 0,
  width: field.width || DEFAULT_FIELD_WIDTH,
  height: field.height || DEFAULT_FIELD_HEIGHT,
});

export const rectsOverlap = (a, b) => (
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y
);

export const hasFieldOverlap = (candidateRect, fields, excludeFieldId = null) => {
  return (fields || []).some((f) => {
    if (excludeFieldId && f.id === excludeFieldId) return false;
    return rectsOverlap(candidateRect, getFieldRect(f));
  });
};

/**
 * Finds a free non-overlapping grid position near (preferredX, preferredY).
 * Searches outward in grid steps and falls back below all existing fields.
 */
export const findFreePosition = (preferredX, preferredY, width, height, fields, excludeFieldId = null) => {
  const startX = Math.max(0, Math.round(preferredX / GRID_SIZE) * GRID_SIZE);
  const startY = Math.max(0, Math.round(preferredY / GRID_SIZE) * GRID_SIZE);

  if (!hasFieldOverlap({ x: startX, y: startY, width, height }, fields, excludeFieldId)) {
    return { x: startX, y: startY };
  }

  for (let radius = 1; radius <= 20; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const cx = startX + dx * GRID_SIZE;
        const cy = startY + dy * GRID_SIZE;
        if (cx < 0 || cy < 0) continue;
        if (!hasFieldOverlap({ x: cx, y: cy, width, height }, fields, excludeFieldId)) {
          return { x: cx, y: cy };
        }
      }
    }
  }

  const maxBottom = (fields || []).reduce((max, f) => {
    if (excludeFieldId && f.id === excludeFieldId) return max;
    const r = getFieldRect(f);
    return Math.max(max, r.y + r.height);
  }, 0);

  return { x: 0, y: Math.ceil(maxBottom / GRID_SIZE) * GRID_SIZE };
};
