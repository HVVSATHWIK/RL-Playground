# NN Playground

An interactive web application for visualizing and understanding neural networks and reinforcement learning — entirely in the browser. No backend, no external ML libraries. All computations (backpropagation, Q-learning) happen live in your browser using pure TypeScript.

**[Live Demo](https://debilla.github.io/nn-playground/)**

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [1. Neural Network Visualizer](#1-neural-network-visualizer)
  - [2. Architecture Visualizer](#2-architecture-visualizer)
  - [3. Reinforcement Learning Playground](#3-reinforcement-learning-playground)
  - [4. Robot Fight Club](#4-robot-fight-club)
  - [5. Paper Explorer](#5-paper-explorer)
- [How It Works Under the Hood](#how-it-works-under-the-hood)
  - [Neural Network Engine](#neural-network-engine)
  - [Reinforcement Learning Engine](#reinforcement-learning-engine)
- [Project Architecture](#project-architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Deployment](#deployment)

---

## Overview

NN Playground is split into three interactive sections, each targeting a different aspect of machine learning education:

| Section | What it teaches | What's happening |
|---------|----------------|-----------------|
| **Neural Network** | How networks learn to classify data | Real backpropagation training on toy 2D datasets |
| **Architecture** | How model layers stack together | Shape inference, parameter counting, layer types |
| **RL Playground** | How agents learn from rewards | Real Q-learning/SARSA on an interactive grid world |
| **Fight Club** | Multi-agent RL, emergent behavior | Two Q-learning robots learn combat from scratch |
| **Paper Explorer** | AI-powered paper understanding | Upload a PDF, get interactive visualizations via LLM |

Everything runs client-side. The neural network math is implemented from scratch in ~200 lines of TypeScript — no TensorFlow, no PyTorch, no external ML dependencies.

---

## Features

### 1. Neural Network Visualizer

This is a TensorFlow-Playground-style experience where you configure a small neural network, pick a 2D dataset, and watch it learn in real time.

#### What you see

- **Network graph (SVG)** — Neurons arranged in columns (input → hidden → output). Each neuron is colored by its activation value (blue = low, orange = high). Connections between neurons are colored and sized by their weight (blue = positive, orange = negative, thicker = larger magnitude).

- **Decision boundary (Canvas)** — A 200×200 pixel heatmap. For every point in 2D space, the network's output is computed and colored. Blue regions = class 0, orange regions = class 1. Training data points are overlaid as dots. Watch the boundary form as the network learns.

- **Loss chart (SVG)** — Tracks MSE loss over training epochs. Should trend downward as the network improves. If it plateaus or oscillates, the network is struggling.

#### What you can configure

| Control | Options | Effect |
|---------|---------|--------|
| **Dataset** | XOR, Circle, Spiral, Gaussian | Changes the training data distribution |
| **Hidden Layers** | 1-4 layers, various neuron counts | More layers = more capacity for complex patterns |
| **Activation** | ReLU, Sigmoid, Tanh | Changes the non-linearity applied at each neuron |
| **Learning Rate** | 0.0001 to 1.0 (log scale) | How aggressively weights update each step |

#### Training controls

- **Play** — Runs continuous training (5 epochs per animation frame)
- **Step** — Advances exactly 1 epoch
- **Reset** — Reinitializes the network with random weights (same architecture)

#### The datasets explained

- **XOR** — The classic problem that proved single-layer perceptrons aren't enough. Points in opposite quadrants share a class. Requires at least 1 hidden layer.
- **Circle** — Inner ring vs outer ring. Tests whether the network can learn radial decision boundaries. Works well with 1-2 hidden layers.
- **Spiral** — Two interleaved spirals. This is the hardest dataset — the boundary is highly non-linear. Needs 3+ hidden layers and patience.
- **Gaussian** — Two gaussian blobs with slight overlap. Nearly linearly separable — even a simple network solves it quickly.

#### What's actually happening

Each training step:
1. **Forward pass** — Every data point flows through the network. Each neuron computes `activation(weights · inputs + bias)`.
2. **Loss calculation** — MSE between the network's output and the true label.
3. **Backward pass (backpropagation)** — The error gradient flows backward through each layer. For each weight, the algorithm computes: "how much did this weight contribute to the error?"
4. **Weight update** — Each weight is nudged in the direction that reduces the error: `weight -= learningRate × gradient`.

The decision boundary updates after every epoch, so you can literally watch the network carve out classification regions in real time.

---

### 2. Architecture Visualizer

This section lets you explore and build neural network architectures visually — like a graphical `model.summary()` from Keras.

#### What you see

- **Architecture diagram (SVG)** — A vertical top-to-bottom flow diagram. Each layer is a colored block showing its type, output shape, activation function, and parameter count. Arrows show data flow between layers.

- **Summary table** — A Keras-style table listing every layer with its type, output shape, and parameter count. Shows total parameters and estimated model size at the bottom.

#### Layer type color coding

| Color | Layer Type | Description |
|-------|-----------|-------------|
| Indigo | **Input** | Where data enters. Shape depends on your data. |
| Blue | **Dense** | Fully connected. Every neuron connects to every neuron in the previous layer. Most parameters live here. |
| Green | **Conv2D** | Convolutional. Scans input with small filters to detect spatial patterns (edges, textures). Far fewer parameters than Dense for image data. |
| Purple | **MaxPool2D** | Downsamples by taking the max value in each window. Reduces spatial dimensions. Zero learnable parameters. |
| Amber | **Flatten** | Reshapes multi-dimensional data into a 1D vector. Required before Dense layers when coming from Conv layers. |
| Gray | **Dropout** | Randomly zeros neurons during training to prevent overfitting. Zero parameters. |
| Pink | **BatchNorm** | Normalizes outputs for faster, more stable training. |
| Red | **Output** | Final classification layer. |

#### Preset architectures

**Simple Feedforward**
```
Input [784] → Dense [128, relu] → Dense [64, relu] → Output [10, softmax]
Total params: 109,386
```
A basic network for MNIST digit classification. The input is a flattened 28×28 grayscale image. Two hidden layers progressively compress the representation before the 10-class output.

**Simple CNN**
```
Input [28,28,1] → Conv2D [26,26,32] → MaxPool [13,13,32] → Conv2D [11,11,64] 
→ MaxPool [5,5,64] → Flatten [1600] → Dense [128, relu] → Output [10, softmax]
Total params: 228,234
```
A convolutional architecture. Conv layers detect spatial features, pooling layers downsample, then Dense layers classify. This is the pattern behind most image classifiers.

**LeNet-5**
```
Input [32,32,1] → Conv2D [28,28,6] → MaxPool [14,14,6] → Conv2D [10,10,16]
→ MaxPool [5,5,16] → Flatten [400] → Dense [120, tanh] → Dense [84, tanh] → Output [10, softmax]
Total params: 61,706
```
Yann LeCun's 1998 architecture — one of the first successful CNNs. Uses tanh activations (sigmoid-family) which were standard before ReLU became dominant. Smaller and simpler than modern CNNs but historically groundbreaking.

#### Shape inference

When you edit a layer's parameters (e.g., change Conv2D filters from 32 to 64), all downstream shapes recalculate automatically:

- **Dense**: `output = [units]`, params = `input_size × units + units`
- **Conv2D**: `output = [floor((H - kernel + 2×padding) / stride) + 1, W', filters]`, params = `filters × (kernel² × input_channels) + filters`
- **MaxPool2D**: `output = [H/pool, W/pool, channels]`, params = 0
- **Flatten**: `output = [H × W × C]`, params = 0

#### Editing

- Click any layer in the diagram to select it
- Edit its parameters in the sidebar (units, filters, kernel size, activation, etc.)
- Add new layers with the dropdown + "Add" button
- Remove layers with the trash icon
- All shapes and parameter counts update in real time

---

### 3. Reinforcement Learning Playground

An interactive grid world where a Q-learning or SARSA agent learns to navigate from start to goal through trial and error.

#### What you see

- **Grid world (Canvas)** — A 6×6 grid. The agent (yellow circle with eyes) moves between cells. Cells can be empty (dark), walls (gray, impassable), goals (green, +10 reward), or pits (red, -10 reward).

- **Q-value triangles** — Each empty cell shows 4 colored triangles (one per direction: up/right/down/left). Blue = positive Q-value (good direction), orange = negative (bad direction). The numbers show the actual Q-values. These fill in gradually as the agent explores.

- **Policy arrows** — Cyan arrows in each cell point in the direction of the best action (highest Q-value). This is the "greedy policy" — what the agent would do if it always exploited its knowledge.

- **State values** — Toggle this to color cells by their maximum Q-value. Green = valuable cells (close to goal), red = dangerous cells (near pits).

- **Episode stats chart** — Plots total reward per episode. The gray line is raw data (noisy because of exploration). The cyan line is a 20-episode moving average — this should trend upward as the agent learns.

- **Algorithm info panel** — Shows the Q-update equation with the actual values from the last step. Lets you see the math happening in real time.

#### How Q-Learning works

The agent maintains a **Q-table** — a number for every (state, action) pair. In our 6×6 grid with 4 actions, that's 6×6×4 = 144 values, all starting at zero.

Each step:

1. **Choose action** (epsilon-greedy):
   - With probability ε: pick a random action (explore)
   - Otherwise: pick the action with the highest Q-value (exploit)

2. **Take action**: Move in that direction (bouncing off walls/boundaries)

3. **Observe reward**: +10 for goal, -10 for pit, -0.1 for empty cells (encourages shorter paths)

4. **Update Q-value**:
   ```
   Q(s, a) ← Q(s, a) + α × [r + γ × max Q(s', a') - Q(s, a)]
   ```
   - `α` (alpha) = learning rate — how fast Q-values change
   - `γ` (gamma) = discount factor — how much future rewards matter
   - `max Q(s', a')` = best possible value from the next state

5. **Episode ends** when the agent reaches the goal, falls in a pit, or exceeds 200 steps. Position resets to start, but Q-values persist.

Over hundreds of episodes, high rewards propagate backward from the goal through the Q-table. Cells near the goal get good values first, then the knowledge gradually spreads to distant cells.

#### Q-Learning vs SARSA

| | Q-Learning | SARSA |
|---|-----------|-------|
| **Type** | Off-policy | On-policy |
| **Update rule** | Uses `max Q(s', a')` — best possible next action | Uses `Q(s', a')` — the action actually taken next |
| **Behavior** | More aggressive, finds optimal path faster | More conservative, avoids risky areas |
| **Near pits** | May learn a path that passes close to pits (optimal but risky) | Learns to keep distance from pits (safer but longer) |

Try running Q-Learning for ~200 episodes, then switch to SARSA and reset the agent. Watch how the learned policy differs, especially near the pit.

#### Hyperparameters explained

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| **Epsilon (ε)** | 0.30 | 0 – 1 | Exploration rate. High = more random moves. Set to 0 after training to see the pure learned policy. |
| **Alpha (α)** | 0.10 | 0.01 – 1 | Learning rate. How fast Q-values update. High = fast but noisy. Low = stable but slow. |
| **Gamma (γ)** | 0.95 | 0 – 1 | Discount factor. High = agent plans far ahead. Low = agent is short-sighted, only cares about immediate rewards. |
| **Speed** | 5 | 1 – 200 | Steps per animation frame. Crank to 200 for fast training, set to 1 to watch individual moves. |

#### Interacting with the grid

- **Click any cell** to cycle its type: empty → wall → pit → goal → empty
- The start position (top-left) cannot be changed
- After editing the grid, the agent will adapt its policy to the new layout
- Try creating mazes or multiple pits to see how the agent handles complex environments

---

### 4. Robot Fight Club

Two Q-learning robots fight in a 2D arena and learn combat strategies from scratch through trial and error. This demonstrates multi-agent RL where both agents learn simultaneously — creating an arms race of evolving strategies.

#### Combat system

- **6 actions per robot**: move left/right, punch (close range, 10 dmg, fast), kick (longer range, 15 dmg, slow), block (80% damage reduction), dodge (quick backstep)
- 100 HP per robot, cooldowns on attacks, stun on hit, knockback physics
- Simultaneous action resolution — no first-mover advantage
- Damage numbers float up on hits

#### Training phases

| Preset | Epsilon | Alpha | Gamma | Speed | Purpose |
|--------|---------|-------|-------|-------|---------|
| **Learn Fast** | 0.5 | 0.2 | 0.9 | 1000 | High exploration, discover basic moves |
| **Refine** | 0.1 | 0.1 | 0.95 | 1000 | Less exploration, optimize strategies |
| **Showtime** | 0.02 | 0.05 | 0.95 | 1 | Watch trained robots fight in slow motion |

#### Expert pre-training (imitation learning)

Toggle "Start with expert knowledge" to pre-fill Q-tables with 300 episodes of expert-vs-expert play using a hardcoded heuristic (block when attacked, punch when close, kick at medium range). The robots start competent from round 1, then RL improves beyond the expert.

#### Showtime mode

When Showtime is active:
- **Match scoreboard** on the canvas shows hits landed per robot for the current fight
- **Big HP bars** for both fighters
- **2000 max steps** per round (vs 500 during training) for longer, more exciting matches
- **Betting panel** appears on the right sidebar — add bets with names, pick Red/Blue, set amounts. Bets settle automatically when the round ends (winners get their amount, losers lose it, draws return bets)
- **Screen recording** — click the Rec button to record the fight as a `.webm` video

#### What the robots learn

- Early rounds (~0-50): Random flailing, accidental hits
- Mid training (~50-500): Discover that closing distance + punching works, start blocking
- Late training (~500-2000): Combo patterns emerge — approach, feint, counter-attack, dodge-and-punish
- The two agents develop complementary strategies in an adversarial arms race

---

### 5. Paper Explorer

Upload a research paper (PDF) and get AI-generated interactive visualizations, step-by-step explanations, and quizzes. The AI reads the paper, identifies key findings, and creates visualizations automatically.

#### AI Providers

| Provider | Cost | Notes |
|----------|------|-------|
| **Browser AI (WebLLM)** | Free | Runs Phi-3.5-mini locally via WebGPU (~1.5GB download, cached) |
| **OpenRouter** | Varies | 200+ models with one API key |
| **Gemini** | Free tier | Google's Gemini 2.0 Flash |
| **Claude** | Paid | Best quality analysis |
| **OpenAI** | Paid | GPT-4o-mini |
| **Custom endpoint** | - | Ollama, vLLM, LM Studio, or any OpenAI-compatible API |

#### What it generates

For each paper, the AI creates 4-8 sections, each with:

- **Visualization** — auto-selected from 6 types: architecture diagram, comparison chart, line/bar chart, flowchart, data table, timeline
- **Key insight** — one-sentence takeaway highlighted in amber
- **Interactive elements** — toggles, steppers to walk through processes
- **Quiz question** — multiple choice with explanation
- **Glossary** — key terms defined in the sidebar

#### Progress tracking

- Section completion tracked with progress bar
- Quiz scores tracked across sections
- Navigate freely between sections or follow the guided order

---

## How It Works Under the Hood

### Neural Network Engine

The NN math is implemented from scratch in `src/lib/math/` and `src/lib/nn/`:

#### Matrix operations (`matrix.ts`)

A simple `Matrix` class supporting the operations needed for neural networks:

```
Matrix.multiply(a, b)    — Matrix multiplication (for layer forward pass)
Matrix.add(a, b)         — Element-wise addition (for adding biases)
Matrix.subtract(a, b)    — Element-wise subtraction (for weight updates)
Matrix.hadamard(a, b)    — Element-wise multiplication (for gradient computation)
Matrix.transpose(m)      — Transpose (for backprop gradient flow)
Matrix.elementwise(m, fn) — Apply function to each element (for activations)
Matrix.scale(m, s)       — Scalar multiplication (for learning rate)
```

#### Activation functions (`activations.ts`)

Each activation function provides both its forward function and its derivative (needed for backpropagation):

- **ReLU**: `f(x) = max(0, x)`, `f'(x) = x > 0 ? 1 : 0` — Most common in modern networks. Fast but can "die" (output permanently 0).
- **Sigmoid**: `f(x) = 1/(1+e^(-x))`, `f'(x) = f(x)(1-f(x))` — Smooth 0-1 output. Suffers from vanishing gradients in deep networks.
- **Tanh**: `f(x) = tanh(x)`, `f'(x) = 1 - tanh²(x)` — Like sigmoid but centered at 0 (-1 to 1). Often works better for hidden layers.

#### Layer forward & backward pass (`layer.ts`)

Each layer stores its weights, biases, and caches intermediate values for backpropagation:

**Forward pass:**
```
raw = weights × input + biases
output = activation(raw)
```

**Backward pass (called with the gradient from the next layer):**
```
1. activationGrad = activation.derivative(raw)
2. delta = outputGradient ⊙ activationGrad          (element-wise multiply)
3. weightGrad = delta × input^T                       (how much each weight contributed)
4. inputGrad = weights^T × delta                      (gradient to pass to previous layer)
5. weights -= learningRate × weightGrad               (update weights)
6. biases -= learningRate × delta                     (update biases)
```

Weight initialization uses **Xavier initialization**: `scale = sqrt(2 / (inputSize + outputSize))`. This keeps activations from exploding or vanishing in the early stages of training.

#### Training loop (`network.ts`)

One training epoch:
1. For each data point, run forward pass through all layers
2. Compute MSE loss between output and target
3. Compute output gradient: `2 × (output - target)`
4. Backpropagate through layers in reverse order
5. Each layer updates its own weights during backprop
6. Return average loss across all data points

### Reinforcement Learning Engine

The RL system is in `src/lib/rl/`:

#### Grid world (`gridWorld.ts`)

A deterministic grid environment:
- **State space**: (row, col) positions on the grid
- **Action space**: 4 discrete actions (up, right, down, left)
- **Transitions**: Deterministic — actions move in the expected direction. Hitting a wall or boundary keeps the agent in place.
- **Rewards**: +10 (goal), -10 (pit), -0.1 (empty cell — small penalty to encourage shorter paths)
- **Terminal states**: Goal and pit cells end the episode

#### Q-Learning agent (`qLearning.ts`)

Maintains a Q-table: `number[height][width][4]` — one value for each (state, action) pair.

```
Q(s, a) ← Q(s, a) + α × [r + γ × max_a' Q(s', a') - Q(s, a)]
                                    ↑ this is what makes it "off-policy"
                                    uses the BEST possible next action
```

The `max` makes Q-Learning off-policy — it learns about the optimal policy even while following an exploratory one.

#### SARSA agent (`sarsa.ts`)

Same Q-table structure, different update:

```
Q(s, a) ← Q(s, a) + α × [r + γ × Q(s', a') - Q(s, a)]
                                    ↑ this is what makes it "on-policy"
                                    uses the ACTUAL next action taken
```

Because SARSA uses the actual next action (which might be random due to epsilon), it learns a more conservative policy that accounts for the agent's own exploration behavior.

---

## Project Architecture

```
src/
├── App.tsx                              # Root component with tab navigation
├── main.tsx                             # Entry point
├── index.css                            # Tailwind CSS imports
│
├── components/
│   └── InfoBanner.tsx                   # Reusable educational info/tip/legend banners
│
├── lib/                                 # Pure logic (no React dependencies)
│   ├── math/
│   │   ├── matrix.ts                    # Matrix class with multiply, transpose, etc.
│   │   ├── activations.ts              # sigmoid, relu, tanh + derivatives
│   │   └── loss.ts                     # MSE loss + derivative
│   ├── nn/
│   │   ├── network.ts                  # NeuralNetwork: forward, train, getSnapshot
│   │   ├── layer.ts                    # Layer: forward pass, backpropagation
│   │   └── datasets.ts                # XOR, circle, spiral, gaussian generators
│   └── rl/
│       ├── gridWorld.ts                # Grid environment: states, actions, rewards
│       ├── qLearning.ts               # Q-learning agent with epsilon-greedy
│       └── sarsa.ts                    # SARSA agent (on-policy variant)
│
├── stores/                              # Zustand state management
│   ├── nnStore.ts                      # NN training state, network config, loss history
│   ├── archStore.ts                    # Architecture editor state, presets, shape inference
│   └── rlStore.ts                      # RL state, agent, grid, episode tracking
│
├── features/
│   ├── nn-visualizer/                   # Feature 1: Neural Network Visualizer
│   │   ├── NNVisualizer.tsx            # Page layout + training loop (requestAnimationFrame)
│   │   ├── ControlPanel.tsx            # Dataset, layers, activation, learning rate controls
│   │   ├── TrainingControls.tsx        # Play/pause/step/reset + epoch/loss display
│   │   ├── NetworkCanvas.tsx           # SVG network graph (neurons + weighted connections)
│   │   ├── DecisionBoundary.tsx        # Canvas 200×200 heatmap of network output
│   │   └── LossChart.tsx              # SVG line chart of loss over epochs
│   │
│   ├── arch-visualizer/                 # Feature 2: Architecture Visualizer
│   │   ├── ArchVisualizer.tsx          # Page layout with preset selector
│   │   ├── ArchDiagram.tsx             # SVG vertical layer diagram with arrows
│   │   ├── ModelEditor.tsx             # Add/remove/edit layers
│   │   └── SummaryTable.tsx            # Keras-style model.summary() table
│   │
│   └── rl-playground/                   # Feature 3: RL Playground
│       ├── RLPlayground.tsx            # Page layout + agent step loop (requestAnimationFrame)
│       ├── GridCanvas.tsx              # Canvas grid with Q-values, policy arrows, agent
│       ├── RLControls.tsx              # Algorithm, speed, hyperparameters, viz toggles
│       ├── EpisodeStats.tsx            # Episode reward chart with moving average
│       └── AlgorithmInfo.tsx           # Live Q-update equation + parameter reference
```

### Key design decisions

- **SVG for network/architecture graphs** — Integrates naturally with React, supports interactivity (hover, click) per element, scales cleanly.
- **Canvas for heatmaps and grid** — Decision boundary renders 40,000 pixels per frame; Canvas is the right tool for pixel-level rendering. Grid world also uses Canvas for per-frame agent animation.
- **Zustand for state** — Lightweight (~1KB), works outside React (important for `requestAnimationFrame` training loops), zero boilerplate.
- **No external ML libraries** — The entire NN engine is ~200 lines. Keeps the bundle at ~250KB (gzipped ~78KB). Also educational — users can read the source to understand the math.
- **requestAnimationFrame loops** — Both the NN trainer and RL agent use rAF loops that read directly from Zustand (outside React render cycle) for smooth 60fps updates without re-render overhead.

---

## Tech Stack

| Dependency | Purpose |
|-----------|---------|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool + dev server |
| Tailwind CSS 4 | Utility-first styling |
| Zustand | State management |
| Lucide React | Icons |
| pdfjs-dist | PDF text extraction |
| @mlc-ai/web-llm | In-browser LLM (WebGPU) |

**Core ML from scratch.** All neural network math (matrix operations, backpropagation, activation functions) and RL algorithms (Q-learning, SARSA) are implemented from scratch. The Paper Explorer uses `pdfjs-dist` for PDF parsing and optionally `@mlc-ai/web-llm` for in-browser LLM inference.

---

## Getting Started

```bash
# Clone
git clone git@github.com:deBilla/nn-playground.git
cd nn-playground

# Install
npm install

# Dev server
npm run dev
```

Open http://localhost:5173/ in your browser.

### Build for production

```bash
npm run build    # Output in dist/
npm run preview  # Preview the production build locally
```

---

## Deployment

The app auto-deploys to GitHub Pages on every push to `main` via the workflow in `.github/workflows/deploy.yml`.

The workflow:
1. Checks out the code
2. Installs dependencies (`npm ci`)
3. Builds the project (`npm run build`)
4. Uploads the `dist/` directory as a GitHub Pages artifact
5. Deploys to https://debilla.github.io/nn-playground/

The Vite config sets `base: '/nn-playground/'` so all asset paths are correct under the GitHub Pages subpath.
