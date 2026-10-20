# Animations: Organizational Design and Control

## transfer-pricing
- Where: intuition › shifting-profits › beat 3 (stage widget `anim`, region top)
- Idea: moving profit from a high-tax unit to a low-tax unit lowers the group's tax while total profit stays the same.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–1.0 s: two round buildings on two islands: Alpha (coral flag, 50%) with a gold stack of 60, Beta (teal flag, 20%) with 40; a violet tax collector beside each takes a coral slice (30 and 8); a total-tax bubble reads 38.
  - 1.0–3.2 s: a paper-plane invoice flies from Beta to Alpha; 10 coins arc back across the water; Alpha 60 → 50 (tax 25), Beta 40 → 50 (tax 10).
  - 3.2–4.2 s: the bubble counts down 38 → 35; a badge reads "Total profit still 100".
  - 4.2–5.0 s: hold; the camera eases out to show both islands and the bubble.
- On-screen words: "Alpha", "Beta", "Total tax", "Total profit still 100"
- Numbers: 60/40 · 50%/20% · tax 30 + 8 = 38 → 25 + 10 = 35 (transferPricing)
- Must not show: the 62 after-tax total (beat-1 predict) or the 40/60 split the beat-3 `when` gate asks for
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Source: `animations/clips/org-design/transfer-pricing.html` · render and convert with `pnpm anim:render transfer-pricing`
