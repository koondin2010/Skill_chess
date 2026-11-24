import React from 'react';
import { PieceColor, PieceType } from '../types/chess';

/**
 * 16x16 pixel-art sprite matrices for chess pieces.
 * Legend:
 *  '.' = transparent
 *  'O' = dark pixel outline (#10131C)
 *  'M' = main body color
 *  'H' = highlight color
 *  'S' = shadow / depth color
 *  'A' = accent trim (gold/amber for crown/cross/collar)
 */
const SPRITES: Record<PieceType, string[]> = {
  p: [
    '................',
    '......OOOO......',
    '.....OHHHMO.....',
    '.....OHMMMO.....',
    '.....OMMMMO.....',
    '......OMSO......',
    '.....OAAAOO.....',
    '......OMMO......',
    '.....OMMMMO.....',
    '.....OMMMSO.....',
    '....OMMMMMSO....',
    '....OAAAAASO....',
    '...OOHMMMMMOO...',
    '...OMMMMMMMMO...',
    '...OOOOOOOOOO...',
    '................',
  ],
  r: [
    '................',
    '..OOO..OO..OOO..',
    '..OHMOOHMOOHMO..',
    '..OMMMMMMMMMMO..',
    '..OMMSSSSSSMMO..',
    '...OAAAAAAAOO...',
    '....OMMMMMMO....',
    '....OMMMMMSO....',
    '....OMMMMMSO....',
    '....OMMMMMSO....',
    '...OMMMMMMMSO...',
    '...OAAAAAAASO...',
    '..OOHMMMMMMMOO..',
    '..OMMMMMMMMMMO..',
    '..OOOOOOOOOOOO..',
    '................',
  ],
  n: [
    '................',
    '......OOOOO.....',
    '.....OHHHMMO....',
    '....OHMMMMMMO...',
    '...OHMMAMMMMMO..',
    '..OHMMMMMMMMMO..',
    '..OMMMOOOMMMMO..',
    '...OOO..OMMMSO..',
    '.......OMMMMSO..',
    '......OMMMMMSO..',
    '.....OMMMMMMSO..',
    '....OAAAAAAASO..',
    '...OOHMMMMMMOO..',
    '...OMMMMMMMMMO..',
    '...OOOOOOOOOOO..',
    '................',
  ],
  b: [
    '................',
    '.......OO.......',
    '......OAAO......',
    '.....OHMMMO.....',
    '....OHMMAMMO....',
    '....OMMAAMMO....',
    '....OMMMAMMO....',
    '.....OMMMMO.....',
    '......OMSO......',
    '.....OAAAOO.....',
    '....OMMMMMSO....',
    '....OAAAAASO....',
    '...OOHMMMMMOO...',
    '...OMMMMMMMMO...',
    '...OOOOOOOOOO...',
    '................',
  ],
  q: [
    '................',
    '.OO...OOOO...OO.',
    '.OAO.OHHHHO.OAO.',
    '..OMOOMMMMOOMO..',
    '..OHMOMMMMOMMO..',
    '...OMMMMMMMMO...',
    '...OMAAAMAAAO...',
    '....OMMMMMMO....',
    '....OMMMMMSO....',
    '....OAAAAAOO....',
    '...OMMMMMMMSO...',
    '...OAAAAAAASO...',
    '..OOHMMMMMMMOO..',
    '..OMMMMMMMMMMO..',
    '..OOOOOOOOOOOO..',
    '................',
  ],
  k: [
    '................',
    '.......OO.......',
    '......OAAO......',
    '.....OAAAAO.....',
    '......OAAO......',
    '...OOOOMMOOOO...',
    '..OHMMOMMOMMMO..',
    '..OMMMMMMMMMMO..',
    '...OMMMMMMMSO...',
    '....OAAAAAOO....',
    '....OMMMMMSO....',
    '...OAAAAAAASO...',
    '..OOHMMMMMMMOO..',
    '..OMMMMMMMMMMO..',
    '..OOOOOOOOOOOO..',
    '................',
  ],
};

const PALETTES: Record<
  PieceColor,
  { O: string; M: string; H: string; S: string; A: string }
> = {
  w: {
    O: '#141720',
    M: '#F3EFE0',
    H: '#FFFFFF',
    S: '#C4BBA3',
    A: '#E5A93B',
  },
  b: {
    O: '#090B10',
    M: '#343D52',
    H: '#5C6985',
    S: '#1F2533',
    A: '#D97724',
  },
};

interface PixelPieceProps {
  type: PieceType;
  color: PieceColor;
  className?: string;
}

export const PixelPiece: React.FC<PixelPieceProps> = React.memo(({ type, color, className = 'w-full h-full' }) => {
  const rows = SPRITES[type];
  const palette = PALETTES[color];

  const rects: Array<{ x: number; y: number; w: number; fill: string }> = [];

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) {
        run++;
      }
      const fill = palette[ch as keyof typeof palette];
      if (fill) {
        rects.push({ x, y, w: run, fill });
      }
      x += run;
    }
  }

  return (
    <svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {rects.map((r, idx) => (
        <rect key={idx} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
});

PixelPiece.displayName = 'PixelPiece';
