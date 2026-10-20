# Animations: BYD: The Chinese EV Champion

## cost-gap
- Where: intuition › why-so-cheap › beats 1 and 4 (stage widget `anim`, region top)
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
- Segments (1.2.0): beat 1 plays 0–0.8 (the two towers and the $4,700 gap), hidden on beats 2–3 (the pay readouts), beat 4 sets 0.8–5 (all three blocks: the beat-4 narration names every source), hidden from beat 5
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Source: `animations/clips/case-byd/cost-gap.html` · render and convert with `pnpm anim:render cost-gap`

## global-tariff-routes
- Where: intuition › going-global › beat 2 (whole clip) and intuition › walls-and-help › beat 2 (0–1.6 only); stage widget `anim`, region top, in each scene
- Idea: three ways into a walled market: export finished cars and pay the tariff, ship kits and assemble nearby (CKD), or build a plant inside the wall.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.6 s: top lane: a ship of finished cars sails from China to a coral "Tariff" wall at the quay; the car's price bar climbs (unlabelled). "Export finished cars · tariffs pile on".
  - 1.6–3.1 s: middle lane: a ship of flat kit boxes passes a low violet gate; an assembly shed pops up and a car rolls out. "CKD · ship parts, assemble nearby".
  - 3.1–4.3 s: bottom lane: another coral wall; a dotted gold arc leaps over it to a factory inside the market. "Local plant · build inside the wall".
  - 4.3–5.0 s: hold on all three lanes.
- Numbers: none (no tariff rates, no prices)
- Must not show: 53,144 or 235 (walls-and-help beats 1 and 3), the share abroad (going-global beat 1), or any claim about overseas costs (going-global's reflect)
- Segments: going-global shows the whole clip on beat 2 (where CKD assembly and plants abroad are narrated), hidden from beat 3; walls-and-help shows 0–1.6 on beat 2 (after the 53,144 predict), hidden from beat 3
- Source: `animations/clips/case-byd/global-tariff-routes.html`
