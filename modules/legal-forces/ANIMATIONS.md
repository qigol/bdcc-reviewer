# Animations: Intellectual Property Rights and Other Legal Forces

## incoterms
- Where: intuition › shipping-terms › beats 2, 3 and 5 (stage widget `anim`, region top)
- Idea: each Incoterm moves the point where the seller's costs and risk stop, so the quoted price grows.
- Length: 6 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–0.7 s: a night port: warehouse, crane, ship at the quay, open sea; a coral container pops out of the warehouse; a coral risk orb floats above it (seller).
  - 0.7–1.6 s: a truck rolls it to the quay edge; the price counter ticks up to 19,500; label "FAS"; a dotted line drops at the quay edge.
  - 1.6–2.6 s: the crane lifts the container on deck (+500 → 20,000); the risk orb drifts to the teal buyer on the far shore and turns teal. Label "FOB · risk passes on board".
  - 2.6–4.4 s: the ship pulls away, the camera pans with it over rolling waves; freight coins arc into the hull (+2,000 → 22,000). Label "CFR".
  - 4.4–5.3 s: a violet umbrella-shield snaps open over the container (+300 → 22,300). Label "CIF".
  - 5.3–6.0 s: hold mid-ocean, the four price tags along the bottom.
- On-screen words: "PRICE", "FAS", "FOB · risk passes on board", "CFR", "CIF"
- Numbers: 19,500 · 20,000 · 22,000 · 22,300 (scene state: fob 20,000, loading 500, freight 2,000, insurance 300)
- Must not show: the CIF price (22,300) while the beat-4 predict gate is open: the sea segment plays on beat 5, after it
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 2 plays 0–2.6, beat 3 replays 0.7–1.6 (FAS stops at the quay), beat 5 plays 2.6–6; hidden from beat 6
- Source: `animations/clips/legal-forces/incoterms.html` · render and convert with `pnpm anim:render incoterms`
