# FLUX Studio

A VS Code extension for FLUX-C guard constraint development — compile guard constraints to provably terminating FLUX-C bytecode with Coq-verified proof certificates.

## Features

- **GUARD Language Support** — syntax highlighting, bracket matching, auto-indent
- **Compile to FLUX-C** — `Ctrl+Shift+F5` compiles the active `.guard` file to FLUX-C assembly
- **Generate Proof Certificates** — `Ctrl+Shift+F6` generates a signed Coq proof certificate
- **Real-time Compilation** — connects to `flux-certify` backend at `localhost:5000`

## Installation

```bash
# From source
code --install-extension flux-studio-0.1.0.vsix

# Or package it
npx vsce package
code --install-extension flux-studio-*.vsix
```

## Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `FLUX: Compile to FLUX-C` | `Ctrl+Shift+F5` | Compile guard constraint to bytecode |
| `FLUX: Generate Proof Certificate` | `Ctrl+Shift+F6` | Generate signed proof certificate |

## Prerequisites

- **FLUX Certify backend** running on `localhost:5000`

```bash
pip install flux-certify
flux-certify serve  # starts backend on :5000
```

## Writing Guard Constraints

Create a `.guard` file:

```
battery_temp in [15, 55] with priority HIGH
sonar_frequency in [10, 50] when depth < 100
deceleration in [0.1, 0.8] when speed > 5
```

Press `Ctrl+Shift+F5` to compile. The extension opens a new tab with FLUX-C assembly.

## The FLUX-C Safety Guarantee

FLUX-C is **Turing-incomplete** by design:
- No backward jumps (all control flow is forward-only)
- Bounded call stack (MAX_STACK=100, hardware enforced)
- **fluxc_terminates** — Coq-proven: all programs halt in bounded time

This is what makes FLUX-C suitable for DO-254 DAL A, ISO 26262 ASIL-D, and IEC 61508 SIL 3 safety-critical systems.

## Files

- `extension.js` — VS Code extension entry point
- `package.json` — extension manifest
- `guard.language-configuration.json` — language config
- `syntaxes/guard.tmLanguage.json` — TextMate grammar

## License

MIT — Cocapn Fleet (SuperInstance)