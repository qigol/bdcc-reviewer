# Animations: BYD: The Chinese EV Champion

## cost-gap
- Where: intuition › why-so-cheap › beat 4 (stage widget `anim`, region top)
- Idea: BYD's $4,700 cost edge is the sum of three gaps: supplier margin, admin and R&D, and labor/battery/subsidy.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–0.8 s: two cars side by side on a dark road; a tall coral cost tower above the rival, the same base outlined in teal above BYD, a glowing $4,700 gap bracket between their tops.
  - 0.8–2.2 s: the biggest block "Supplier margin −2,400" slides off and tumbles away; gear-shaped parts zip into a BYD factory icon.
  - 2.2–3.4 s: "Admin + R&D −1,700" slides off.
  - 3.4–4.3 s: "Labor, battery, subsidy −600" crumbles into three pebbles; the towers stand level.
  - 4.3–5.0 s: hold; the gap bracket collapses to zero with a sparkle.
- On-screen words: "Rival", "BYD", the three block labels
- Numbers: $4,700 = 2,400 + 1,700 + 600 (the case)
- Must not show: the 25% pay gap (the beat-2 predict gate)
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Source: `animations/clips/case-byd/cost-gap.html` · render and convert with `pnpm anim:render cost-gap`
