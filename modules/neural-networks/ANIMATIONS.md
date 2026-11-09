# Animations: Neural Networks: From One Neuron to Backpropagation

Style: Manim / 3Blue1Brown. Black background, thin bright strokes drawn on, glowing dots carrying signals, KaTeX math,
slow camera push. Built with `animations/kit/manim.css` + `manim.js` (the INTB clips keep the navy `kit.js` look).
Blue edges are positive weights, red are negative, thicker means larger. Yellow is the prediction, green the target.

## lab-forward-flow
- Where: intuition › lab-forward › last beat, after the loss gate (stage widget `anim`, region main; replaces the
  static `lab-net-forward.svg` on that beat)
- Idea: a forward pass is signals flowing left to right: each unit adds up what it receives, ReLU passes the positive
  sums through, the output is the guess, and the loss measures how far the guess is from the target.
- Length: 9 s, plays once (`loop: false`) · Shape: 16:9 · Background: opaque black `#000000`
- Storyboard:
  - 0.0–1.7 s: the 2–2–1 network draws on; weights and biases appear on the edges; inputs 2 and −1 appear.
  - 1.8–3.3 s: signals leave the inputs along every edge; the hidden units count up to their sums 2 and 1.
  - 3.3–4.0 s: both sums are positive, so ReLU leaves them alone; both units light up.
  - 4.1–5.2 s: signals leave the hidden units; the output counts up to 0.5.
  - 5.3–6.6 s: the guess 0.5 drops onto a number line; the target 2.5 appears above it; a bracket marks the gap.
  - 6.8–9.0 s: the loss is written out, `L = ½(0.5 − 2.5)² = 2`, then a hold.
- On-screen words: none (symbols and numbers only)
- Numbers: the lab's worked example (`examples.yaml` parta-forward): x = (2, −1), w11 = 0.5, w21 = −0.5, b1 = 0.5,
  w12 = −0.5, w22 = −1, b2 = 1, v1 = −0.5, v2 = 1, c = 0.5, target 2.5; z1 = 2, z2 = 1, a1 = 2, a2 = 1, ŷ = 0.5, L = 2
- Must not show: anything before the loss gate has been answered. It is placed on the beat after that gate. Never the
  learner's own network ("your network") or lab Part B numbers.
- 3D: no

## lab-backward-flow
- Where: intuition › lab-backward › the beat after "Play to the end" (stage widget `anim`, region main; replaces the
  static `lab-net-backward.svg`; the beat's only gate is a reflect gate that asks for no number)
- Idea: the error runs backward along the same edges; every weight and bias is replaced by the gradient it receives, and
  the gradient stored at each hidden sum is reused for that unit's parameters.
- Length: 10 s, plays once (`loop: false`) · Shape: 16:9 · Background: opaque black `#000000`
- Storyboard:
  - 0.0–1.2 s: the lab network appears again, weights shown, the loss `L` on the right.
  - 1.2–2.4 s: an orange signal runs from the loss to the output; the output shows ∂L/∂ŷ = −2.
  - 2.4–4.0 s: it runs back to the hidden units (∂L/∂z = 1 and −2); the output weights and bias turn into −4, −2, −2.
  - 4.2–6.4 s: it runs back to the inputs; the first-layer weights and biases turn into 2, −1, −4, 2 and 1, −2.
  - 6.4–10 s: all nine gradients on screen, a gentle emphasis, then a hold.
- On-screen words: none (symbols and numbers only)
- Numbers: `examples.yaml` parta-backward: ∂L/∂ŷ = −2; v1 −4, v2 −2, c −2; ∂L/∂z1 = 1, ∂L/∂z2 = −2; w11 2, w21 −1, b1 1,
  w12 −4, w22 2, b2 −2
- Must not show: anything from "your network" or lab Part B. Not placed on any beat with an open numeric gate.
- 3D: no

## xor-hidden-space
- Where: intuition › hidden-layers › the beat after the predict gate on input (1, 1) (stage widget `anim`, region main;
  shown with the hidden-space chart, instead of the XOR network image)
- Idea: the hidden units re-represent the four XOR inputs so that one straight line can separate them.
- Length: 8 s, plays once (`loop: false`) · Shape: 16:9 · Background: opaque black `#000000`
- Storyboard:
  - 0.0–1.6 s: axes draw on; the four inputs appear as dots, filled green where the output is 1, hollow red where it is 0.
  - 2.0–4.2 s: the plane is read as the hidden space (h1, h2): the dot for (0, 1) glides onto (1, 0); the other three stay.
  - 4.4–6.0 s: one straight line, h1 − h2 = 0.5, draws on and the green side lights up.
  - 6.0–8.0 s: hold.
- On-screen words: none (symbols and numbers only)
- Numbers: `hiddenSpace` / `xorSheet`: (0,0)→(0,0), (0,1)→(1,0), (1,0)→(1,0), (1,1)→(1,1); output fires if h1 − h2 − 0.5 > 0
- Must not show: the output value for (1, 1) in words or digits before the gate; the clip only colours the dots, and it sits
  on the beat after that gate.
- 3D: no
