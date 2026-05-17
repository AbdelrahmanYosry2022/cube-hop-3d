# Cube Hop 3D

A browser-based Three.js prototype where a cube or Noor character hops across 3D tile levels, avoids hazards, reaches goals, and advances through stages.

## Run locally

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173
```

## Controls

- Arrow keys: move
- On-screen arrows: move
- `R`: restart current level
- `Restart` button: restart current level

## Notes

- The Noor model is included at `assets/noor-model.glb`.
- The Noor model is optimized with Meshopt geometry compression and WebP textures for faster loading.
- The model is currently a single mesh with no bones or animation clips, so motion is procedural.
- Audio is generated with the Web Audio API.
