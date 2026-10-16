
import { cubeMapping } from './cube-mapping.js';

const directions = {
  yellow:  { axis: 'z', sign:  1 },
  red:     { axis: 'z', sign: -1 },
  magenta: { axis: 'y', sign:  1 },
  blue:    { axis: 'y', sign: -1 },
  cyan:    { axis: 'x', sign:  1 },
  green:   { axis: 'x', sign: -1 },

  middleZ: { axis: 'z', sign: 0 },
  middleY: { axis: 'y', sign: 0 },
  middleX: { axis: 'x', sign: 0 }
};

function rotateVector(v, axis, quarterTurns) {
  let { x, y, z } = v;
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

const positionBySlot = new Map(
  cubeMapping.map(sticker => [
    slotKey(sticker.cube, sticker.normal),
    sticker.positionId
  ])
);

function solvedStickers() {
  return cubeMapping.map(sticker => ({
    beadId: sticker.beadId,
    color: sticker.color,
    pieceId: sticker.pieceId,
    cube: { ...sticker.cube },
    normal: { ...sticker.normal }
  }));
}

let stickers = solvedStickers();

export function turnFace(face, clockwise = true) {
  const direction = directions[face];

  if (!direction) {
    throw new Error(`Unknown layer: ${face}`);
  }

  const { axis, sign } = direction;

  // Preserve the direction that worked in your diagram.
  // Middle layers use the same positive/negative rotation.
  const turns = clockwise
  ? (sign === 0 ? 1 : sign)
  : (sign === 0 ? -1 : -sign);

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
    const positionId = positionBySlot.get(
      slotKey(sticker.cube, sticker.normal)
    );

    if (!positionId) {
      throw new Error(
        `Missing destination for ${sticker.beadId}`
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
  stickers = solvedStickers();
  return getBeadPositions();
}
