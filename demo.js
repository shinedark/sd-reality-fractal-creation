import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Fractal Time Dynamics Engine
 * 
 * Features:
 * - Exponential light growth (r^n)
 * - 3D wave planes with sinusoidal deformation
 * - Reflection at I_max = 81
 * - Dispersion into 3 temporal rays (x, y, z)
 * - Energy cap at 13 → recycle
 * - Reset every 3 steps
 * - Full time wrapping
 */
export class FractalTimeEngine {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' 
            ? document.getElementById(containerId) 
            : containerId;
        
        if (!this.container) {
            throw new Error('Container element not found');
        }

        // Configuration
        this.config = {
            r: options.r || 3,
            I_max: options.I_max || 81, // r^4 = 3^4 = 81
            E_cap: options.E_cap || 13,
            lambda_decay: options.lambda_decay || 4,
            timeSpeed: options.timeSpeed || 0.01,
            planeSize: options.planeSize || 2,
            planeSegments: options.planeSegments || 32,
            cameraPosition: options.cameraPosition || { x: 30, y: 20, z: 50 },
            ...options
        };

        // State
        this.t = 0;
        this.energy = 0; // Start at 0, increment by 0.3
        this.energyDirection = 1; // 1 = expanding, -1 = contracting (self-consuming)
        this.planes = [];
        this.lasers = [];
        this.timeTexts = [];
        this.energySource = new THREE.Vector3(0, 0, 0);
        this.fractalBranches = [];
        this.isPlaying = true;
        this.wireframeMode = false;
        this.showInfo = false;

        // Initialize
        this.init();
        this.setupControls();
        this.animate();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(
            this.config.cameraPosition.x,
            this.config.cameraPosition.y,
            this.config.cameraPosition.z
        );

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Controls - OrbitControls is a 3D camera control system
        // It allows orbiting around a target point in 3D space
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5; // Closer zoom
        this.controls.maxDistance = 500; // Further zoom out
        this.controls.zoomSpeed = 1.2; // Faster zoom
        this.controls.enableZoom = true; // Enable mouse wheel zoom
        this.controls.enablePan = true; // Enable right-click pan
        this.controls.enableRotate = true; // Enable left-click rotate
        this.controls.target.set(0, 0, 0); // Orbit around energy source

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1, 100);
        pointLight.position.set(10, 10, 10);
        this.scene.add(pointLight);


        // Handle resize
        window.addEventListener('resize', () => this.handleResize());
    }


    createTimeText(timeValue, position) {
        // Create canvas for text texture - make it much larger
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const size = 1024; // Much larger size for crisp text
        canvas.width = size;
        canvas.height = size;

        // Fill with semi-transparent dark background for visibility
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, size, size);

        // Draw very large text - white
        const fontSize = 400;
        context.font = `bold ${fontSize}px Arial, sans-serif`;
        context.fillStyle = '#ffffff';
        context.strokeStyle = '#cccccc';
        context.lineWidth = 15;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        const text = timeValue.toFixed(2);
        context.strokeText(text, size / 2, size / 2);
        context.fillText(text, size / 2, size / 2);

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // Create sprite material
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0,
            depthTest: true,
            depthWrite: false
        });

        // Create sprite - make it MUCH larger
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(25, 25, 1); // Very large 3D size
        sprite.position.copy(position);
        
        // Add glow effect with additional sprite - white
        const glowMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.5,
            color: 0xffffff,
            blending: THREE.AdditiveBlending,
            depthTest: false
        });
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.set(30, 30, 1); // Even larger glow
        glow.position.copy(position);
        
        const group = new THREE.Group();
        group.add(glow); // Add glow first so main sprite is on top
        group.add(sprite);
        
        this.scene.add(group);
        
        return { sprite, glow, group, texture, material, glowMaterial, canvas };
    }

    createPlane(n) {
        const I = Math.pow(this.config.r, n) * Math.abs(Math.sin(6 * Math.PI * n));
        
        if (I < 0.1) return null;

        const geometry = new THREE.PlaneGeometry(
            this.config.planeSize,
            this.config.planeSize,
            this.config.planeSegments,
            this.config.planeSegments
        );

        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: this.wireframeMode,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        const plane = new THREE.Mesh(geometry, material);

        // Apply wave deformation
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const w = Math.sin(6 * Math.PI * (x + y) / Math.sqrt(2));
            
            positions.setX(i, x * I);
            positions.setY(i, y * I);
            positions.setZ(i, w * I);
        }
        positions.needsUpdate = true;

        plane.position.z = n * 6;
        this.scene.add(plane);

        // Create time text on the plane
        const timeTextPosition = new THREE.Vector3(
            plane.position.x,
            plane.position.y + I * 0.5 + 2, // Position above plane center
            plane.position.z
        );
        const timeText = this.createTimeText(this.t, timeTextPosition);
        timeText.planeZ = plane.position.z; // Track which plane it's on

        return { I, plane, n, timeText };
    }

    createLaser(n, I, direction = null) {
        // Hide laser lines - make them invisible
        return null;
    }

    createFractalBranch(startPos, endPos, energy, depth, maxDepth, interval) {
        if (depth > maxDepth || energy < 0.01) return [];

        const branches = [];
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const distance = direction.length();
        const normalizedDir = direction.normalize();

        // Create 3D wire/tube geometry - thickness based on energy
        const wireRadius = Math.max(0.02, Math.min(0.3, energy * 0.02 + depth * 0.01));
        const radialSegments = 8; // Lower segments for wire-like appearance
        
        // Create cylinder geometry for wire (height will be the distance)
        const geometry = new THREE.CylinderGeometry(
            wireRadius,  // top radius
            wireRadius,  // bottom radius
            distance,    // height (length of wire)
            radialSegments,
            1,
            false        // openEnded
        );

        // White color for all branches - wireframe for wire-like appearance
        const color = new THREE.Color(0xffffff);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: Math.max(0.5, 1 - depth * 0.15),
            wireframe: this.wireframeMode // Can toggle wireframe mode
        });

        const wire = new THREE.Mesh(geometry, material);
        
        // Position wire at midpoint between start and end
        const midPoint = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5);
        wire.position.copy(midPoint);
        
        // Orient wire along the branch direction
        // Cylinder default is along Y-axis, rotate to match branch direction
        const defaultDir = new THREE.Vector3(0, 1, 0); // Cylinder default orientation (Y-axis)
        const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultDir, normalizedDir);
        wire.quaternion.copy(quaternion);
        
        this.scene.add(wire);
        branches.push(wire);

        // Recursive subdivision: every 1/3 interval, create exponential expansion
        if (depth < maxDepth) {
            const subEnergy = energy / 3; // Divide energy among branches
            const subDistance = distance / 3;
            
            // Create branches at 1/3 and 2/3 points
            for (let i = 1; i <= 2; i++) {
                const t = i / 3;
                const midPoint = new THREE.Vector3().lerpVectors(startPos, endPos, t);
                
                // Exponential expansion: create branches in multiple directions
                const expansionFactor = Math.pow(this.config.r, depth * 0.5);
                const angles = [0, Math.PI * 2 / 3, Math.PI * 4 / 3];
                
                angles.forEach((angle) => {
                    const perpDir = new THREE.Vector3(
                        Math.cos(angle),
                        Math.sin(angle),
                        normalizedDir.z * 0.5
                    ).normalize();
                    
                    const expansionVec = new THREE.Vector3().copy(perpDir).multiplyScalar(subDistance * expansionFactor);
                    const newEnd = new THREE.Vector3().addVectors(midPoint, expansionVec);
                    
                    // Recursively create sub-branches
                    const subBranches = this.createFractalBranch(
                        midPoint,
                        newEnd,
                        subEnergy,
                        depth + 1,
                        maxDepth,
                        interval + 1
                    );
                    branches.push(...subBranches);
                });
            }
        }

        return branches;
    }

    generateFractalFromEnergySource(t, n) {
        // Use the accumulated energy (starts at 0, increments by 0.3)
        const totalEnergy = this.energy;
        
        // Calculate interval (every 1/3)
        const interval = Math.floor(n * 3);
        const intervalProgress = (n * 3) % 1;
        
        // Create main branches from energy source
        // Number of branches increases with energy (but capped)
        const numMainBranches = Math.min(3 + Math.floor(totalEnergy / 3), 9);
        const angleStep = (Math.PI * 2) / numMainBranches;
        
        const allBranches = [];
        
        for (let i = 0; i < numMainBranches; i++) {
            const angle = angleStep * i + intervalProgress * 0.5;
            // Distance scales with energy and shows expansion/contraction
            const distance = totalEnergy * (1 + interval * 0.3);
            
            const endPos = new THREE.Vector3(
                this.energySource.x + Math.cos(angle) * distance,
                this.energySource.y + Math.sin(angle) * distance,
                this.energySource.z + n * 6
            );
            
            // Create recursive fractal branches
            const branches = this.createFractalBranch(
                this.energySource,
                endPos,
                totalEnergy / numMainBranches,
                0,
                Math.min(4, Math.floor(totalEnergy / 5)), // Max depth increases with energy
                interval
            );
            
            allBranches.push(...branches);
        }
        
        return allBranches;
    }

    updateTimeText(timeText, timeValue, planeZ, I) {
        // Update canvas texture
        const canvas = timeText.canvas;
        const context = canvas.getContext('2d');
        
        // Clear and redraw with background
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw updated text - make it even larger - white
        const fontSize = 400;
        context.font = `bold ${fontSize}px Arial, sans-serif`;
        context.fillStyle = '#ffffff';
        context.strokeStyle = '#cccccc';
        context.lineWidth = 15;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        const text = timeValue.toFixed(2);
        context.strokeText(text, canvas.width / 2, canvas.height / 2);
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        // Update texture
        timeText.texture.needsUpdate = true;

        // Update position to stay on plane - keep it aligned with plane's Z position
        // Position it prominently above the plane
        timeText.group.position.set(
            0, // Center on X
            Math.max(I * 0.8 + 5, 5), // Position well above plane center, minimum height
            planeZ // Stay on the same Z as the plane
        );
        
        // Make sure sprites are visible
        timeText.sprite.visible = true;
        timeText.glow.visible = true;
    }

    update() {
        if (!this.isPlaying) return;

        const n = Math.floor(this.t * 3);
        
        // Energy starts at 0, increments by 0.3, expands and contracts
        // When energy reaches limit, it self-consumes (contracts)
        const energyIncrement = 0.3;
        const energyLimit = this.config.I_max || 81;
        
        // Update energy based on direction (expand or contract)
        if (this.energyDirection === 1) {
            // Expanding
            this.energy += energyIncrement;
            if (this.energy >= energyLimit) {
                this.energy = energyLimit;
                this.energyDirection = -1; // Start contracting (self-consuming)
            }
        } else {
            // Contracting (self-consuming)
            this.energy -= energyIncrement;
            if (this.energy <= 0) {
                this.energy = 0;
                this.energyDirection = 1; // Start expanding again
            }
        }
        
        const I = this.energy;
        let currentI = I;

        // Clear previous frame
        this.planes.forEach(({ plane, timeText }) => {
            this.scene.remove(plane);
            plane.geometry.dispose();
            plane.material.dispose();
            
            // Remove time text
            if (timeText) {
                this.scene.remove(timeText.group);
                timeText.texture.dispose();
                timeText.material.dispose();
                timeText.glowMaterial.dispose();
            }
        });
        this.lasers.forEach(laser => {
            if (laser) {
                this.scene.remove(laser);
                laser.geometry.dispose();
                laser.material.dispose();
            }
        });
        
        // Clear fractal branches
        this.fractalBranches.forEach(branch => {
            this.scene.remove(branch);
            branch.geometry.dispose();
            branch.material.dispose();
        });
        
        this.planes = [];
        this.lasers = [];
        this.timeTexts = [];
        this.fractalBranches = [];

        // Generate exponential fractals from single energy source
        // Every 1/3 interval, create exponential expansion
        const interval = Math.floor(n * 3);
        const intervalFraction = (n * 3) % 1;
        
        const fractalBranches = this.generateFractalFromEnergySource(this.t, n);
        this.fractalBranches = fractalBranches;

        // Create wave plane for visualization
        if (I < this.config.I_max) {
            const plane = this.createPlane(n);
            if (plane) {
                this.planes.push(plane);
                if (plane.timeText) {
                    this.timeTexts.push(plane.timeText);
                }
            }
        }

        // Update time texts to stay on planes
        this.planes.forEach(({ plane, timeText, I: planeI }) => {
            if (timeText) {
                this.updateTimeText(timeText, this.t, plane.position.z, planeI);
            }
        });

        // Energy conservation: recycle at intervals
        if (interval % 3 === 2) {
            // Energy recycling - reduce opacity of older branches
            this.fractalBranches.forEach((branch, idx) => {
                if (idx < this.fractalBranches.length / 3) {
                    branch.material.opacity *= 0.7;
                }
            });
        }

        // Update time
        this.t += this.config.timeSpeed;


        // Update info display
        this.updateInfo(I, n);
    }

    updateInfo(currentI, n) {
        if (!this.showInfo) return;

        const infoEl = document.getElementById('info');
        if (infoEl) {
            const iMaxEl = document.getElementById('iMax');
            const eCapEl = document.getElementById('eCap');
            const currentIEl = document.getElementById('currentI');
            const timeEl = document.getElementById('time');
            const planeCountEl = document.getElementById('planeCount');
            const laserCountEl = document.getElementById('laserCount');
            const branchCountEl = document.getElementById('branchCount');

            if (iMaxEl) iMaxEl.textContent = this.config.I_max;
            if (eCapEl) eCapEl.textContent = this.config.E_cap;
            if (currentIEl) currentIEl.textContent = currentI.toFixed(2);
            if (timeEl) timeEl.textContent = this.t.toFixed(2);
            if (planeCountEl) planeCountEl.textContent = this.planes.length;
            if (laserCountEl) laserCountEl.textContent = this.lasers.length;
            if (branchCountEl) branchCountEl.textContent = this.fractalBranches.length;
        }
    }

    setupControls() {
        // Play/Pause
        const playPauseBtn = document.getElementById('playPause');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.isPlaying = !this.isPlaying;
                playPauseBtn.textContent = this.isPlaying ? '⏸ Pause' : '▶ Play';
            });
        }

        // Reset
        const resetBtn = document.getElementById('reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.t = 0;
                this.energy = 0; // Reset energy to 0
                this.energyDirection = 1; // Reset to expanding
                this.camera.position.set(
                    this.config.cameraPosition.x,
                    this.config.cameraPosition.y,
                    this.config.cameraPosition.z
                );
                this.controls.reset();
            });
        }

        // Wireframe toggle
        const wireframeBtn = document.getElementById('wireframe');
        if (wireframeBtn) {
            wireframeBtn.addEventListener('click', () => {
                this.wireframeMode = !this.wireframeMode;
                wireframeBtn.classList.toggle('active', this.wireframeMode);
                this.planes.forEach(({ plane }) => {
                    plane.material.wireframe = this.wireframeMode;
                });
            });
        }

        // Info toggle
        const infoToggleBtn = document.getElementById('infoToggle');
        const infoEl = document.getElementById('info');
        if (infoToggleBtn && infoEl) {
            infoToggleBtn.addEventListener('click', () => {
                this.showInfo = !this.showInfo;
                infoEl.style.display = this.showInfo ? 'block' : 'none';
                infoToggleBtn.classList.toggle('active', this.showInfo);
            });
        }

        // Zoom controls
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.zoomCamera(0.8); // Zoom in (reduce distance)
            });
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.zoomCamera(1.25); // Zoom out (increase distance)
            });
        }

        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            if (e.key === '+' || e.key === '=') {
                this.zoomCamera(0.8);
            } else if (e.key === '-' || e.key === '_') {
                this.zoomCamera(1.25);
            } else if (e.key === 'ArrowUp') {
                this.rotateCamera(0, -0.1);
            } else if (e.key === 'ArrowDown') {
                this.rotateCamera(0, 0.1);
            } else if (e.key === 'ArrowLeft') {
                this.rotateCamera(-0.1, 0);
            } else if (e.key === 'ArrowRight') {
                this.rotateCamera(0.1, 0);
            }
        });
    }

    zoomCamera(factor) {
        // Get current distance from target
        const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        const distance = direction.length();
        const newDistance = distance * factor;
        
        // Clamp to min/max
        const clampedDistance = Math.max(
            this.controls.minDistance,
            Math.min(this.controls.maxDistance, newDistance)
        );
        
        // Apply new distance
        direction.normalize().multiplyScalar(clampedDistance);
        this.camera.position.copy(this.controls.target).add(direction);
        this.controls.update();
    }

    rotateCamera(horizontal, vertical) {
        // Rotate camera around target
        const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        const distance = direction.length();
        
        // Create rotation
        const axis = new THREE.Vector3(0, 1, 0); // Y-axis for horizontal rotation
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, horizontal);
        direction.applyQuaternion(quaternion);
        
        // Vertical rotation
        const right = new THREE.Vector3().crossVectors(direction, axis).normalize();
        const verticalQuat = new THREE.Quaternion().setFromAxisAngle(right, vertical);
        direction.applyQuaternion(verticalQuat);
        
        // Update camera position
        this.camera.position.copy(this.controls.target).add(direction.normalize().multiplyScalar(distance));
        this.controls.update();
    }

    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.update();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        // Clean up geometries and materials
        this.planes.forEach(({ plane, timeText }) => {
            plane.geometry.dispose();
            plane.material.dispose();
            this.scene.remove(plane);
            
            if (timeText) {
                this.scene.remove(timeText.group);
                timeText.texture.dispose();
                timeText.material.dispose();
                timeText.glowMaterial.dispose();
            }
        });
        this.lasers.forEach(laser => {
            if (laser) {
                laser.geometry.dispose();
                laser.material.dispose();
                this.scene.remove(laser);
            }
        });
        
        // Clean up fractal branches
        this.fractalBranches.forEach(branch => {
            branch.geometry.dispose();
            branch.material.dispose();
            this.scene.remove(branch);
        });

        this.controls.dispose();
        this.renderer.dispose();
        
        window.removeEventListener('resize', this.handleResize);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const demo = new FractalTimeEngine('container', {
            r: 3,
            I_max: 81,
            E_cap: 13,
            timeSpeed: 0.01
        });
        
        // Make demo globally available for debugging
        window.fractalDemo = demo;
    });
} else {
    const demo = new FractalTimeEngine('container', {
        r: 3,
        I_max: 81,
        E_cap: 13,
        timeSpeed: 0.01
    });
    
    window.fractalDemo = demo;
}

