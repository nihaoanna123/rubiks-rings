
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

export function createCube3D(
  container,
  cubeMapping,
  getBeadPositions,
  onTurn
) {
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

    const hitbox = new THREE.Mesh(
  new THREE.BoxGeometry(3, 3, 3),
  new THREE.MeshBasicMaterial({
    visible: false,
    side: THREE.DoubleSide
  })
);

cubeGroup.add(hitbox);  

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


  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const stickerIds = new Map(
    [...stickers.entries()].map(([id, mesh]) => [mesh, id])
  );

  const stickerByPosition = new Map(
  cubeMapping.map(slot => [
    `${slot.cube.x},${slot.cube.y},${slot.cube.z}|` +
    `${slot.normal.x},${slot.normal.y},${slot.normal.z}`,
    slot.positionId
  ])
);

  const FACE_BY_NORMAL = {
    '0,0,1': 'yellow',
    '0,0,-1': 'red',
    '0,1,0': 'magenta',
    '0,-1,0': 'blue',
    '1,0,0': 'cyan',
    '-1,0,0': 'green'
  };

  let drag = null;

  function getStickerAt(event) {
  const rect = canvas.getBoundingClientRect();

  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  cubeGroup.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObject(hitbox);

  if (!hits.length) return null;

  const hit = hits[0];

  // Convert the intersection to cube-local coordinates.
  const localPoint = cubeGroup.worldToLocal(hit.point.clone());

  const localNormal = hit.face.normal.clone();

  // Determine which cube face was clicked.
  const nx = Math.round(localNormal.x);
  const ny = Math.round(localNormal.y);
  const nz = Math.round(localNormal.z);

  // Find the nearest sticker position on that face.
  const x = nx !== 0 ? nx : Math.max(-1, Math.min(1, Math.round(localPoint.x)));
  const y = ny !== 0 ? ny : Math.max(-1, Math.min(1, Math.round(localPoint.y)));
  const z = nz !== 0 ? nz : Math.max(-1, Math.min(1, Math.round(localPoint.z)));

  const positionId = stickerByPosition.get(
    `${x},${y},${z}|${nx},${ny},${nz}`
  );

  if (!positionId) return null;

  const bead = getBeadPositions().find(
    item => item.positionId === positionId
  );

  return bead?.beadId ?? null;
}


function getStickerMove(beadId, dx, dy) {
  const bead = getBeadPositions().find(
    item => item.beadId === beadId
  );
  if (!bead) return null;

  const slot = slotById.get(bead.positionId);
  if (!slot) return null;

  const normal = new THREE.Vector3(
    slot.normal.x, slot.normal.y, slot.normal.z
  );

  const point = new THREE.Vector3(
    slot.cube.x + normal.x * 0.501,
    slot.cube.y + normal.y * 0.501,
    slot.cube.z + normal.z * 0.501
  );

  cubeGroup.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  const rect = canvas.getBoundingClientRect();

  function screenPosition(localPoint) {
    const projected = cubeGroup
      .localToWorld(localPoint.clone())
      .project(camera);

    return new THREE.Vector2(
      projected.x * rect.width / 2,
      -projected.y * rect.height / 2
    );
  }

  const start = screenPosition(point);
  const dragLength = Math.hypot(dx, dy);
  if (dragLength < 1) return null;

  const dragDirection = new THREE.Vector2(
    dx / dragLength,
    dy / dragLength
  );

  let best = null;

  for (const axis of ['x', 'y', 'z']) {
    // Only axes lying in the clicked face are valid.
    if (Math.abs(normal[axis]) > 0.5) continue;

    const axisVector = new THREE.Vector3(
      axis === 'x' ? 1 : 0,
      axis === 'y' ? 1 : 0,
      axis === 'z' ? 1 : 0
    );

    const movedPoint = point.clone()
      .applyAxisAngle(axisVector, 0.05);

    const end = screenPosition(movedPoint);
    const displacement = end.sub(start);

    if (displacement.lengthSq() < 0.000001) continue;

    displacement.normalize();

    const score = displacement.dot(dragDirection);

    if (!best || Math.abs(score) > Math.abs(best.score)) {
      best = { axis, score };
    }
  }

  if (!best) return null;

  const layer = Math.round(slot.cube[best.axis]);

  const face = layer === 0
    ? `middle${best.axis.toUpperCase()}`
    : Object.keys(AXES).find(name =>
        AXES[name][0] === best.axis &&
        AXES[name][1] === layer
      );

  if (!face) return null;

  const clockwise = layer === 0
    ? best.score > 0
    : layer > 0
      ? best.score > 0
      : best.score < 0;

  return { face, clockwise };
}


  function rotateView(dx, dy, shiftKey) {
    const cameraRight = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(camera.quaternion);

    const cameraUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion);

    if (shiftKey) {
      const cameraForward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion);

      cubeGroup.rotateOnWorldAxis(
        cameraForward,
        dx * 0.012
      );
    } else {
      cubeGroup.rotateOnWorldAxis(cameraUp, dx * 0.012);
      cubeGroup.rotateOnWorldAxis(cameraRight, dy * 0.012);
    }
  }

  canvas.style.touchAction = 'none';

  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
  });

  canvas.addEventListener('pointerdown', event => {
    if (active) return;

    const beadId = event.button === 0 && !event.shiftKey
      ? getStickerAt(event)
      : null;

    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      beadId,
      mode: beadId ? 'sticker' : 'view',
      committed: false
    };

    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;

    if (drag.mode === 'view') {
      rotateView(dx, dy, event.shiftKey);
    } else if (!drag.committed && !active) {
      const totalX = event.clientX - drag.startX;
      const totalY = event.clientY - drag.startY;

      if (Math.hypot(totalX, totalY) >= 15) {
        const move = getStickerMove(
          drag.beadId,
          totalX,
          totalY
        );

        if (move) {
          drag.committed = true;
          onTurn?.(move.face, move.clockwise);
        }
      }
    }

    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  });

  function endDrag(event) {
    if (drag?.pointerId === event.pointerId) {
      drag = null;
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);


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
