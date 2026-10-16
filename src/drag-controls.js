
export function installDragControls({
  board,
  rings,
  positions,
  cubeMapping,
  getBeadPositions,
  turnFace,
  onTurn
}) {
  const TAU = Math.PI * 2;
  const DRAG_THRESHOLD = 14;

  const faces = {
    yellow:  { axis: 'z', sign:  1 },
    red:     { axis: 'z', sign: -1 },
    magenta: { axis: 'y', sign:  1 },
    blue:    { axis: 'y', sign: -1 },
    cyan:    { axis: 'x', sign:  1 },
    green:   { axis: 'x', sign: -1 }
  };

  const backFaces = new Set([
    'red', 'green', 'blue'
  ]);

  const slotInfo = new Map(
    cubeMapping.map(item => [
      item.positionId, item
    ])
  );

  let gesture = null;

  board.style.touchAction = 'none';

  function svgPoint(event) {
    const point = board.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const matrix = board.getScreenCTM();
    if (!matrix) return null;

    return point.matrixTransform(matrix.inverse());
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalize(v) {
    const length = Math.hypot(v.x, v.y);
    if (length < 0.0001) return null;

    return {
      x: v.x / length,
      y: v.y / length
    };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function isFacePosition(positionId, face) {
    const info = slotInfo.get(positionId);
    const direction = faces[face];

    return (
      info?.normal?.[direction.axis] ===
      direction.sign
    );
  }

  function isCenter(positionId) {
    const info = slotInfo.get(positionId);
    if (!info) return false;

    const { x, y, z } = info.cube;

    return (
      Math.abs(x) +
      Math.abs(y) +
      Math.abs(z) === 1
    );
  }

  function faceAtCenter(positionId) {
    for (const face of Object.keys(faces)) {
      if (
        isCenter(positionId) &&
        isFacePosition(positionId, face)
      ) {
        return face;
      }
    }

    return null;
  }

  function closestBead(point, state) {
    let best = null;

    for (const bead of state) {
      const position = positions.get(bead.positionId);
      if (!position) continue;

      const d = distance(point, position);

      if (!best || d < best.distance) {
        best = {
          ...bead,
          position,
          distance: d
        };
      }
    }

    return best;
  }

  function closestRing(point) {
    let best = null;

    for (const ring of rings) {
      const d = Math.abs(
        Math.hypot(
          point.x - ring.x,
          point.y - ring.y
        ) - ring.radius
      );

      if (!best || d < best.distance) {
        best = { ring, distance: d };
      }
    }

    return best;
  }

  function nearestBeadOnRing(point, ring, state) {
    let best = null;

    for (const bead of state) {
      const position = positions.get(bead.positionId);

      if (!position?.rings?.includes(ring.id)) {
        continue;
      }

      const d = distance(point, position);

      if (!best || d < best.distance) {
        best = {
          ...bead,
          position,
          distance: d
        };
      }
    }

    return best;
  }

  // Preview a turn, then immediately undo it.
  // No rendering happens during this calculation.
  function previewTurn(face, clockwise) {
    turnFace(face, clockwise);

    try {
      return new Map(
        getBeadPositions().map(bead => [
          bead.beadId,
          bead.positionId
        ])
      );
    } finally {
      turnFace(face, !clockwise);
    }
  }

  function sideDirection(start, ring, face, clockwise) {
    // Matches the visual directions established
    // for the ring animation.
    const visuallyClockwise =
      backFaces.has(face)
        ? !clockwise
        : clockwise;

    const angle = Math.atan2(
      start.y - ring.y,
      start.x - ring.x
    );

    const tangent = {
      x: -Math.sin(angle),
      y: Math.cos(angle)
    };

    return visuallyClockwise
      ? tangent
      : { x: -tangent.x, y: -tangent.y };
  }

  function candidateDirection({
    bead,
    endId,
    face,
    clockwise,
    selectedRing
  }) {
    if (endId === bead.positionId) {
      return null;
    }

    const start = bead.position;
    const end = positions.get(endId);

    if (!end) return null;

    // Face stickers travel diagonally.
    if (isFacePosition(bead.positionId, face)) {
      if (selectedRing) return null;

      return normalize({
        x: end.x - start.x,
        y: end.y - start.y
      });
    }

    // Side stickers travel along their shared ring.
    const shared = (start.rings || []).filter(
      id => (end.rings || []).includes(id)
    );

    const possibleRings = selectedRing
      ? shared.filter(id => id === selectedRing.id)
      : shared;

    if (possibleRings.length === 0) {
      return null;
    }

    return possibleRings.map(id => {
      const ring = rings.find(r => r.id === id);

      return ring
        ? sideDirection(start, ring, face, clockwise)
        : null;
    }).filter(Boolean);
  }



const middleMoves = ['middleX', 'middleY', 'middleZ'];

function middleMoveForRing(ring) {
  const axisByMove = {
    middleX: 'x',
    middleY: 'y',
    middleZ: 'z'
  };

  let bestMove = null;
  let bestScore = -1;

  for (const move of middleMoves) {
    const axis = axisByMove[move];

    const score = cubeMapping.filter(sticker =>
      sticker.diagram.rings.includes(ring.id) &&
      sticker.cube[axis] === 0
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

const RING_MOVES = {
  U0: 'yellow',
  U1: 'middleZ',
  U2: 'red',

  L0: 'magenta',
  L1: 'middleY',
  L2: 'blue',

  R0: 'cyan',
  R1: 'middleX',
  R2: 'green'
};


function ringDragChoice(ring, start, drag) {
  const face = RING_MOVES[ring.id];
  if (!face) return null;

  const direction = normalize(drag);
  if (!direction) return null;

  const angle = Math.atan2(
    start.y - ring.y,
    start.x - ring.x
  );

  // Tangent pointing clockwise in SVG coordinates
  const tangent = {
    x: -Math.sin(angle),
    y: Math.cos(angle)
  };

  const score = dot(direction, tangent);

  if (Math.abs(score) < 0.65) {
    return null;
  }

  const reversed = ['red', 'green', 'blue'].includes(face);

return {
  face,
  clockwise: reversed ? score < 0 : score > 0,
  score: Math.abs(score)
};
}


function middleRingChoice(bead, selectedRing, drag) {
  const direction = normalize(drag);
  if (!direction) return null;

  const possibleRings = selectedRing
    ? [selectedRing]
    : rings.filter(ring =>
        ring.id.endsWith('1') &&
        bead.position.rings.includes(ring.id)
      );

  let best = null;

  for (const ring of possibleRings) {
    if (!ring.id.endsWith('1')) continue;

    const move = middleMoveForRing(ring);

    const angle = Math.atan2(
      bead.position.y - ring.y,
      bead.position.x - ring.x
    );

    const tangent = {
      x: -Math.sin(angle),
      y: Math.cos(angle)
    };

    for (const clockwise of [true, false]) {
      const preview = previewTurn(move, clockwise);

      if (
        preview.get(bead.beadId) === bead.positionId
      ) {
        continue;
      }

      const travelDirection = clockwise
        ? tangent
        : { x: -tangent.x, y: -tangent.y };

      const score = dot(direction, travelDirection);

      if (!best || score > best.score) {
        best = { face: move, clockwise, score };
      }
    }
  }

  return best && best.score > 0.65
    ? best
    : null;
}


  function chooseTurn(bead, selectedRing, drag) {
    const dragDirection = normalize(drag);
    if (!dragDirection) return null;

    let best = null;

    for (const face of Object.keys(faces)) {
      for (const clockwise of [true, false]) {
        const preview = previewTurn(face, clockwise);
        const endId = preview.get(bead.beadId);

        const directions = candidateDirection({
            bead,
            endId,
            face,
            clockwise,
            selectedRing: null
        });

        if (!directions) continue;

        const options = Array.isArray(directions)
          ? directions
          : [directions];

        for (const direction of options) {
          const score = dot(dragDirection, direction);

          if (!best || score > best.score) {
            best = { face, clockwise, score };
          }
        }
      }
    }

    // Avoid triggering an unrelated turn from
    // a poorly aligned drag.
    return best && best.score > 0.65
      ? best
      : null;
  }

  board.addEventListener('contextmenu', event => {
    event.preventDefault();
  });

  board.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    const point = svgPoint(event);
    if (!point) return;

    const state = getBeadPositions();

    const nearbyBead = closestBead(point, state);
    const nearbyRing = closestRing(point);

    let bead = null;
    let selectedRing = null;

    if (nearbyBead && nearbyBead.distance <= 25) {
      bead = nearbyBead;
    } else if (nearbyRing && nearbyRing.distance <= 12) {
      selectedRing = nearbyRing.ring;

      bead = nearestBeadOnRing(
        point,
        selectedRing,
        state
      );
    }

    if (!bead) return;

    gesture = {
      pointerId: event.pointerId,
      button: event.button,
      start: point,
      bead,
      selectedRing,
      centerFace: faceAtCenter(bead.positionId),
      triggered: false
    };

    board.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  board.addEventListener('pointermove', event => {
    if (
      !gesture ||
      event.pointerId !== gesture.pointerId ||
      gesture.triggered
    ) {
      return;
    }

    const point = svgPoint(event);
    if (!point) return;

    const drag = {
      x: point.x - gesture.start.x,
      y: point.y - gesture.start.y
    };

    if (Math.hypot(drag.x, drag.y) < DRAG_THRESHOLD) {
      return;
    }

    const choice = gesture.selectedRing
    ? ringDragChoice(
        gesture.selectedRing,
        gesture.start,
        drag
        )
    : middleRingChoice(
        gesture.bead,
        null,
        drag
        ) || chooseTurn(
        gesture.bead,
        null,
        drag
        );

    gesture.triggered = true;
    onTurn(choice.face, choice.clockwise);
  });

  board.addEventListener('pointerup', event => {
    if (
      !gesture ||
      event.pointerId !== gesture.pointerId
    ) {
      return;
    }

    if (
      !gesture.triggered &&
      gesture.centerFace
    ) {
      // Left click = counterclockwise
      // Right click = clockwise
      onTurn(
        gesture.centerFace,
        gesture.button === 2
      );
    }

    gesture = null;
  });

  board.addEventListener('pointercancel', () => {
    gesture = null;
  });
}
