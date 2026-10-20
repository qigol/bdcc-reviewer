# Animations: The International Monetary System

## gold-to-floating
- Where: intuition › from-gold-to-floating › beats 2–7 (stage widget `anim`, region top)
- Idea: money went from being tied to gold, to gold plus the dollar, to rates set by the market.
- Length: 6 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–1.8 s: a huge glowing gold bar at the top; coins of different colours hang from it on chains, swaying in sync. Label "Gold standard".
  - 1.8–3.6 s: the chains re-hook onto one big green $ coin that hangs from the gold bar on a single thick chain; the camera pushes in on that chain. Label "Bretton Woods · 1944".
  - 3.6–4.4 s: the thick chain strains and cracks with a burst of particles; a "1971" stamp slams in.
  - 4.4–5.4 s: the coins drop onto a softly rolling sea and bob at different heights, each on its own rhythm. Label "Floating".
  - 5.4–6.0 s: hold; the gold bar drifts up out of frame.
- On-screen words: "GOLD", "Gold standard", "Bretton Woods · 1944", "1971", "Floating"
- Numbers: dates only (1944, 1971)
- Must not show: the answer to the Triffin predict gate (a deficit)
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 2 plays 0–1.8, beat 4 plays 1.8–3.6, beat 7 plays 3.6–6
- Source: `animations/clips/monetary-system/gold-to-floating.html` · render and convert with `pnpm anim:render gold-to-floating`
