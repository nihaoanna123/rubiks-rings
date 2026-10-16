
import './style.css';

import { cubeMapping } from './cube-mapping.js';
import {
  turnFace,
  resetCube,
  getBeadPositions
} from './cube-rotation.js';
import { installDragControls } from './drag-controls.js';
import { createCube3D } from './cube-3d.js';

let cube3D = null;

const COLOR_THEMES = {
  original: {
  green: '#35ce5c',
  yellow: '#ffe55b',
  blue: '#4888ff',
  magenta: '#e65acb',
  cyan: '#47dce9',
  red: '#f05252'
},
  classic: {
    yellow: '#ffd500',
    red: '#c41e3a',
    magenta: '#ffffff',
    blue: '#0051ba',
    cyan: '#ff5800',
    green: '#009b48'
  },
  Colorblind: {
    yellow: '#F2D34F',
    red: '#E76F51',
    magenta: '#D68AC0',
    blue: '#398ACB',
    cyan: '#69C9E2',
    green: '#39B89A'
    }
};

const BEAD_SYMBOLS = {
  yellow: '●',
  red: '▲',
  magenta: '■',
  blue: '◆',
  cyan: '✚',
  green: '★'
};

const symbolElements = new Map();

function centerSymbol(symbol, x, y) {
  symbol.setAttribute('x', x);
  symbol.setAttribute('y', y);

  const box = symbol.getBBox();

  symbol.setAttribute(
    'x',
    x + (x - (box.x + box.width / 2))
  );

  symbol.setAttribute(
    'y',
    y + (y - (box.y + box.height / 2))
  );
}

function updateBeadSymbols() {
  const showSymbols = currentTheme === 'Colorblind';
  const currentPositions = getBeadPositions();

  for (const bead of currentPositions) {
    let symbol = symbolElements.get(bead.beadId);

    if (!symbol) {
      const circle = beadElements.get(bead.beadId);
      if (!circle) continue;

      symbol = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );

      symbol.classList.add('bead-theme-symbol');
      symbol.setAttribute('text-anchor', 'middle');
      symbol.setAttribute('dominant-baseline', 'central');
      symbol.textContent = BEAD_SYMBOLS[bead.color];

      circle.parentNode.appendChild(symbol);
      symbolElements.set(bead.beadId, symbol);
    }

    const position = positions.get(bead.positionId);
    if (!position) continue;

    centerSymbol(symbol, position.x, position.y);
    symbol.style.display = showSymbols ? '' : 'none';
  }
}

let currentTheme = localStorage.getItem('rings-theme') || 'original';
let appearance = localStorage.getItem('rings-appearance') || 'light';

function applyAppearance() {
  document.documentElement.dataset.appearance = appearance;
  localStorage.setItem('rings-appearance', appearance);
}

function applyBeadTheme() {
  const palette = COLOR_THEMES[currentTheme];

  for (const bead of cubeMapping) {
    const circle = beadElements.get(bead.beadId);
    if (circle) {
      circle.setAttribute('fill', palette[bead.color]);
    }

    updateBeadSymbols();
  }
      if (cube3D) {
      cube3D.update(COLOR_THEMES[currentTheme]);
    }

  localStorage.setItem('rings-theme', currentTheme);
}

function installThemeControls() {
  const controls = document.createElement('div');
  controls.className = 'theme-controls';

  controls.innerHTML = `
    <label>
      Appearance
      <select id="appearance-select">
        <option value="light">Day mode</option>
        <option value="dark">Night mode</option>
      </select>
    </label>

    <label>
      Bead theme
      <select id="theme-select">
        <option value="original">Original</option>
        <option value="classic">Classic Rubik's</option>
        <option value="Colorblind">Colorblind</option>
      </select>
    </label>
  `;

  const board = document.querySelector('svg');
      const layout = document.querySelector('#puzzle-layout');
    layout.parentElement.insertBefore(controls, layout);

  const appearanceSelect = controls.querySelector('#appearance-select');
  const themeSelect = controls.querySelector('#theme-select');

  appearanceSelect.value = appearance;
  themeSelect.value = currentTheme;

  appearanceSelect.addEventListener('change', event => {
    appearance = event.target.value;
    applyAppearance();
  });

  themeSelect.addEventListener('change', event => {
    currentTheme = event.target.value;
    applyBeadTheme();
  });

  applyAppearance();
  applyBeadTheme();
}

// ============================================================
// RUBIK'S RINGS — PLAYABLE PUZZLE
// ============================================================

// Original diagram dimensions and ring geometry
const WIDTH = 1048;
const HEIGHT = 925;

const INNER_RADIUS = 195;
const RING_SPACING = 55;
const CENTER_DISTANCE = 240;
const CENTER_X = 546;
const CENTER_Y = 484;

const SVG_NS = 'http://www.w3.org/2000/svg';

const COLORS = {
  green: '#35ce5c',
  yellow: '#ffe55b',
  blue: '#4888ff',
  magenta: '#e65acb',
  cyan: '#47dce9',
  red: '#f05252'
};

const FACE_NAMES = [
  'yellow',
  'red',
  'magenta',
  'cyan',
  'green',
  'blue'
];

// ============================================================
// BUILD THE NINE RINGS
// ============================================================

const triangleHeight =
  CENTER_DISTANCE * Math.sqrt(3) / 2;

const ringCenters = [
  {
    family: 'U',
    x: CENTER_X,
    y: CENTER_Y - 2 * triangleHeight / 3
  },
  {
    family: 'L',
    x: CENTER_X - CENTER_DISTANCE / 2,
    y: CENTER_Y + triangleHeight / 3
  },
  {
    family: 'R',
    x: CENTER_X + CENTER_DISTANCE / 2,
    y: CENTER_Y + triangleHeight / 3
  }
];

const rings = ringCenters.flatMap(center =>
  [0, 1, 2].map(level => ({
    id: center.family + level,
    x: center.x,
    y: center.y,
    radius: INNER_RADIUS + level * RING_SPACING
  }))
);

// ============================================================
// FIXED POSITIONS
// ============================================================

// The position mapping is permanent.
// Beads move between positions; positions themselves do not move.

const positions = new Map();

for (const sticker of cubeMapping) {
  positions.set(sticker.positionId, {
    id: sticker.positionId,
    x: sticker.diagram.x,
    y: sticker.diagram.y,
    rings: sticker.diagram.rings
  });
}

if (positions.size !== 54) {
  throw new Error(
    `Expected 54 positions, found ${positions.size}`
  );
}

// ============================================================
// PAGE INTERFACE
// ============================================================

document.querySelector('#app').innerHTML = `
  <main id="rings-game" style="
    max-width: 1100px;
    margin: 0 auto;
    padding: 18px;
    font-family: Arial, sans-serif;
  ">
    <h1 style="margin-bottom: 6px">
  Rubik's Rings
  <span style="
    font-size: 14px;
    font-weight: normal;
    opacity: 0.65;
    margin-left: 8px;
  ">by nihaoanna123</span>
</h1>



    <div id="face-controls" style="
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin: 16px 0;
    "></div>

        <div style="
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 12px;
    ">
      <button id="undo" type="button">
        Undo
      </button>

      <button id="redo" type="button">
        Redo
      </button>

      <button id="reset" type="button">
        Reset Cube
      </button>

      <button id="scramble" type="button">Scramble</button>

      <button id="solve" type="button">Solve</button>

      <button id="next-solution-step" type="button">
          Next Step
        </button>

      <label style="cursor: pointer">
        <input id="show-ids" type="checkbox">
        Bead IDs
      </label>

            <label style="cursor: pointer">
        <input id="show-3d" type="checkbox">
        Show 3D Model
      </label>

      <span id="move-count" style="
        margin-left: 12px;
        font-weight: 600;
      "></span>
    </div>

        <p class="puzzle-instructions">
      Drag the rings or beads to rotate them.
      Left-click a center bead to turn that face counterclockwise.
      Right-click a center bead to turn that face clockwise.
    </p>

    <p id="status" style="
      font-weight: bold;
      min-height: 22px;
    "></p>
    <div id="puzzle-layout">
    <svg
      id="board"
      viewBox="0 0 ${WIDTH} ${HEIGHT}"
      preserveAspectRatio="xMidYMid meet"
      xmlns="${SVG_NS}"
    >
      <g id="ring-layer"></g>
      <g id="bead-layer"></g>
      <g
        id="label-layer"
        style="pointer-events: none; display: none"
      ></g>
    </svg>
          <div id="cube-3d-container"></div>
    </div>

  </main>
`;

const ringLayer =
  document.querySelector('#ring-layer');

const beadLayer =
  document.querySelector('#bead-layer');

const labelLayer =
  document.querySelector('#label-layer');

const pathLayer = document.createElementNS(
  'http://www.w3.org/2000/svg',
  'g'
);

pathLayer.setAttribute('id', 'movement-paths');
pathLayer.setAttribute('pointer-events', 'none');

beadLayer.parentNode.insertBefore(pathLayer, beadLayer);

const status =
  document.querySelector('#status');

const moveCount =
  document.querySelector('#move-count');

// ============================================================
// SVG HELPER
// ============================================================

function svgElement(tag, attributes, parent) {
  const element =
    document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }

  parent.appendChild(element);
  return element;
}

// ============================================================
// DRAW RINGS
// ============================================================

for (const ring of rings) {
  svgElement('circle', {
    cx: ring.x,
    cy: ring.y,
    r: ring.radius,
    fill: 'none',
    stroke: '#6c7480',
    'stroke-width': 2.5
  }, ringLayer);
}

// ============================================================
// DRAW BEADS
// ============================================================

// Bead elements are created once and then repositioned.
// Their identities and colors never change.

const beadElements = new Map();
const labelElements = new Map();

for (const sticker of cubeMapping) {
  const position = positions.get(sticker.positionId);

  const bead = svgElement('circle', {
    cx: position.x,
    cy: position.y,
    r: 17,
    fill: COLORS[sticker.color],
    stroke: '#111318',
    'stroke-width': 2
  }, beadLayer);

  const tooltip =
    svgElement('title', {}, bead);

  tooltip.textContent =
    `${sticker.beadId} — ${sticker.color}`;

  beadElements.set(sticker.beadId, bead);

  const label = svgElement('text', {
    x: position.x,
    y: position.y + 4,
    'text-anchor': 'middle',
    'font-size': 11,
    'font-weight': 'bold',
    fill: '#101318'
  }, labelLayer);

  label.textContent = sticker.beadId;

  labelElements.set(sticker.beadId, label);
}

// ============================================================
// GAME STATE
// ============================================================

let selectedFace = 'yellow';
let history = [];
let redoHistory = [];

let solutionHistory = [];
let scrambleHistory = [];

function recordMove(face, clockwise) {
  const move = { face, clockwise };

  history.push(move);
  solutionHistory.push(move);
  redoHistory.length = 0;
}



const ANIMATION_DURATION = 700;

let animationInProgress = false;


function sharedRing(start, end, clockwise) {
  const startRings = start.rings || [];
  const endRings = end.rings || [];

  const common = startRings.filter(
    id => endRings.includes(id)
  );

  if (common.length === 0) return null;

  const TAU = Math.PI * 2;

  let best = null;

  for (const id of common) {
    const ring = rings.find(r => r.id === id);
    if (!ring) continue;

    const startAngle = Math.atan2(
      start.y - ring.y,
      start.x - ring.x
    );

    const endAngle = Math.atan2(
      end.y - ring.y,
      end.x - ring.x
    );

    let delta = endAngle - startAngle;

    // SVG coordinates have Y pointing downward.
    // Increasing angle is visually clockwise.
    if (clockwise) {
      while (delta <= 0) delta += TAU;
    } else {
      while (delta >= 0) delta -= TAU;
    }

    const distance = Math.abs(delta) * ring.radius;

    if (!best || distance < best.distance) {
      best = {
        ring,
        startAngle,
        delta,
        distance
      };
    }
  }

  return best;
}


function easeInOut(t) {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}


const FACE_AXES = {
  yellow:  { axis: 'z', sign:  1 },
  red:     { axis: 'z', sign: -1 },
  magenta: { axis: 'y', sign:  1 },
  blue:    { axis: 'y', sign: -1 },
  cyan:    { axis: 'x', sign:  1 },
  green:   { axis: 'x', sign: -1 }
};

// A fixed position belongs to a face if its
// outward-pointing normal matches that face.
const positionInfo = new Map(
  cubeMapping.map(sticker => [
    sticker.positionId,
    sticker
  ])
);

function isFacePosition(positionId, face) {
  const sticker = positionInfo.get(positionId);
  const direction = FACE_AXES[face];

  if (!sticker || !direction) return false;

  return sticker.normal[direction.axis] === direction.sign;
}


function animateBeads(before, after, clockwise) {
  const oldPositions = new Map(
    before.map(b => [b.beadId, b.positionId])
  );

  const movements = after
  .filter(bead =>
    oldPositions.get(bead.beadId) !== bead.positionId
  )
  .map(bead => {
    const start = positions.get(
      oldPositions.get(bead.beadId)
    );

    const end = positions.get(bead.positionId);

    return {
      beadId: bead.beadId,
      start,
      end,
      
    arc: selectedFace.startsWith('middle')
      ? sharedRing(start, end, clockwise)
      : isFacePosition(
        oldPositions.get(bead.beadId),
        selectedFace
    )
      ? null
      : sharedRing(
          start,
          end,
          ['red', 'green', 'blue'].includes(selectedFace)
            ? !clockwise
            : clockwise
        )

    };
  });

  animationInProgress = true;

  const startedAt = performance.now();

  function frame(now) {
    const progress = Math.min(
      (now - startedAt) / ANIMATION_DURATION,
      1
    );

    const t = easeInOut(progress);

    for (const movement of movements) {
      let x;
      let y;

      if (movement.arc) {
        const { ring, startAngle, delta } =
          movement.arc;

        const angle = startAngle + delta * t;

        x = ring.x + ring.radius * Math.cos(angle);
        y = ring.y + ring.radius * Math.sin(angle);
      } else {
        x = movement.start.x +
          (movement.end.x - movement.start.x) * t;

        y = movement.start.y +
          (movement.end.y - movement.start.y) * t;
      }

      const circle =
        beadElements.get(movement.beadId);

      const label =
        labelElements.get(movement.beadId);

      // Disable CSS transitions because we're
      // controlling every animation frame ourselves.
      circle.style.transition = 'none';
      label.style.transition = 'none';

      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);

      label.setAttribute('x', x);
      label.setAttribute('y', y + 4);

      const symbol = symbolElements.get(movement.beadId);

      if (symbol) {
        symbol.style.transition = 'none';
        centerSymbol(symbol, x, y);
      }
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      animationInProgress = false;
      renderCube(false);
      checkForWin();
    }
  }

  requestAnimationFrame(frame);
}


function renderCube(animate = false) {
  const state = getBeadPositions();

  for (const sticker of state) {
    const position = positions.get(sticker.positionId);

    if (!position) {
      throw new Error(
        `Unknown position: ${sticker.positionId}`
      );
    }

    const bead = beadElements.get(sticker.beadId);
    const label = labelElements.get(sticker.beadId);

    if (animate) {
      bead.style.transition =
        `cx ${ANIMATION_DURATION}ms ease-in-out, ` +
        `cy ${ANIMATION_DURATION}ms ease-in-out`;

      label.style.transition =
        `x ${ANIMATION_DURATION}ms ease-in-out, ` +
        `y ${ANIMATION_DURATION}ms ease-in-out`;
    } else {
      bead.style.transition = 'none';
      label.style.transition = 'none';
    }

    bead.setAttribute('cx', position.x);
    bead.setAttribute('cy', position.y);

    label.setAttribute('x', position.x);
    label.setAttribute('y', position.y + 4);
  }

  moveCount.textContent = `Moves: ${history.length}`;

  document.querySelector('#undo').disabled =
    history.length === 0;

updateBeadSymbols();
  if (cube3D) {
    cube3D.update(COLOR_THEMES[currentTheme]);
  }
}

// ============================================================
// WIN CONDITION
// ============================================================

let hasWon = false;

function isCubeSolved() {
  const current = getBeadPositions();

  // Each fixed position has a face normal in cubeMapping.
  const faceColors = new Map();

  for (const bead of current) {
    const slot = cubeMapping.find(
      item => item.positionId === bead.positionId
    );

    if (!slot) return false;

    const faceKey = [
      slot.normal.x,
      slot.normal.y,
      slot.normal.z
    ].join(',');

    if (!faceColors.has(faceKey)) {
      faceColors.set(faceKey, new Set());
    }

    faceColors.get(faceKey).add(bead.color);
  }

  return (
    faceColors.size === 6 &&
    [...faceColors.values()].every(colors => colors.size === 1)
  );
}

function checkForWin() {
  const solved = isCubeSolved();

  if (solved && !hasWon) {
    hasWon = true;
    status.textContent = 'Puzzle solved!';
    launchConfetti();
  } else if (!solved) {
    hasWon = false;
  }
}

function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.className = 'win-confetti';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const colors = [
    '#f5c542', '#ff5b57', '#e879db',
    '#5788ff', '#42d9dc', '#58d68d'
  ];

  let width;
  let height;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  resize();

  const particles = Array.from({ length: 110 }, () => ({
    x: width / 2,
    y: height * 0.35,
    vx: (Math.random() - 0.5) * 15,
    vy: -Math.random() * 12 - 2,
    gravity: 0.22 + Math.random() * 0.14,
    size: 4 + Math.random() * 6,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.25,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  const start = performance.now();

  function frame(now) {
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.angle += p.spin;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    if (now - start < 1800) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(frame);
}

// ============================================================
// FACE SELECTION — controlled by dragging and center clicks
// ============================================================

// Keep this function because the drag controls still call it.
function updateFaceSelection() {
  status.textContent = '';
}

// ============================================================
// ROTATIONS
// ============================================================
function showMovementPaths(before, after) {
  pathLayer.replaceChildren();

  const oldPositions = new Map(
    before.map(bead => [bead.beadId, bead.positionId])
  );

  for (const bead of after) {
    const oldId = oldPositions.get(bead.beadId);

    if (oldId === bead.positionId) continue;

    const start = positions.get(oldId);
    const end = positions.get(bead.positionId);

    const line = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'line'
    );

    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', end.x);
    line.setAttribute('y2', end.y);
    line.setAttribute('stroke', '#ffffff');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-opacity', '0.65');
    line.setAttribute('marker-end', 'url(#move-arrow)');

    pathLayer.appendChild(line);
  }
}

const defs = document.createElementNS(
  'http://www.w3.org/2000/svg',
  'defs'
);

defs.innerHTML = `
  <marker
    id="move-arrow"
    markerWidth="6"
    markerHeight="6"
    refX="5"
    refY="3"
    orient="auto"
  >
    <path d="M0,0 L6,3 L0,6 Z" fill="white"/>
  </marker>
`;

document.querySelector('#board').prepend(defs);

function performTurn(clockwise) {
  if (animationInProgress) return;

  const before = getBeadPositions();

      if (cube3D) {
      cube3D.animateTurn(selectedFace, clockwise, before, ANIMATION_DURATION);
    }

  turnFace(selectedFace, clockwise);

  const after = getBeadPositions();

  recordMove(selectedFace, clockwise);
  redoHistory.length = 0;

  animateBeads(before, after, clockwise);

  status.textContent =
    `${selectedFace.toUpperCase()} ` +
    (clockwise ? 'clockwise ↻' : 'counterclockwise ↺');

  moveCount.textContent =
    `Moves: ${history.length}`;
}

const SCRAMBLE_LAYERS = [
  'yellow', 'red',
  'magenta', 'blue',
  'cyan', 'green',
  'middleX', 'middleY', 'middleZ'
];

function scrambleCube() {
  if (animationInProgress) return;
    solutionSteps = [];
  solutionIndex = 0;
  solutionHistory = [];
  scrambleHistory = [];

  const scrambleLength = 25;
  let previousFace = null;

  // A new scramble establishes a new starting state.
  resetCube();
  history = [];
  redoHistory = [];
  solutionHistory = [];
  scrambleHistory = [];

  for (let i = 0; i < scrambleLength; i++) {
    const choices = SCRAMBLE_LAYERS.filter(
      face => face !== previousFace
    );

    const face = choices[
      Math.floor(Math.random() * choices.length)
    ];

    const clockwise = Math.random() < 0.5;

    turnFace(face, clockwise);

    const move = { face, clockwise };

    scrambleHistory.push(move);
    solutionHistory.push(move);

    previousFace = face;
  }

  renderCube(false);
  status.textContent = 'Cube scrambled!';
  hasWon = false;

  // Undo is disabled until the player makes a move.
}

let solutionSteps = [];
let solutionIndex = 0;

function prepareSolution() {
  if (animationInProgress) return;

  solutionSteps = [...solutionHistory]
    .reverse()
    .map(move => ({
      face: move.face,
      clockwise: !move.clockwise
    }));

  solutionIndex = 0;

  status.textContent =
    `Solution ready: ${solutionSteps.length} steps.`;
}

function nextSolutionStep() {
  if (animationInProgress) return;
  if (solutionSteps.length === 0) {
  status.textContent = 'No solution in progress.';
  return;
}

  if (solutionIndex >= solutionSteps.length) {
    status.textContent = 'Solution complete!';
    return;
  }

  const move = solutionSteps[solutionIndex];

  selectedFace = move.face;

  const before = getBeadPositions();

      if (cube3D) {
      cube3D.animateTurn(move.face, move.clockwise, before, ANIMATION_DURATION);
    }

  turnFace(move.face, move.clockwise);

  const after = getBeadPositions();

  animateBeads(before, after, move.clockwise);

  solutionIndex++;

  status.textContent =
    `Solution step ${solutionIndex} of ${solutionSteps.length}`;
}

// ============================================================
// UNDO
// ============================================================

document.querySelector('#undo')
  .addEventListener('click', () => {
    if (animationInProgress || history.length === 0) return;

    const lastMove = history.pop();
    solutionHistory.pop();
    redoHistory.push(lastMove);

    const before = getBeadPositions();

  if (cube3D) {
    cube3D.animateTurn(
      lastMove.face,
      !lastMove.clockwise,
      before,
      ANIMATION_DURATION
    );
  }

  selectedFace = lastMove.face;
  turnFace(lastMove.face, !lastMove.clockwise);
  animateBeads(before, getBeadPositions(), !lastMove.clockwise);

      status.textContent = `Undid ${lastMove.face} turn`;
  });

document.querySelector('#redo')
  .addEventListener('click', () => {
    if (animationInProgress || redoHistory.length === 0) return;

    const move = redoHistory.pop();
    solutionHistory.push(move);
    history.push(move);

    const before = getBeadPositions();

    if (cube3D) {
      cube3D.animateTurn(
        move.face,
        move.clockwise,
        before,
        ANIMATION_DURATION
      );
    }

    selectedFace = move.face;
    turnFace(move.face, move.clockwise);
    animateBeads(before, getBeadPositions(), move.clockwise);

    status.textContent = `Redid ${move.face} turn`;
  });

// ============================================================
// RESET
// ============================================================

document.querySelector('#reset')
  .addEventListener('click', () => {
    if (animationInProgress) return;
    resetCube();
    history = [];
    solutionHistory = [];
    scrambleHistory = [];

    solutionSteps = [];
    solutionIndex = 0;

    renderCube();
    redoHistory.length = 0;

    status.textContent =
      'Cube reset to solved position';
  });

// ============================================================
// BEAD LABELS
// ============================================================

document.querySelector('#show-ids')
  .addEventListener('change', event => {
    labelLayer.style.display =
      event.target.checked ? '' : 'none';
  });

// ============================================================
// KEYBOARD CONTROLS
// ============================================================

document.addEventListener('keydown', event => {
  if (event.repeat) return;

  if (event.key === 'ArrowRight') {
    performTurn(true);
  }

  if (event.key === 'ArrowLeft') {
    performTurn(false);
  }

  if (
    event.key.toLowerCase() === 'z' &&
    (event.ctrlKey || event.metaKey)
  ) {
    event.preventDefault();
    document.querySelector('#undo').click();
  }
});

document.querySelector('#scramble')
  .addEventListener('click', scrambleCube);

document.querySelector('#solve')
  .addEventListener('click', prepareSolution);

document.querySelector('#next-solution-step')
  .addEventListener('click', nextSolutionStep);

// ============================================================
// INITIALIZE
// ============================================================

resetCube();
updateFaceSelection();
renderCube();


installDragControls({
  board: document.querySelector('#board'),
  rings,
  positions,
  cubeMapping,
  getBeadPositions,
  turnFace,

  onTurn(face, clockwise) {
    if (animationInProgress) return;

    selectedFace = face;
    updateFaceSelection();
    performTurn(clockwise);
  }
});


installThemeControls();

document.querySelector('#show-3d')
  .addEventListener('change', event => {
    const container =
      document.querySelector('#cube-3d-container');

    if (event.target.checked) {
      container.style.display = 'block';

      if (!cube3D) {
        cube3D = createCube3D(
          container,
          cubeMapping,
          getBeadPositions
        );
      }

      cube3D.update(COLOR_THEMES[currentTheme]);
    } else {
      container.style.display = 'none';
    }
  });

console.log('Rubik’s Rings playable puzzle ready');
console.log('54 sticker positions:', positions.size);
