# Animations: Political Forces That Affect Global Trade

## nationalization
- Where: intuition › economic-systems › beats 3–4 (stage widget `anim`, region top)
- Idea: a government can move a firm along the line from private to state ownership, and back.
- Length: 5 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–0.8 s: a glowing track, teal PRIVATE end left, violet GOVERNMENT end right; a factory pops in near the left, smoke puffs bob; a worker in a teal cap waves from its door.
  - 0.8–2.2 s: a violet hand-crane swoops down, grabs the factory and drags it right; the factory turns violet; the cap swaps to a violet one with a star badge. Label "Nationalization".
  - 2.2–2.6 s: hold; the factory wobbles into place at the government end.
  - 2.6–4.3 s: a stack of gold coins drops onto the track; the factory rides it back left, turning teal; a teal buyer with a briefcase catches the keys. Label "Privatization".
  - 4.3–5.0 s: hold; the camera eases out to show the whole track (most countries sit in between).
- On-screen words: "PRIVATE", "GOVERNMENT", "Nationalization", "Privatization"
- Numbers: none
- Must not show: which reasons belong to nationalizing or privatizing (the sorter on beat 4 asks for that)
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Segments: beat 3 plays 0–2.6 (`animFrom`/`animTo` in scene state), beat 4 sets 2.6–5, hidden from beat 5
- Source: `animations/clips/political-forces/nationalization.html` · render and convert with `pnpm anim:render nationalization`
