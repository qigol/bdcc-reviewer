# Animations: Economic Forces

## ppp-scale
- Where: intuition › same-money-different-baskets › beats 2–3 (stage widget `anim`, region top)
- Idea: the PPP rate is the exchange rate at which the same basket costs the same in both currencies.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–1.2 s: a rounded balance scale rises; on the left a basket fills with soap, rice, shoes, a dress and socks, tagged ฿1,865; on the right a matching basket, tagged $160.05.
  - 1.2–1.8 s: one baht bead against one dollar coin: the dollar side slams down and the goods jiggle.
  - 1.8–3.8 s: a gold "baht per dollar" dial spins up from 1; baht beads stream onto the left tray; the scale lifts toward level.
  - 3.8–4.3 s: the scale clicks level with a sparkle; the dial reads ≈ 11.65.
  - 4.3–5.0 s: hold; label "PPP rate: same basket, same price".
- On-screen words: "baht per dollar", "PPP rate: same basket, same price"
- Numbers: ฿1,865 · $160.05 · 11.65 (the basket dataset and basketPPP)
- Must not show: the rate 11.65 while the beat-2 predict gate is open: beat 2 plays only 0–1.8
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 2 plays 0–1.8, beat 3 plays 1.8–5; hidden from beat 4
- Source: `animations/clips/economic-forces/ppp-scale.html` · render and convert with `pnpm anim:render ppp-scale`
