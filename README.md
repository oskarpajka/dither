# Dither

A generative gradient dithering tool that runs in the browser. Creates ordered-dither gradient patterns with animated warp layers.

## Features

- Real-time ordered dithering with configurable cell size
- Layered gradient bands with per-layer color palettes
- Animated warp effects with speed, depth, and loop controls
- WebGL2 GPU acceleration with CPU fallback
- Random palette generation with seed control
- Aspect ratio and resolution controls
- PNG export and WebM video export
- Dark mode

## Usage

Open `index.html` in a modern browser, or serve the directory with any static file server.

### Controls

- **Pixel Size** - Size of each dither cell (1-15px)
- **Layers** - Number of gradient layers (2-8)
- **Warp** - Animation warp intensity
- **Colors** - Number of colors in the palette
- **Aspect Ratio** - Free, 1:1, 4:3, 16:9, 3:2, or custom
- **Resolution** - Fixed output resolution (0 = auto)
- **Animation** - Toggle animation, adjust speed, depth, framerate, loop duration
- **Seed** - Random or fixed seed for reproducible patterns

### Export

- **PNG** - Downloads the current frame as a PNG
- **Video** - Exports animation as a WebM video with configurable resolution, framerate, and bitrate

## Browser Support

Requires a modern browser with Canvas 2D support. WebGL2 is used when available for faster rendering.

## License

MIT
