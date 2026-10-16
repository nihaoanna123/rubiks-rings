
const Cube = window.Cube;
import { cubeMapping } from './cube-mapping.js';

const FACES = [
  { letter: 'U', color: 'yellow', normal: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  { letter: 'R', color: 'cyan', normal: [1, 0, 0], right: [0, 1, 0], up: [0, 0, 1] },
  { letter: 'F', color: 'blue', normal: [0, -1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  { letter: 'D', color: 'red', normal: [0, 0, -1], right: [1, 0, 0], up: [0, -1, 0] },
  { letter: 'L', color: 'green', normal: [-1, 0, 0], right: [0, -1, 0], up: [0, 0, 1] },
  { letter: 'B', color: 'magenta', normal: [0, 1, 0], right: [-1, 0, 0], up: [0, 0, 1] }
];

const dot = (v, a) =>
  v.x * a[0] + v.y * a[1] + v.z * a[2];

const faceSlots = FACES.flatMap(face =>
  cubeMapping
    .filter(slot => dot(slot.normal, face.normal) === 1)
    .sort((a, b) =>
      -dot(a.cube, face.up) + dot(b.cube, face.up) ||
      dot(a.cube, face.right) - dot(b.cube, face.right)
    )
);

const centerSlots = FACES.map(face =>
  faceSlots.find(slot =>
    dot(slot.normal, face.normal) === 1 &&
    slot.cube.x ** 2 +
    slot.cube.y ** 2 +
    slot.cube.z ** 2 === 1
  )
);

const solvedCenters = centerSlots
  .map(slot => slot.color)
  .join(',');

const positionBySlot = new Map(
  cubeMapping.map(slot => [
    [
      slot.cube.x,
      slot.cube.y,
      slot.cube.z,
      slot.normal.x,
      slot.normal.y,
      slot.normal.z
    ].join(','),
    slot.positionId
  ])
);

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

function slicePermutation(axis, clockwise) {
  const turns = clockwise ? 1 : -1;

  return new Map(
    cubeMapping.map(slot => {
      if (slot.cube[axis] !== 0) {
        return [slot.positionId, slot.positionId];
      }

      const cube = rotateVector(
        slot.cube,
        axis,
        turns
      );

      const normal = rotateVector(
        slot.normal,
        axis,
        turns
      );

      const key = [
        cube.x,
        cube.y,
        cube.z,
        normal.x,
        normal.y,
        normal.z
      ].join(',');

      const destination = positionBySlot.get(key);

      if (!destination) {
        throw new Error(
          `Missing slice destination: ${key}`
        );
      }

      return [slot.positionId, destination];
    })
  );
}

const sliceMoves = [
  'middleX',
  'middleY',
  'middleZ'
].flatMap(face =>
  [true, false].map(clockwise => ({
    face,
    clockwise,
    permutation: slicePermutation(
      face.slice(-1).toLowerCase(),
      clockwise
    )
  }))
);

function applyPermutation(beads, permutation) {
  return beads.map(bead => ({
    ...bead,
    positionId: permutation.get(bead.positionId)
  }));
}

function centerKey(beads) {
  const colors = new Map(
    beads.map(bead => [
      bead.positionId,
      bead.color
    ])
  );

  return centerSlots
    .map(slot => colors.get(slot.positionId))
    .join(',');
}

// Restore the six centers before using cubejs.
// This searches center arrangements, not full cube states.
function restoreCenters(beads) {
  if (centerKey(beads) === solvedCenters) {
    return { beads, moves: [] };
  }

  const queue = [{ beads, moves: [] }];
  const seen = new Set([centerKey(beads)]);

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];

    for (const move of sliceMoves) {
      const next = applyPermutation(
        current.beads,
        move.permutation
      );

      const key = centerKey(next);

      if (seen.has(key)) continue;

      const moves = [
        ...current.moves,
        {
          face: move.face,
          clockwise: move.clockwise
        }
      ];

      if (key === solvedCenters) {
        return {
          beads: next,
          moves
        };
      }

      seen.add(key);
      queue.push({ beads: next, moves });
    }
  }

  throw new Error(
    'Cannot restore center arrangement'
  );
}


const ALL_LAYERS = [
  ['yellow', 'z', 1],
  ['red', 'z', -1],
  ['magenta', 'y', 1],
  ['blue', 'y', -1],
  ['cyan', 'x', 1],
  ['green', 'x', -1],
  ['middleX', 'x', 0],
  ['middleY', 'y', 0],
  ['middleZ', 'z', 0]
];

const slotIndex = new Map(
  cubeMapping.map((slot, i) => [slot.positionId, i])
);

const palette = FACES.map(face => face.color);

const solvedKey = cubeMapping.map(slot =>
  String.fromCharCode(65 + palette.indexOf(slot.color))
).join('');

const SEARCH_MOVES = ALL_LAYERS.flatMap(
  ([face, axis, sign]) =>
    [true, false].map(clockwise => {
      const turns = clockwise
        ? (sign || 1)
        : -(sign || 1);

      const permutation = cubeMapping.map((slot, from) => {
        if (slot.cube[axis] !== sign) return from;

        const cube = rotateVector(slot.cube, axis, turns);
        const normal = rotateVector(slot.normal, axis, turns);

        const key = [
          cube.x, cube.y, cube.z,
          normal.x, normal.y, normal.z
        ].join(',');

        return slotIndex.get(positionBySlot.get(key));
      });

      return { face, clockwise, permutation };
    })
);

function transformKey(key, permutation) {
  const result = new Array(54);

  for (let i = 0; i < 54; i++) {
    result[permutation[i]] = key[i];
  }

  return result.join('');
}

function inverseMove(index) {
  return index ^ 1;
}

function shortSearch(beads, maxDepth = 10) {
  const colors = new Map(
    beads.map(bead => [bead.positionId, bead.color])
  );

  const start = cubeMapping.map(slot => {
    const index = palette.indexOf(
      colors.get(slot.positionId)
    );

    if (index < 0) {
      throw Error('Invalid sticker color');
    }

    return String.fromCharCode(65 + index);
  }).join('');

  if (start === solvedKey) return [];

  function reconstruct(visited, key) {
    const path = [];

    while (visited.get(key).parent !== null) {
      const node = visited.get(key);
      path.push(node.move);
      key = node.parent;
    }

    return path.reverse();
  }

  const forward = new Map([
    [start, { parent: null, move: -1 }]
  ]);

  const backward = new Map([
    [solvedKey, { parent: null, move: -1 }]
  ]);

  let fLayer = [start];
  let bLayer = [solvedKey];

  // Protect the browser from excessive memory use.
  const MAX_VISITED = 700000;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const expandForward = depth % 2 === 1;

    const own = expandForward ? forward : backward;
    const other = expandForward ? backward : forward;
    const layer = expandForward ? fLayer : bLayer;

    const nextLayer = [];

    for (const key of layer) {
      const previous = own.get(key).move;

      for (let m = 0; m < SEARCH_MOVES.length; m++) {
        // Do not immediately undo the previous move.
        if (
          previous !== -1 &&
          m === inverseMove(previous)
        ) {
          continue;
        }

        const next = transformKey(
          key,
          SEARCH_MOVES[m].permutation
        );

        if (own.has(next)) continue;

        own.set(next, {
          parent: key,
          move: m
        });

        if (other.has(next)) {
          const first = reconstruct(forward, next);

          const second = reconstruct(backward, next)
            .reverse()
            .map(inverseMove);

          return [...first, ...second].map(index => ({
            face: SEARCH_MOVES[index].face,
            clockwise: SEARCH_MOVES[index].clockwise
          }));
        }

        nextLayer.push(next);

        if (
          forward.size + backward.size > MAX_VISITED
        ) {
          return null;
        }
      }
    }

    if (expandForward) {
      fLayer = nextLayer;
    } else {
      bLayer = nextLayer;
    }

    if (!nextLayer.length) break;
  }

  return null;
}


let initialized = false;

export function solveCube(beads) {
  if (!Cube) {
    throw new Error(
      'cubejs scripts are not loaded'
    );
  }
    const short = shortSearch(beads, 10);
  if (short !== null) return short;

  if (!initialized) {
    Cube.initSolver();
    initialized = true;
  }

  // Step 1: Restore centers using middle-slice moves.
  const {
    beads: normalized,
    moves: centerMoves
  } = restoreCenters(beads);

  // Step 2: Convert the resulting cube to cubejs notation.
  const colors = new Map(
    normalized.map(bead => [
      bead.positionId,
      bead.color
    ])
  );

  const state = faceSlots.map(slot => {
    const face = FACES.find(
      f => f.color === colors.get(slot.positionId)
    );

    if (!face) {
      throw new Error(
        `Unknown color at ${slot.positionId}`
      );
    }

    return face.letter;
  }).join('');

  // Step 3: Solve the remaining outer-face configuration.
  const cube = Cube.fromString(state);
  const solution = cube.solve().trim();

  const outerMoves = solution
    ? solution.split(/\s+/).flatMap(token => {
        const face = FACES.find(
          f => f.letter === token[0]
        );

        if (!face) {
          throw new Error(
            `Unsupported solver move: ${token}`
          );
        }

        const count = token.includes('2') ? 2 : 1;

        return Array.from(
          { length: count },
          () => ({
            face: face.color,
            clockwise: token.includes("'")
          })
        );
      })
    : [];

  // Step 4: Return all moves in execution order.
  return [
    ...centerMoves,
    ...outerMoves
  ];
}
