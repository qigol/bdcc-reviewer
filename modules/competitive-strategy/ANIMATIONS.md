# Animations: Competitive Strategy

## economies-of-scale
- Where: intuition › getting-cheaper › beats 1–3 (stage widget `anim`, region top)
- Idea: a fixed cost spread over more units makes each unit cheaper.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–0.8 s: a big coral block "Fixed cost $20,000" (rent and machine icons on its face); a row of gold product boxes waits on a conveyor.
  - 0.8–2.0 s: the block slices; one slice flies onto each box, on top of a small teal $5 base; a gauge reads $25 per unit.
  - 2.0–4.0 s: the conveyor speeds up and more boxes pour in (the counter rolls to 4,000); the slices shrink and the gauge swings down to $10; a small cost curve draws itself, sloping down.
  - 4.0–5.0 s: hold on the long row of boxes with paper-thin slices.
- On-screen words: "Fixed cost $20,000", "units", "per unit", "cost per unit"
- Numbers: $20,000 · $5 · 1,000 → 4,000 units · $25 → $10 (averageCost)
- Must not show: the $25 average cost while the beat-1 predict gate is open: beat 1 plays only 0–0.8
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 1 plays 0–0.8, beat 2 plays 0.8–5; hidden from beat 4
- Source: `animations/clips/competitive-strategy/economies-of-scale.html` · render and convert with `pnpm anim:render economies-of-scale`
