
import { cubeMapping } from './cube-mapping.js';

const directions = {
  yellow:  { axis: 'z', sign:  1 },
  red:     { axis: 'z', sign: -1 },
  magenta: { axis: 'y', sign:  1 },
  blue:    { axis: 'y', sign: -1 },
  cyan:    { axis: 'x', sign:  1 },
  green:   { axis: 'x', sign: -1 }
};

function rotateVector(v, axis, quarterTurns) {
  let { x, y, z } = v;

  // A positive quarter-turn follows the right-hand rule.
  const turns = ((quarterTurns % 4) + 4) % 4;

  for (let i = 0; i < turns; i++) {
    if (axis === 'x') {
      [y, z] = [-z, y];
    } else if (axis === 'y') {
      [x, z] = [z, -x];
    } else {
      [x, y] = [-y, x];
    }
  }

  return { x, y, z };
}

function slotKey(cube, normal) {
  return [
    cube.x, cube.y, cube.z,
    normal.x, normal.y, normal.z
  ].join(',');
}

// The 54 fixed locations in the solved diagram
const positionBySlot = new Map(
  cubeMapping.map(sticker => [
    slotKey(sticker.cube, sticker.normal),
    sticker.positionId
  ])
);

// Each sticker retains its identity, but changes location.
let stickers = cubeMapping.map(sticker => ({
  beadId: sticker.beadId,
  color: sticker.color,
  pieceId: sticker.pieceId,
  cube: { ...sticker.cube },
  normal: { ...sticker.normal }
}));


export function turnFace(face, clockwise = true) {
  const direction = directions[face];

  if (!direction) {
    throw new Error(`Unknown face: ${face}`);
  }

  const { axis, sign } = direction;

  // Front-facing surfaces: yellow, magenta, cyan
  // Back-facing surfaces: red, green, blue
  //
  // The back-facing surfaces are viewed from the
  // opposite side in the exploded diagram.

  const frontFacing = [
    'yellow',
    'magenta',
    'cyan'
  ].includes(face);

  const turns = clockwise ? sign : -sign;

  stickers = stickers.map(sticker => {
    if (sticker.cube[axis] !== sign) {
      return sticker;
    }

    return {
      ...sticker,
      cube: rotateVector(sticker.cube, axis, turns),
      normal: rotateVector(sticker.normal, axis, turns)
    };
  });

  return getBeadPositions();
}


export function getBeadPositions() {
  return stickers.map(sticker => {
    const key = slotKey(sticker.cube, sticker.normal);
    const positionId = positionBySlot.get(key);

    if (!positionId) {
      throw new Error(
        `No 2D position for bead ${sticker.beadId}`
      );
    }

    return {
      beadId: sticker.beadId,
      color: sticker.color,
      positionId
    };
  });
}

export function resetCube() {
  stickers = cubeMapping.map(sticker => ({
    beadId: sticker.beadId,
    color: sticker.color,
    pieceId: sticker.pieceId,
    cube: { ...sticker.cube },
    normal: { ...sticker.normal }
  }));

  return getBeadPositions();
}
