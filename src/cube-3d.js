
import * as THREE from 'three';

const DEFAULT_COLORS = {
  yellow: '#ffff00',
  red: '#ff2200',
  magenta: '#ee00ee',
  blue: '#1515ff',
  cyan: '#00dddd',
  green: '#00dd00'
};

const AXES = {
  yellow: ['z', 1],
  red: ['z', -1],
  magenta: ['y', 1],
  blue: ['y', -1],
  cyan: ['x', 1],
  green: ['x', -1],
  middleX: ['x', 0],
  middleY: ['y', 0],
  middleZ: ['z', 0]
};

const ease = t =>
  t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function createCube3D(container, cubeMapping, getBeadPositions) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(-5, 5, 7);
camera.up.set(0, 0, 1);
camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 2.2));

            const cubeGroup = new THREE.Group();
        cubeGroup.scale.x = -1;
        scene.add(cubeGroup);

  const slotById = new Map(
    cubeMapping.map(slot => [slot.positionId, slot])
  );

  const cubieGeometry = new THREE.BoxGeometry(0.96, 0.96, 0.96);
  const cubieMaterial = new THREE.MeshStandardMaterial({
    color: '#171b22',
    roughness: 0.7
  });

  const cubies = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubie = new THREE.Mesh(cubieGeometry, cubieMaterial);

        cubie.position.set(x, y, z);
        cubie.userData.grid = { x, y, z };

        cubeGroup.add(cubie);
        cubies.push(cubie);
      }
    }
  }

  const stickerGeometry = new THREE.PlaneGeometry(0.82, 0.82);
  const stickers = new Map();

  for (const bead of cubeMapping) {
    const material = new THREE.MeshBasicMaterial({
      color: DEFAULT_COLORS[bead.color],
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(stickerGeometry, material);
    cubeGroup.add(mesh);
    stickers.set(bead.beadId, mesh);
  }

  let palette = DEFAULT_COLORS;
  let showSymbols = false;
  let symbols = {};
  let active = false;
  let disposed = false;

  const symbolMeshes = new Map();

  function makeSymbol(character) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 84px "Segoe UI Symbol", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#263445';
    ctx.fillStyle = '#fffaf0';

    ctx.strokeText(character, 64, 68);
    ctx.fillText(character, 64, 68);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 0.65),
      material
    );

    mesh.position.z = 0.006;
    return mesh;
  }

  function update(
    nextPalette = palette,
    nextShowSymbols = showSymbols,
    nextSymbols = symbols
  ) {
    palette = nextPalette || DEFAULT_COLORS;
    showSymbols = nextShowSymbols;
    symbols = nextSymbols;

    if (active) return;

    for (const bead of getBeadPositions()) {
      const slot = slotById.get(bead.positionId);
      const mesh = stickers.get(bead.beadId);

      if (!slot || !mesh) continue;

      const { x, y, z } = slot.cube;
      const { x: nx, y: ny, z: nz } = slot.normal;

      mesh.position.set(
        x + nx * 0.501,
        y + ny * 0.501,
        z + nz * 0.501
      );

      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(nx, ny, nz)
      );

      mesh.material.color.set(
        palette[bead.color] || DEFAULT_COLORS[bead.color]
      );

      let symbol = symbolMeshes.get(bead.beadId);

      if (showSymbols && !symbol) {
        symbol = makeSymbol(symbols[bead.color] || '●');
        mesh.add(symbol);
        symbolMeshes.set(bead.beadId, symbol);
      }

      if (symbol) symbol.visible = showSymbols;
    }
  }

  function animateTurn(face, clockwise, before, duration = 700) {
    if (active || disposed || !AXES[face]) return;

    const [axis, sign] = AXES[face];

    const turns = clockwise
      ? (sign === 0 ? 1 : sign)
      : (sign === 0 ? -1 : -sign);

    const angle = turns * Math.PI / 2;

    const pivot = new THREE.Group();
    cubeGroup.add(pivot);

    for (const cubie of cubies) {
      if (cubie.userData.grid[axis] === sign) {
        pivot.attach(cubie);
      }
    }

    for (const bead of before) {
      const slot = slotById.get(bead.positionId);

      if (slot && slot.cube[axis] === sign) {
        const mesh = stickers.get(bead.beadId);
        if (mesh) pivot.attach(mesh);
      }
    }

    active = true;
    const startedAt = performance.now();

    function frame(now) {
      if (disposed) return;

      const progress = Math.min(
        1,
        (now - startedAt) / duration
      );

      pivot.rotation[axis] = angle * ease(progress);

      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      pivot.updateMatrixWorld(true);

      while (pivot.children.length) {
        cubeGroup.attach(pivot.children[0]);
      }

      cubeGroup.remove(pivot);

      for (const cubie of cubies) {
        const p = cubie.position;

        cubie.userData.grid = {
          x: Math.round(p.x),
          y: Math.round(p.y),
          z: Math.round(p.z)
        };

        cubie.position.set(
          cubie.userData.grid.x,
          cubie.userData.grid.y,
          cubie.userData.grid.z
        );

        cubie.quaternion.identity();
      }

      active = false;
      update();
    }

    requestAnimationFrame(frame);
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', event => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;

        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;

        const cameraRight = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(camera.quaternion);

        const cameraUp = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(camera.quaternion);

                if (event.shiftKey) {
        const cameraForward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(camera.quaternion);

        cubeGroup.rotateOnWorldAxis(cameraForward, dx * 0.008);
        } else {
        cubeGroup.rotateOnWorldAxis(cameraUp, dx * 0.008);
        cubeGroup.rotateOnWorldAxis(cameraRight, dy * 0.008);
        }

    lastX = event.clientX;
    lastY = event.clientY;
  });

  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });

  canvas.addEventListener('pointercancel', () => {
    dragging = false;
  });

  function resize() {
    const width = container.clientWidth || 440;
    const height = container.clientHeight || 440;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  resize();
  update();

  function renderFrame() {
    if (disposed) return;

    renderer.render(scene, camera);
    requestAnimationFrame(renderFrame);
  }

  renderFrame();

  return {
    update,
    animateTurn,

    dispose() {
      disposed = true;
      observer.disconnect();

      for (const mesh of stickers.values()) {
        mesh.material.dispose();
      }

      for (const symbol of symbolMeshes.values()) {
        symbol.geometry.dispose();
        symbol.material.map.dispose();
        symbol.material.dispose();
      }

      stickerGeometry.dispose();
      cubieGeometry.dispose();
      cubieMaterial.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
}
