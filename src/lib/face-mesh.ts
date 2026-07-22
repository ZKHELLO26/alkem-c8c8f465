// Dense oval face mesh in 200×200 viewBox.
// Points generated on concentric ellipses with natural face oval tapering toward chin.
// Center (100,100), max rx≈56, ry≈70. Smooth curves, no diamond/pointed shapes.

function _genOvalMesh(): { pts: [number, number][]; tris: [number, number, number][] } {
  const cx = 100, cy = 100;
  // Each ring: [y-offset from center, rx at that row, count of points on that ring]
  // Shaped to follow natural face contour: wide at cheeks, narrow at forehead & chin
  const rings: [number, number, number][] = [
    [-65, 12, 5],   // top of forehead (narrow)
    [-56, 28, 8],   // upper forehead
    [-46, 40, 10],  // mid forehead
    [-36, 50, 12],  // temple
    [-26, 56, 14],  // brow line
    [-16, 56, 14],  // eyes
    [-6,  55, 14],  // upper cheeks
    [4,   54, 14],  // nose bridge
    [14,  52, 14],  // mid cheeks
    [24,  48, 12],  // lower cheeks
    [34,  42, 10],  // jawline
    [44,  34, 8],   // lower jaw
    [54,  22, 6],   // chin
    [62,  10, 4],   // chin tip
    [68,  3,  3],   // chin point
  ];

  const pts: [number, number][] = [];
  const ringStarts: number[] = [];

  for (const [dy, rx, count] of rings) {
    ringStarts.push(pts.length);
    for (let i = 0; i < count; i++) {
      // Distribute points along a half-ellipse arc for smooth curves
      const angle = Math.PI * (i / (count - 1)); // 0 to PI
      const x = cx - rx * Math.cos(angle);
      const y = cy + dy;
      pts.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    }
  }

  const tris: [number, number, number][] = [];
  for (let r = 0; r < rings.length - 1; r++) {
    const s0 = ringStarts[r];
    const n0 = rings[r][2];
    const s1 = ringStarts[r + 1];
    const n1 = rings[r + 1][2];
    let i0 = 0, i1 = 0;
    while (i0 < n0 - 1 || i1 < n1 - 1) {
      if (i0 < n0 - 1 && (i1 >= n1 - 1 || i0 / (n0 - 1) <= i1 / (n1 - 1))) {
        tris.push([s0 + i0, s0 + i0 + 1, s1 + i1]);
        i0++;
      } else {
        tris.push([s1 + i1, s0 + i0, s1 + i1 + 1]);
        i1++;
      }
    }
  }

  return { pts, tris };
}

const _mesh = _genOvalMesh();
export const MESH_PTS: [number, number][] = _mesh.pts;
export const MESH_TRIS: [number, number, number][] = _mesh.tris;
