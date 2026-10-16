
import './style.css';

import { cubeMapping } from './cube-mapping.js';
import {
  turnFace,
  resetCube,
  getBeadPositions
} from './cube-rotation.js';

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
    </h1>

    <p style="margin-top: 0">
      Select a face, then rotate it clockwise or
      counterclockwise.
    </p>

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
      <button id="clockwise" type="button">
        Clockwise ↻
      </button>

      <button id="counterclockwise" type="button">
        Counterclockwise ↺
      </button>

      <button id="undo" type="button">
        Undo
      </button>

      <button id="reset" type="button">
        Reset Cube
      </button>

      <label style="cursor: pointer">
        <input id="show-ids" type="checkbox">
        Bead IDs
      </label>
    </div>

    <p id="status" style="
      font-weight: bold;
      min-height: 22px;
    "></p>

    <svg
      id="board"
      viewBox="0 0 ${WIDTH} ${HEIGHT}"
      xmlns="${SVG_NS}"
      style="
        display: block;
        width: 100%;
        height: auto;
        background: #14171c;
        border-radius: 12px;
      "
    >
      <g id="ring-layer"></g>
      <g id="bead-layer"></g>
      <g
        id="label-layer"
        style="pointer-events: none; display: none"
      ></g>
    </svg>

    <p id="move-count"></p>
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
    'stroke-width': 2
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
      
    arc: isFacePosition(
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
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      animationInProgress = false;
      renderCube(false);
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
}

// ============================================================
// FACE SELECTION
// ============================================================

const faceControls =
  document.querySelector('#face-controls');

const faceButtons = new Map();

for (const face of FACE_NAMES) {
  const button = document.createElement('button');

  button.type = 'button';
  button.textContent =
    face[0].toUpperCase() + face.slice(1);

  button.style.cssText = `
    background: ${COLORS[face]};
    color: #151515;
    border: 3px solid transparent;
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: bold;
    cursor: pointer;
  `;

  button.addEventListener('click', () => {
    selectedFace = face;
    updateFaceSelection();
  });

  faceControls.appendChild(button);
  faceButtons.set(face, button);
}

function updateFaceSelection() {
  for (const [face, button] of faceButtons) {
    button.style.borderColor =
      face === selectedFace
        ? '#ffffff'
        : 'transparent';

    button.style.outline =
      face === selectedFace
        ? '2px solid #333333'
        : 'none';
  }

  status.textContent =
    `Selected face: ${selectedFace.toUpperCase()}`;
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

  turnFace(selectedFace, clockwise);

  const after = getBeadPositions();

  history.push({
    face: selectedFace,
    clockwise
  });

  animateBeads(before, after, clockwise);

  status.textContent =
    `${selectedFace.toUpperCase()} ` +
    (clockwise ? 'clockwise ↻' : 'counterclockwise ↺');

  moveCount.textContent =
    `Moves: ${history.length}`;
}


document.querySelector('#clockwise')
  .addEventListener('click', () => {
    performTurn(true);
  });

document.querySelector('#counterclockwise')
  .addEventListener('click', () => {
    performTurn(false);
  });

// ============================================================
// UNDO
// ============================================================

document.querySelector('#undo')
  .addEventListener('click', () => {
    if (animationInProgress) return;
    if (history.length === 0) return;

    const lastMove = history.pop();

    // Apply the inverse of the previous move.
    turnFace(
      lastMove.face,
      !lastMove.clockwise
    );

    renderCube(true);

    status.textContent =
      `Undid ${lastMove.face} turn`;
  });

// ============================================================
// RESET
// ============================================================

document.querySelector('#reset')
  .addEventListener('click', () => {
    if (animationInProgress) return;
    resetCube();
    history = [];

    renderCube();

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

// ============================================================
// INITIALIZE
// ============================================================

resetCube();
updateFaceSelection();
renderCube();

console.log('Rubik’s Rings playable puzzle ready');
console.log('54 sticker positions:', positions.size);
