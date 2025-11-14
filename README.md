# SD Reality Fractal Creation

A self-contained, universal **fractal time dynamics engine** using pure math and Three.js. Features exponential light growth, 3D wave planes, reflection mechanics, temporal ray dispersion, and full time wrapping.

**NO BRAIN DATA. NO qEEG. JUST LIGHT + MATH.**

## ✨ Features

- 🌊 **3D Wave Planes**: Sinusoidally deformed planes with exponential intensity
- ⚡ **Exponential Light Growth**: Intensity grows as r^n (r=3, n=time step)
- 🔴 **Reflection at I_max = 81**: When intensity reaches 81, reflects and disperses
- 💫 **Temporal Ray Dispersion**: Splits into 3 rays (x, y, z) when I_max is exceeded
- ♻️ **Energy Recycling**: Energy cap at 13 triggers recycling every 3 steps
- 🔄 **Time Wrapping**: Continuous time evolution with periodic resets
- 🎮 **Interactive Controls**: OrbitControls for camera manipulation
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- 🚀 **Zero Dependencies**: Uses CDN imports, no build process needed

## 🚀 Quick Start

### Option 1: Clone and Run

```bash
git clone <repository-url>
cd sd-reality-fractal-creation
npx serve .
```

Then open `http://localhost:3000` in your browser.

### Option 2: Download and Open

1. Download the repository files
2. Open `index.html` in your browser
3. The fractal engine will start automatically

### Option 3: Use as Module

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>My Fractal Demo</title>
    <style>
        #container { width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <div id="container"></div>
    <script type="importmap">
        {
            "imports": {
                "three": "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js",
                "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/"
            }
        }
    </script>
    <script type="module">
        import { FractalTimeEngine } from './demo.js';
        
        const demo = new FractalTimeEngine('container', {
            r: 3,
            I_max: 81,
            E_cap: 13,
            timeSpeed: 0.01
        });
    </script>
</body>
</html>
```

## 🎮 Controls

| Control | Action |
|---------|--------|
| **⏸ Pause** | Pause/resume the animation |
| **🔄 Reset** | Reset time to 0 and camera to default position |
| **📐 Wireframe** | Toggle between solid and wireframe mode |
| **ℹ️ Info** | Show/hide real-time statistics |
| **Mouse Drag** | Rotate camera around scene |
| **Mouse Wheel** | Zoom in/out |
| **Right Click + Drag** | Pan camera |

## ⚙️ Configuration

Customize the fractal engine by passing options to the constructor:

```javascript
const demo = new FractalTimeEngine('container', {
    // Base parameters
    r: 3,                    // Base for exponential growth
    I_max: 81,               // Maximum intensity (r^4 = 3^4 = 81)
    E_cap: 13,               // Energy cap for recycling
    lambda_decay: 4,         // Decay constant
    
    // Animation
    timeSpeed: 0.01,         // Time increment per frame
    
    // Plane settings
    planeSize: 2,            // Size of wave planes
    planeSegments: 32,       // Plane resolution (segments)
    
    // Camera settings
    cameraPosition: {        // Initial camera position
        x: 2,
        y: 3,
        z: 60
    }
});
```

### Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `r` | number | 3 | Base for exponential growth (r^n) |
| `I_max` | number | 81 | Maximum intensity before reflection |
| `E_cap` | number | 13 | Energy cap for recycling mechanism |
| `lambda_decay` | number | 4 | Decay constant |
| `timeSpeed` | number | 0.01 | Time increment per animation frame |
| `planeSize` | number | 2 | Size of the wave planes |
| `planeSegments` | number | 32 | Resolution of plane geometry |
| `cameraPosition` | object | {x:2, y:3, z:60} | Initial camera position |

## 🧮 Mathematical Model

### Core Equations

1. **Intensity Calculation**:
   ```
   I(n) = r^n * |sin(6πn)|
   ```
   Where `r = 3` and `n = floor(t * 3)`

2. **Wave Deformation**:
   ```
   w(x,y) = sin(6π * (x + y) / √2)
   ```
   Applied to plane vertices for 3D wave effect

3. **Reflection Condition**:
   ```
   if I >= I_max (81):
       excess = I - I_max
       currentI = I_max / 3
       → Disperse into 3 rays (x, y, z)
   ```

4. **Energy Recycling**:
   ```
   if n % 3 == 2:
       → Reduce opacity (recycle energy)
   ```

### Time Dynamics

- Time `t` increments continuously by `timeSpeed` (default: 0.01)
- Step `n = floor(t * 3)` determines which plane/laser to create
- Intensity oscillates with `sin(6πt)` modulation
- Full cycle resets every 3 steps (energy recycling)

## 🔧 Integration Examples

### Vanilla JavaScript

```javascript
import { FractalTimeEngine } from './demo.js';

const demo = new FractalTimeEngine('container', {
    r: 3,
    I_max: 81,
    timeSpeed: 0.02  // Faster animation
});
```

### With Custom Configuration

```javascript
const demo = new FractalTimeEngine('container', {
    r: 4,                    // Different base
    I_max: 256,              // 4^4 = 256
    E_cap: 20,               // Higher energy cap
    timeSpeed: 0.005,        // Slower animation
    planeSize: 3,            // Larger planes
    planeSegments: 64,       // Higher resolution
    cameraPosition: {
        x: 0,
        y: 0,
        z: 100
    }
});
```

### Programmatic Control

```javascript
// Access the demo instance
const demo = window.fractalDemo;

// Pause/resume
demo.isPlaying = false;  // Pause
demo.isPlaying = true;   // Resume

// Reset time
demo.t = 0;

// Change time speed
demo.config.timeSpeed = 0.02;

// Toggle wireframe
demo.wireframeMode = !demo.wireframeMode;
demo.planes.forEach(({ plane }) => {
    plane.material.wireframe = demo.wireframeMode;
});
```

## 📱 Mobile Support

The engine is fully responsive and includes:

- Touch-friendly controls
- Responsive UI layout
- Optimized rendering for mobile devices
- Proper viewport handling

## 🎯 Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🔧 Development

### Local Development

```bash
# Install dependencies (optional, uses CDN)
npm install

# Run local server
npm run dev
# or
npx serve .
```

### Project Structure

```
sd-reality-fractal-creation/
├── index.html          # Main HTML file
├── demo.js             # FractalTimeEngine class
├── package.json        # Package configuration
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

## 🐛 Troubleshooting

### Animation Not Starting

- Check browser console for errors
- Ensure Three.js CDN is accessible
- Verify container element exists

### Poor Performance

- Reduce `planeSegments` (try 16 or 8)
- Decrease `timeSpeed` for slower updates
- Use lower `planeSize` values

### Controls Not Working

- Ensure OrbitControls CDN is accessible
- Check that container has proper dimensions
- Verify mouse/touch events are not blocked

## 📄 License

MIT License - feel free to use in personal and commercial projects.

## 🙏 Credits

- **Three.js**: Amazing 3D library
- **ILOVETHREE**: Inspiration for project structure
- **Pure Math**: The foundation of this fractal engine

## 🔗 Links

- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [ILOVETHREE Repository](https://github.com/shinedark/ILOVETHREE)

---

**Made with ❤️ using pure math and light**

_If this project helped you, consider giving it a ⭐ on GitHub!_
