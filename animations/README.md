# Animations (HyperFrames source)

The source of the short clips that modules play with the `Animation` widget (guide §9a). This folder is one
[HyperFrames](https://github.com/heygen-com/hyperframes) project. It is **not** shipped: modules get the rendered
`.webm` + `.mp4` + poster in `modules/<module-id>/assets/anim/`, and the folder is left out of the Docker image.

```
animations/
├─ hyperframes.json, index.html      the project (index.html is a style card for Studio)
├─ kit/                              the shared motion kit: kit.css, kit.js (global HF), kit-three.js (the sky)
│  └─ vendor/                        GSAP 3.15.0, Three.js r181 and the Nunito font (OFL), kept in the project
├─ clips/<module-id>/<clip-id>.html  one composition per clip; its scene script is inline
├─ render.mjs                        render + convert (below)
└─ renders/                          intermediate HyperFrames renders (git-ignored)
```

## Commands (from the repo root)

| | |
|---|---|
| `pnpm anim:preview` | open HyperFrames Studio on this project (play, scrub, edit) |
| `pnpm anim:lint` | the HyperFrames linter |
| `pnpm anim:render` | render every clip, then convert each into its module's `assets/anim/` |
| `pnpm anim:render incoterms` | only some clips (clip ids or module ids) |
| `pnpm anim:render --draft incoterms` | a quick low-quality render in `renders/`, not converted |

Rendering needs FFmpeg (`ffmpeg` and `ffprobe` on the PATH). The HyperFrames CLI (pinned to 0.8.175 in `render.mjs` and
`package.json`) runs through `npx` and downloads its own Chrome on first use. A clip takes about a minute to render.

`render.mjs` runs, for each clip:

```bash
npx hyperframes render animations -c clips/<module-id>/<clip-id>.html --format webm --fps 30 --quality high -o animations/renders/<clip-id>.webm
pnpm kodigo animation animations/renders/<clip-id>.webm modules/<module-id>/assets/anim/<clip-id> --flatten --bg '#0B1D3A'
```

`--flatten`: the clips paint their own navy sky, so the alpha channel HyperFrames writes into every webm is dropped.

## Making a clip

1. Write the brief in the module's `ANIMATIONS.md` (guide §9a.3): the idea, storyboard, words, numbers, and what it must
   not show while a gate is open.
2. Copy a clip in `clips/` as a starting point. Keep the shell: `data-composition-id` = the clip id = the file name,
   `data-duration` in seconds, the scene inline, and `window.__timelines['<clip-id>'] = tl`.
3. Build it with the kit (`HF.timeline`, shapes, `HF.pop`, `HF.move`, `HF.arc`, `HF.count`, `HF.camera`…; see the
   header of `kit/kit.js` and guide §9a.7). Every frame must be a pure function of time: no `Math.random`
   (`HF.rng(seed)`), no clocks or timers, loops that end inside the film. End on a 0.5–1 s hold.
4. Check it in Studio (`pnpm anim:preview`) or with `pnpm anim:render --draft <clip-id>`.
5. Render (`pnpm anim:render <clip-id>`), place an `Animation` widget on a stage (guide §9a.6), and run
   `pnpm kodigo validate modules/<module-id>`.

## Style (the INTB clips)

Flat vector shapes with rounded corners and no outlines; each object gets one soft inner highlight and one darker shade
of its own hue, never a hard drop shadow. A navy → indigo sky (`#0B1D3A` → `#1B2B5E`) with slow drifting specks.
Teal `#2EC4B6` good / kept / buyer side, coral `#FF6B6B` cost / tax / loss, gold `#FFC94A` money and value, violet
`#9B5DE5` government and institutions, off-white `#F4F1DE` text. Original round characters with dot eyes and no mouth
(never Kurzgesagt's own birds or a real brand's logo). Objects pop in with an overshoot (0 → 110% → 100% in 0.3 s), moves
ease in-out and settle with a small wobble, coins fall in arcs, the camera pushes about 5% instead of cutting, one short
Nunito label at a time, and numbers count up. Reduced motion shows 3–4 still frames that crossfade (the widget's
`stills` prop).
