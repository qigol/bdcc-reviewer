# Source notes — Convolutional Neural Networks

## Source
- File: CNN_PyTorch.ipynb (guided notebook, PyTorch + torchvision) | Sessions: 21–24 | Dates: 2026-10-23 to 2026-11-03
- CNN_TensorFlow.ipynb has identical text and numbers (Keras layers); not used separately.
- The notebook was supplied **without outputs**; every number below is recomputed from its code and arrays.

## Concept inventory (lecture order)
1. A1 Why convolution — local connectivity, parameter sharing; dense 512 on 150×150×3 = 34,560,512 params vs 32 filters 3×3×3 = 896.
2. A2 1D convolution — flip, slide, dot; x = [3,2,1,7,1,2,5,4], w = [0.5,0.75,1,0.25], s = 2 → y = [7,9,8].
3. A3 Convolution vs cross-correlation — frameworks do not flip; same numbers with the flipped filter.
4. A4 Padding — valid (shorter), same p = (m−1)/2, full p = m−1 (longer); demo with [1,1,1].
5. A5 Output size o = ⌊(n + 2p − m)/s⌋ + 1; table of six cases.
6. B1 Images as grids; channels.
7. B2 2D convolution — X_SMALL, W_SMALL, p = 1, s = 2 → [[4.6,1.6],[7.5,2.9]]; X_TRY/W_TRY.
8. B3 Padding/stride in 2D — full 7×7, same 5×5, valid 3×3 on a 5×5 input; shape table.
9. B4 Filters detect features — kernel sums 0 (edges) vs 1 (brightness kept); vertical vs horizontal.
10. B5 Max pooling — X1, X2 give the same pooled result; shifting X1 changes some outputs; average pooling mentioned.
11. B6 Framework layers — (batch, channels, height, width); nn.Conv2d with the rotated filter reproduces the hand result.
12. C1 Architecture — conv base + classifier; each filter spans all input channels; five 3×3×3 filters on a photo.
13. C2 Shapes and parameters by hand — MNIST table, total 93,322.
14. C3 PyTorch model, logits; C4 split 55,000 / 5,000 / 10,000; C5 training loop (zero_grad, forward, loss, backward, step), train()/eval() and dropout; C6 test; C7 learned filters.
15. D1–D5 Cats vs Dogs (2,000 train, 1,000 validation, no test set), baseline CNN, overfitting diagnosis, augmentation (rotation ±40°, shift ±20%, zoom ±20%, horizontal flip) on training images only.
16. E1–E6 Transfer learning, VGG16 (13 conv in 5 blocks + 3 dense), 150 → 75 → 37 → 18 → 9 → 4, 8,192 features; feature extraction (frozen base, features stored once, no augmentation); freezing; fine-tuning block 5 with lr 1e-5; comparison table.

## Formulas (verbatim, as TeX)
- 1D: `y[i] = \sum_{k=0}^{m-1} x[\,i\,s + k\,]\; w^r[k]` — A2
- 2D: `Y[i, j] = \sum_{k_1} \sum_{k_2} X^p[\,i\,s + k_1,\ j\,s + k_2\,]\; W^r[k_1, k_2]` — B2
- Output size: `o = \left\lfloor \frac{n + 2p - m}{s} \right\rfloor + 1` — A5
- Same padding: `p = (m - 1)/2` — A4
- Conv params: `(m \cdot m \cdot C_{in} + 1) \cdot C_{out}`; dense: `(d_{in} + 1) \cdot d_{out}` — C1

## Worked examples (exact numbers)
- A1 dense vs conv: 34,560,512 vs 896 (→ dense-vs-conv)
- A2: y = [7, 9, 8] (→ conv1d-stride2, conv1d-walk, conv1d-code)
- A3: cross-correlation at stride 1 = [5.75, 9, 7.25, 7.5, 8]; with the flipped filter = convolution [7, 7.25, 9, 6.75, 8] (→ xcorr-first, xcorr-flipped)
- A4: valid 6, same 8, full 10 outputs (→ pad-modes)
- A5 table: (10,5,2,1)→10, (8,4,0,2)→3, (8,5,4,1)→12, (10,3,0,2)→4 (→ outsize-*)
- B2: [[4.6,1.6],[7.5,2.9]]; top-left 0.4·2 + 0.3·1 + 0.7·5 = 4.6; X_TRY → [[25,24],[28,25]] (→ conv2d-*)
- B5: pooled X1 = pooled X2 = [[255,125,170],[255,150,150],[70,200,95]]; X1 shifted one column → [[100,255,170],[255,255,150],[70,200,100]] (→ pool-*)
- B6: nn.Conv2d with W as written → [[5.9,2.1],[4.6,4]] (→ conv2d-xcorr)
- C1: 5 filters 3×3×3 → (27+1)·5 = 140 parameters (→ params-conv-photo)
- C2: 320, 18,496, 36,928, 36,928, 650; total 93,322 (→ mnist-table, mnist-walk, mnist-code, params-code)
- D3: 150 → 148 → 74 → 72 → 36 → 34 → 17 → 15 → 7; 7·7·128 = 6,272 (→ catsdogs-table)
- E2/E4/E6: 8,192 features; base 14,714,688; head 2,097,665; fine-tuning ≈ 9.2 M = 9,177,089 (→ vgg-*)

## Conventions & ambiguities
- "Convolution" in hand calculations flips the filter (A2, B2). PyTorch layers and the feature-map demo use cross-correlation; every question says which one it uses.
- In the 2D walk only the non-zero products are written, as the notebook does ("only three products are non-zero").
- Pooling uses stride = size (the nn.MaxPool2d default).
- The feature-map demo (edge dataset) uses cross-correlation, like nn.Conv2d and the notebook's `conv_layer`.
- The training-curve datasets (noaug, aug) are **illustrative**, not notebook output (the notebook has none). They follow D3/D5's description and the slide reference results (70–73% vs 83–85%). The narration says so.

## Errata
- None found.

## Beyond the slides
- The 6×6 vertical-edge image and its feature map (edge dataset), to show what a feature map means with small numbers.
- The rice-leaf application case and its CNN (leaf dataset).
- The illustrative training curves (see conventions).
- The math section "best-epoch" writes the notebook's `summarize_runs` (lowest validation loss) as a loop.

## Skill map
- conv-why: A1 · conv1d: A2 · cross-correlation: A3, B6 · padding-stride: A4, A5, B3 · conv2d: B2, B4 · pooling: B5 · cnn-shapes: C1–C3, D3 · overfit-augment: C4–C5, D1–D5 · transfer: E1–E6
