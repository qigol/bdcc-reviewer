# Source notes — Neural Networks: From One Neuron to Backpropagation

## Source
- File: Session_17_Introduction_to_Neural_Networks.pdf | Sessions: 17 | Date: 2026-10-09 | Pages: 34 (Prof. Nash, ML 3301)
- File: [Revised_2026_10_20]_Lab_1_MLP_from_Scratch_Student.ipynb (Final Term Lab #1, "Build an MLP from Scratch in NumPy"),
  Part A = the solved example from Session 18. Part B = a graded hand exercise (35 pts). Part C = NumPy layer functions.

## Concept inventory (lecture order)
1. Neural networks inside ML / deep learning — slide 4 — logistic regression = weighted sum + sigmoid = one neuron; stacking lets the model learn its own features.
2. McCulloch–Pitts threshold units — slide 5 — all-or-none units compute AND (θ = 2) and OR (θ = 1); nothing learned.
3. Perceptron (Rosenblatt 1958) — slide 6 — weights learned from examples; one straight-line boundary.
4. Linear decisions for AND / OR — slide 7 — w = (1, 1), b = −1.5 (AND), b = −0.5 (OR); "same weights, the line slides".
5. XOR — slides 8–9 — not linearly separable; proof by contradiction from four inequalities (Minsky & Papert 1969).
6. Hidden layer solves XOR — slide 10 — h₁ = OR unit (x₁ + x₂ − 0.5), h₂ = AND unit (x₁ + x₂ − 1.5), y = h₁ − h₂ − 0.5 ("OR but not AND"), step activations; hidden space makes it separable.
7. The training problem for hidden layers — slide 11 — no targets for hidden units, credit assignment, step functions are flat.
8. Backpropagation (Rumelhart, Hinton & Williams 1986) — slide 12 — forward pass, then error signals sent backward by the chain rule; gradient descent.
9. Images: flattening costs 150,528 inputs × 1,000 hidden ≈ 150 million weights — slide 13.
10. CNNs (LeCun 1998): local, shared, stacked — slide 14.
11. AlexNet 2012: top-5 error 15.3% vs 26.2% second best; data + GPUs + ReLU/dropout — slide 15.
12. ResNets 2016: degradation problem, shortcut connections learn F(x) on top of identity — slide 16.
13. RNNs (Elman 1990), LSTM/GRU, attention (2014), Transformers (2017) — slides 17–20.
14. LLM in one sentence — slide 21 — a very large Transformer trained by backprop to predict the next token, then tuned to follow instructions.
15. One artificial neuron — slide 22 — z = Σ wᵢxᵢ + b, a = g(z).
16. Layers and parameter count — slide 23 — 3–4–2 network has (3×4+4) + (4×2+2) = 26 parameters.
17. Activation functions — slide 24 — linear, step, sigmoid, tanh, ReLU.
18. Depth collapses without nonlinearity — slide 25 — W₂(W₁x + b₁) + b₂ = W′x + b′.
19. Derivative toolkit — slide 26 — constant, power, sum, product, quotient, sin, exp, ln.
20. Chain rule — slide 27 — gears picture: 2 × 3 = 6; check y = (5x)² → 50x.
21. Derivative exercises 1–10 — slides 28–31 (answer key on slides 30–31).
22. (Lab) Forward pass, loss, local derivatives, chain rule, backward reuse, gradient descent update, new forward pass — notebook Part A.
23. (Lab) Layer functions in NumPy: linear_forward / linear_backward / relu_backward / mse_backward — notebook Part C.

## Formulas (verbatim, as TeX)
- Neuron: `z = \sum_i w_i x_i + b, \quad a = g(z)` — slide 22
- Activations: linear `z`, step `1[z>0]`, sigmoid `1/(1+e^{-z})`, tanh `\tanh z`, ReLU `\max(0,z)` — slide 24
- Collapse: `y = W_2(W_1x + b_1) + b_2 = (W_2W_1)x + (W_2b_1 + b_2) = W'x + b'` — slide 25
- Parameter count: `(3 \times 4 + 4) + (4 \times 2 + 2) = 26` — slide 23
- Chain rule: `\frac{dy}{dx} = \frac{dy}{du}\frac{du}{dx}` — slide 27
- Lab Part A model: `z_j = w_{1j}x_1 + w_{2j}x_2 + b_j,\ a_j = \mathrm{ReLU}(z_j),\ \hat y = v_1a_1 + v_2a_2 + c,\ L = \tfrac12(\hat y - y)^2`
- Loss derivative: `\partial L/\partial \hat y = \hat y - y`
- ReLU slope: `\mathrm{ReLU}'(s) = 1` if s > 0, `0` if s < 0
- Update: `\theta_{new} = \theta - \eta\,\partial L/\partial\theta`

## Worked examples (exact numbers)
- Single neuron — slide 22 — x = (2, 1, 3), w = (0.5, −1, 0.25), b = 0.1 → z = 0.85, ReLU = 0.85, sigmoid ≈ 0.70 (0.7006) (→ `neuron-slide`)
- McCulloch–Pitts truth table — slide 5 — sums 0, 1, 1, 2; AND (θ = 2) 0,0,0,1; OR (θ = 1) 0,1,1,1 (→ `mp-and`, `mp-or`)
- AND line at (1, 1) — slide 7 — 1 + 1 − 1.5 = 0.5 > 0 → fires (→ `and-line-11`)
- XOR via hidden layer — slide 10 — outputs 0, 1, 1, 0 (→ `xor-net`)
- Parameter count 3–4–2 — slide 23 — 26 (→ `params-342`)
- Collapse example — slide 25 — two layers 2x + 1 then 3(·) − 4 → 6x − 1 (W′ = 6, b′ = −1) (→ `collapse-slide`)
- ImageNet first layer — slide 13 — 224 × 224 × 3 = 150,528 inputs; × 1,000 ≈ 150.5 million weights (→ `image-weights`)
- Chain-rule gears — slide 27 — 2 × 3 = 6
- Lab Part A forward — z₁ = 2.0, z₂ = 1.0, a₁ = 2.0, a₂ = 1.0, ŷ = 0.5, L = 2.0 (→ `parta-forward`)
- Lab Part A local derivatives — ∂L/∂ŷ = −2, ∂ŷ/∂v₁ = 2, ∂ŷ/∂a₁ = −0.5, ReLU′ = 1, 1 (→ `parta-backward`)
- Lab Part A gradients — w₁₁ 2, w₂₁ −1, b₁ 1, w₁₂ −4, w₂₂ 2, b₂ −2, v₁ −4, v₂ −2, c −2; ∂L/∂a₁ = 1, ∂L/∂z₁ = 1, ∂L/∂a₂ = −2, ∂L/∂z₂ = −2 (→ `parta-backward`)
- Lab Part A update (η = 0.05) — new: 0.4, −0.45, 0.45, −0.3, −1.1, 1.1, −0.3, 1.1, 0.6 (→ `parta-update`)
- Lab Part A new forward — z₁ = 1.7, z₂ = 1.6, ŷ = 1.85, L = 0.21125 (→ `parta-new-forward`)

## Conventions & ambiguities
- **Weight index order** (lab): `w_ij` goes **from input i to hidden unit j**. So unit 1's weights are w₁₁ (from x₁) and w₂₁ (from x₂). Used everywhere in this module.
- **Loss** is half squared error `½(ŷ − y)²`, so ∂L/∂ŷ = ŷ − y (the ½ cancels the 2). The NumPy code averages over n rows; with n = 1 it is identical.
- **All gradients are computed on the original network** and only then are parameters updated (lab A5).
- **ReLU′(0)** is not defined in the lab; our generators never draw a pre-activation of exactly 0.
- **Step activation**: the slides write `1[z > 0]` (fires when strictly positive) and McCulloch–Pitts fires when sum ≥ θ. We keep each as printed: MP uses `sum ≥ θ`; the perceptron/XOR units use `z > 0`.
- **Sigmoid at 0.85** ≈ 0.7006; slide shows ≈ 0.70 (tolerance 0.01).
- Our Python mirrors the lab's NumPy layer functions (`linear_forward`, `linear_backward`, `relu_backward`, `mse_backward`) but the step-through code uses plain loops over units.

## Errata
- None found. All Part A numbers reproduce exactly.

## Beyond the slides
- **Lab Part B is a graded assignment.** The module does **not** reproduce its specific numbers or answers. Instead the
  quiz has generators for the same shape (one input, two hidden layers of one ReLU unit, linear output) with fresh numbers
  that never equal the lab's starting table (x = 2, y = 3, w₁ = 0.5, b₁ = 0, w₂ = 1, b₂ = 0, v = 1, c = 0, η = 0.1).
- "Your network": a second 2–2–1 network with different numbers that the learner solves on their own, stage by stage,
  after watching Part A. Marked beyond the slides.
- Dead-ReLU discussion (lab E2) is taught with our own numbers.
- Sigmoid's exact value at 0.85 (0.7006).

## Skill map
- neuron: concepts 15, 17 (z = Σwx + b, a = g(z))
- activations: 17, 18
- linear-limits: 2–7 (AND/OR lines, XOR impossibility, hidden-layer XOR)
- architecture: 16, 9 (layers, parameter counting)
- forward-pass: 22 (forward pass and loss)
- chain-rule: 19–21
- local-derivatives: 22 (A2)
- backprop: 22 (A3–A4, reuse of ∂L/∂z)
- gradient-descent: 22 (A5)
- history: 8–14
- numpy-layers: 23
