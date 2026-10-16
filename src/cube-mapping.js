
import pieces from './cube-pieces.json';

// Opposite faces have opposite coordinate directions.
export const faceDirections = {
  yellow:  [ 0,  0,  1],
  red:     [ 0,  0, -1],
  magenta: [ 0,  1,  0],
  blue:    [ 0, -1,  0],
  cyan:    [ 1,  0,  0],
  green:   [-1,  0,  0]
};

const vector = ([x, y, z]) => ({ x, y, z });

export const cubeMapping = [
  ...pieces.corners,
  ...pieces.edges,
  ...pieces.centers
].flatMap(piece => {
  // A cubie's coordinates are determined by the
  // faces on which its stickers lie.
  const location = [0, 0, 0];

  for (const bead of piece.beads) {
    const direction = faceDirections[bead.color];

    for (let axis = 0; axis < 3; axis++) {
      location[axis] += direction[axis];
    }
  }

  return piece.beads.map(bead => ({
    positionId: bead.positionId,
    beadId: bead.beadId,
    color: bead.color,
    pieceId: piece.id,

    diagram: {
      x: bead.x,
      y: bead.y,
      rings: bead.rings
    },

    cube: vector(location),
    normal: vector(faceDirections[bead.color])
  }));
});

cubeMapping.sort(
  (a, b) =>
    Number(a.positionId.slice(1)) -
    Number(b.positionId.slice(1))
);

// Every sticker must occupy a unique 3D slot.
const slots = new Set(
  cubeMapping.map(p =>
    JSON.stringify([p.cube, p.normal])
  )
);

if (cubeMapping.length !== 54 || slots.size !== 54) {
  throw new Error('Invalid 2D-to-3D cube mapping');
}

console.log('54 cube sticker positions verified');
console.table(cubeMapping);
