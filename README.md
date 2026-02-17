# Project HAM

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8DB)](https://tauri.app/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![Rust](https://img.shields.io/badge/Rust-stable-orange.svg)](https://www.rust-lang.org/)

Project HAM is a desktop application for managing Hydra and Steam achievements, now fully ported to a Rust/Tauri architecture.

## What You Can Do

- Manage and track Hydra and Steam achievements in a desktop app
- Work with both Hydra and Steam achievements directly in your workflow
- Browse games, open their achievement lists, and update progress
- Export achievement data when needed

## Prerequisites

- Node.js 18+
- npm
- Rust (stable toolchain)
- Tauri system dependencies for your OS

## Development

```bash
# Install dependencies
npm install

# Run desktop app in development mode (frontend + Tauri)
npm run tauri:dev
```

## Build

```bash
# Build frontend assets
npm run build

# Build desktop bundles with Tauri
npm run tauri:build
```

Build outputs are generated under `src-tauri/target/` (Tauri bundles) and `dist/` (frontend assets).

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes
4. Push to your branch
5. Open a pull request

## License

Project HAM is licensed under the GNU General Public License v3.0 (GPL-3.0). See `LICENSE` for details.




