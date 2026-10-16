// The six faces of a Rubik's Cube.
// Each face has nine stickers.

export const faces = [
  { name: 'U', color: '#ffffff' },
  { name: 'D', color: '#ffd500' },
  { name: 'F', color: '#009b48' },
  { name: 'B', color: '#0046ad' },
  { name: 'R', color: '#b71234' },
  { name: 'L', color: '#ff5800' },
];

// Create 54 individually identifiable stickers.
export const stickers = faces.flatMap(face =>
  Array.from({ length: 9 }, (_, index) => ({
    id: `${face.name}${index}`,
    face: face.name,
    color: face.color,
  }))
);

// Temporary positions for the six groups of stickers.
// We'll replace these with coordinates from the reference video.

export const faceCenters = {
  U: { x: 400, y: 120 },
  L: { x: 180, y: 260 },
  F: { x: 400, y: 260 },
  R: { x: 620, y: 260 },
  D: { x: 400, y: 420 },
  B: { x: 620, y: 420 },
};

export function getStickerPosition(sticker) {
  const center = faceCenters[sticker.face];

  const column = (Number(sticker.id.slice(1)) % 3) - 1;
  const row = Math.floor(Number(sticker.id.slice(1)) / 3) - 1;

  return {
    x: center.x + column * 25,
    y: center.y + row * 25,
  };
}