import React from 'react';
import type { AiLevel, AugmentId, RankTierId, SkillId } from '../types/chess';

interface MatrixSpriteProps {
  rows: string[];
  palette: Record<string, string>;
  className?: string;
}

const MatrixSprite: React.FC<MatrixSpriteProps> = ({ rows, palette, className = 'w-full h-full' }) => {
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
      const fill = palette[ch];
      if (fill) rects.push({ x, y, w: run, fill });
      x += run;
    }
  }
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
};

const SKILL_SPRITES: Record<
  SkillId,
  { rows: string[]; palette: Record<string, string> }
> = {
  march: {
    rows: [
      '................',
      '.......OO.......',
      '......OYYO......',
      '.....OYYYYO.....',
      '....OO.OO.OO....',
      '...OYYO..OYYO...',
      '..OOOOO..OOOOO..',
      '..ORRRRO........',
      '..ORWWRO..OOOO..',
      '..ORRRRO..OYYO..',
      '..ORRRRRROOOOO..',
      '..ORRRRRRRRRRO..',
      '..OYYYYYYYYYYO..',
      '..OOOOOOOOOOOO..',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', R: '#EF4444', W: '#FCA5A5', Y: '#FBBF24' },
  },
  leap: {
    rows: [
      '................',
      '......OOOOO.....',
      '....OOCCCCCO....',
      '...OCWWWWWCO....',
      '..OCWCCCCCCO....',
      '.OCWC..OO.......',
      '.OCCO.OCCO......',
      '.OOO.OCWWCO.....',
      '.....OCWCCO.....',
      '....OOCCCCO.....',
      '...OCCCCCCO.....',
      '..OCWWCCCCO.....',
      '..OCCCCCCOO.....',
      '...OOOOOOO......',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', C: '#34D399', W: '#D1FAE5' },
  },
  diagonal_rook: {
    rows: [
      '................',
      '.OO..........OO.',
      '.ORO.OO..OO.OYYO',
      '..ORROOOOOOORRO.',
      '...ORRRRRRRRRO..',
      '...OMMMMMMMMO...',
      '....OMMRRMMO....',
      '....OMRWWMMO....',
      '....OMMRRMMO....',
      '....OMMMMMMO....',
      '...OMMRRMMMOO...',
      '..OMMRMMMMMMRO..',
      '..OMMMMMMMMMRRO.',
      '..OOOOOOOOOOOOO.',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', M: '#94A3B8', R: '#EF4444', W: '#FEE2E2', Y: '#FBBF24' },
  },
  retreat: {
    rows: [
      '................',
      '................',
      '.....OOOOO......',
      '....OBWWWBO.....',
      '...OBBBBBBO.....',
      '..OBBBBBBBBO....',
      '..OBBBOOBBBO....',
      '..OBBO..OBBO....',
      '......OOOO......',
      '....OOBBBBO.....',
      '..OOBWWBBBBO....',
      '.OBWWBBBBBBBO...',
      '..OOBBBBBBOO....',
      '....OOOOOO......',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', B: '#38BDF8', W: '#E0F2FE' },
  },
  shield: {
    rows: [
      '................',
      '...OOOOOOOOOO...',
      '..OYYYYYYYYYYO..',
      '..OYWWWWWWWWYO..',
      '..OYWYYYYYYWYO..',
      '..OYWYOOOOYWYO..',
      '..OYWYOAAOYWYO..',
      '..OYWYOAAOYWYO..',
      '..OYWYOOOOYWYO..',
      '...OYWYYYYWYO...',
      '...OYYWWWWYYO...',
      '....OYYYYYYO....',
      '.....OYYYYO.....',
      '......OOOO......',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#F59E0B', W: '#FEF3C7', A: '#60A5FA' },
  },
  smoke: {
    rows: [
      '.......OOOO.....',
      '......OGWWGO....',
      '.....OGGGGGGO...',
      '..OOOOOGGGGO....',
      '.OGWWGGOOOOO....',
      '.OGGGGGOOO......',
      '..OOOOOYYO......',
      '.....OOOOOO.....',
      '....ODDDDDDO....',
      '...ODDWWWWDDO...',
      '...ODDWDDDDDO...',
      '...ODDDDDDDDO...',
      '....ODDDDDDO....',
      '.....OOOOOO.....',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', G: '#94A3B8', W: '#E2E8F0', D: '#475569', Y: '#FBBF24' },
  },
  freeze: {
    rows: [
      '.......OO.......',
      '......OCCO......',
      '..OO..OCCO..OO..',
      '.OCCO.OCWO.OCCO.',
      '..OCCOOCWOOCWO..',
      '...OCCWWWWCCO...',
      '.OOOCWWWWWWCOOO.',
      'OCCWWWWWWWWWCCCO',
      '.OOOCWWWWWWCOOO.',
      '...OCCWWWWCCO...',
      '..OCWOOCWOOCWO..',
      '.OCCO.OCWO.OCCO.',
      '..OO..OCCO..OO..',
      '......OCCO......',
      '.......OO.......',
      '................',
    ],
    palette: { O: '#0F131D', C: '#22D3EE', W: '#ECFEFF' },
  },
  swap: {
    rows: [
      '................',
      '........OO......',
      '.......OYYO.....',
      '..OOOOOOYYYO....',
      '.OYYYYYYYYYYO...',
      '..OOOOOOYYYO....',
      '.......OYYO.....',
      '........OO......',
      '......OO........',
      '.....OCCO.......',
      '....OCCCCOOOOO..',
      '...OCCCCCCCCCCO.',
      '....OCCCCOOOOO..',
      '.....OCCO.......',
      '......OO........',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#FBBF24', C: '#38BDF8' },
  },
  revive: {
    rows: [
      '.....OOOOOO.....',
      '...OOGGGGGGOO...',
      '..OGGWWWWWWGGO..',
      '.OGWWGGGGGGWWGO.',
      '.OGWGGOYYOGGWGO.',
      '.OGWGOYYYYOGWGO.',
      '.OGWGOYYYYOGWGO.',
      '.OGWGGOYYOGGWGO.',
      '.OGWGGGGGGGGWGO.',
      '..OGGWWWWWWGGO..',
      '...OOGGGGGGOO...',
      '....OGGGGGGO....',
      '...OOGGGGGGOO...',
      '..OOOOOOOOOOOO..',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', G: '#10B981', W: '#A7F3D0', Y: '#FEF08A' },
  },
  snipe: {
    rows: [
      '.......OO.......',
      '......ORRO......',
      '....OOORROOO....',
      '...ORWWOOOWRO...',
      '..ORWO.OO.OWRO..',
      '..ORO..OO..ORO..',
      '.OORROOOOOORROO.',
      '.ORWWWWYYWWWWR0.'.replace('0', 'O'),
      '.OORROOOOOORROO.',
      '..ORO..OO..ORO..',
      '..ORWO.OO.OWRO..',
      '...ORWWOOOWRO...',
      '....OOORROOO....',
      '......ORRO......',
      '.......OO.......',
      '................',
    ],
    palette: { O: '#0F131D', R: '#EF4444', W: '#FCA5A5', Y: '#FDE047' },
  },
  bishop_shift: {
    rows: [
      '.......OO.......',
      '......OYYO......',
      '.....OHMMHO.....',
      '....OHMMMMHO....',
      '..OO.OMMMMO.OO..',
      '.OCCO.OMMO.OBBO.',
      'OCWWCOOOOOOBWWBO',
      '.OCCO.OMMO.OBBO.',
      '..OO.OMMMMO.OO..',
      '....OAAAAAAO....',
      '...OMMMMMMMMO...',
      '...OAAAAAAAAO...',
      '..OOOOOOOOOOOO..',
      '................',
      '................',
      '................',
    ],
    palette: {
      O: '#0F131D',
      Y: '#FBBF24',
      H: '#E2E8F0',
      M: '#94A3B8',
      A: '#F59E0B',
      C: '#F8FAFC',
      B: '#334155',
      W: '#93C5FD',
    },
  },
  camel_jump: {
    rows: [
      '................',
      '....OOOOOO......',
      '...OYWWWWYO.....',
      '..OYYYYYYYYO....',
      '..OYOOYYYYYYO...',
      '..OO..OYYYYYO...',
      '......OYYRRYO...',
      '....OOOYRRRYO...',
      '...OYYOYYYYO....',
      '..OYWO.OYYYO....',
      '.OYWO..OOOOOO...',
      '.OOO..OYYWWYYO..',
      '......OOOOOOOO..',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#F59E0B', W: '#FEF3C7', R: '#EF4444' },
  },
  disarm: {
    rows: [
      '................',
      '..OO........OO..',
      '.ORRO......OGGO.',
      '..ORRO....OGWO..',
      '...ORRO..OGGO...',
      '....ORROOGGO....',
      '.....ORGGRO.....',
      '....OGGORRRO....',
      '...OGWO..ORRO...',
      '..OGGO....ORRO..',
      '.OYYO......OYYO.',
      '..OO........OO..',
      '...OOOOOOOOOO...',
      '....ORRRRRRO....',
      '....OOOOOOOO....',
      '................',
    ],
    palette: { O: '#0F131D', R: '#EF4444', G: '#94A3B8', W: '#E2E8F0', Y: '#FBBF24' },
  },
  pawn_guard: {
    rows: [
      '................',
      '......OOOO......',
      '.....OGGGGO.....',
      '.....OGWWGO.....',
      '......OGGO......',
      '.....OYYYYO.....',
      '..OO..OGGO..OO..',
      '.OBBOOGGGGOOBBO.',
      '.OBWBOOGGOOBWBO.',
      '.OBBBOOGGOOBBBO.',
      '..OBB.OGGO.BBO..',
      '...OOOGGGGOOO...',
      '...OGGGGGGGGO...',
      '...OOOOOOOOOO...',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', G: '#10B981', W: '#D1FAE5', Y: '#FBBF24', B: '#60A5FA' },
  },
  phantom_step: {
    rows: [
      '................',
      '.....OOOOOO.....',
      '...OOPPPPPPOO...',
      '..OPWWWWWWWWPO..',
      '.OPWWPPPPPPWWPO.',
      '.OPWPOOPPPPOOWPO',
      '.OPWPOOPPPPOOWPO',
      '.OPPPPPPPPPPPPPO',
      '.OPPPPPPPPPPPPPO',
      '.OPPPPPPPPPPPPPO',
      '.OPPOPPPPOPPPOPO',
      '.OPO.OPPO.OPPO..',
      '..O...OO...OO...',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', P: '#A78BFA', W: '#EDE9FE' },
  },
  tactical_jam: {
    rows: [
      '................',
      '..OOOOOOOOOOOO..',
      '.OMMMMMMMMMMMMO.',
      '.OMDDMMMMMMDDMO.',
      '.OMMMWWWWWWMMMO.',
      '.OMMWWOOOOOWWMO.',
      '.OMMWOORROOWWMO.',
      '.OMMWWOYYOWWWMO.',
      '.OMMMWWOOOWWMMO.',
      '.OMMMMMMMMMMMMO.',
      '.OSSSSSSSSSSSSO.',
      '.OSDDSSDDSSDDSSO',
      '.OSSSSSSSSSSSSO.',
      '..OOOOOOOOOOOO..',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', M: '#7C3AED', D: '#4C1D95', W: '#DDD6FE', R: '#F43F5E', Y: '#FBBF24', S: '#334155' },
  },
  great_attack: {
    rows: [
      '.......OO.......',
      '......OYYO......',
      '.....OYWWYO.....',
      '..OO.OYYYYO.OO..',
      '.ORRO.OOOO.ORRO.',
      '.ORWRO.OO.ORWRO.',
      '..OO.ORRRRO.OO..',
      '.....ORWWRO.....',
      '....ORRRRRRO....',
      '....ORRRRRRO....',
      '.....ORRRRO.....',
      '....OYYYYYYO....',
      '...OYYYYYYYYO...',
      '...OOOOOOOOOO...',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#F59E0B', W: '#FEF3C7', R: '#EF4444' },
  },
  straight_bishop: {
    rows: [
      '.......OO.......',
      '......ORRO......',
      '.....ORWWRO.....',
      '......ORRO......',
      '..OO.OMMMMO.OO..',
      '.ORRO.OMMO.ORRO.',
      'ORWWROOOOOORWWRO',
      '.ORRO.OMMO.ORRO.',
      '..OO.OMMMMO.OO..',
      '....OYYYYYYO....',
      '...OMMMMMMMMO...',
      '...OYYYYYYYYO...',
      '..OOOOOOOOOOOO..',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', R: '#EF4444', W: '#FEE2E2', M: '#94A3B8', Y: '#FBBF24' },
  },
  trojan_horse: {
    rows: [
      '................',
      '..OO..OOOO..OO..',
      '.OYYO.OYYO.OYYO.',
      '.OYYYYYYYYYYYYO.',
      '..OYYWWWWWWYYO..',
      '...OYYYYYYYYO...',
      '...OYYBBBBYYO...',
      '...OYYWWWWYYO...',
      '..OYYYYYYYYYYO..',
      '..OYYOYYYYOYYO..',
      '.OYYYOYYYYOYYYO.',
      '.OYYO.OYYO.OYYO.',
      '..OO..OOOO..OO..',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#D97706', W: '#FDE68A', B: '#38BDF8' },
  },
  queens_gambit: {
    rows: [
      '................',
      '.OO....OO....OO.',
      '.OYO..OYYO..OYO.',
      '.OYO.OYWWYO.OYO.',
      '.OYYOOYYYYOOYYO.',
      '..OYYYYYYYYYYO..',
      '..OYYPWWWWPYYO..',
      '..OYYPPPPPPYYO..',
      '...OPPPPPPPPO...',
      '...OPWWWWWWPO...',
      '..OPPPPPPPPPPO..',
      '..OYYYYYYYYYYO..',
      '..OOOOOOOOOOOO..',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#FBBF24', W: '#FEF3C7', P: '#A855F7' },
  },
  pawn_surge: {
    rows: [
      '................',
      '..OO........OO..',
      '.OCCO......OCCO.',
      '.OCWCO.OO.OCWCO.',
      '..OCCOCCCCOCCO..',
      '....OCWWWWCO....',
      '..OO.OCCCCO.OO..',
      '.OCCO.OCCO.OCCO.',
      '.OCWCOCCCCOCWCO.',
      '..OO.OCCCCO.OO..',
      '....OCCWWCCO....',
      '....OCCCCCCCO...',
      '...OCCCCCCCCCO..',
      '...OOOOOOOOOOO..',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', C: '#34D399', W: '#ECFDF5' },
  },
  mana_drain: {
    rows: [
      '.......OO.......',
      '......OBBO......',
      '.....OBWWBO.....',
      '....OBBBBBBO....',
      '..OO.OBBBBO.OO..',
      '.OPPO.OOOO.OPPO.',
      '.OPWPO.OO.OPWPO.',
      '..OPPOOBBOOPPO..',
      '.....OBWWBO.....',
      '....OBBBBBBO....',
      '....OBBBBBBO....',
      '.....OBBBBO.....',
      '......OBBO......',
      '.......OO.......',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', B: '#38BDF8', W: '#E0F2FE', P: '#C084FC' },
  },
  shadow_bind: {
    rows: [
      '................',
      '..OOOO....OOOO..',
      '.OPPPPO..OPPPPO.',
      '.OPWWPOOOOPWWPO.',
      '..OPPOYYYYOPPO..',
      '...OOYWWWWYOO...',
      '..OPPYWWWWYPPO..',
      '..OPWOYYYYOWPO..',
      '..OPPOOOOOOPPO..',
      '...OOOPPPPOOO...',
      '..OPPPPOOPPPO...',
      '.OPWWPO..OPWWPO.',
      '.OPPPPO..OPPPPO.',
      '..OOOO....OOOO..',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', P: '#7C3AED', W: '#DDD6FE', Y: '#FBBF24' },
  },
  knight_sweep: {
    rows: [
      '.......OO.......',
      '..OO..ORRO..OO..',
      '.ORRO.ORWO.ORRO.',
      '..ORROOOOOORRO..',
      '...ORWWWWWWRO...',
      '..OORWYYYYWROO..',
      '.ORRWYYYYYYWRRO.',
      '..OORWYYYYWROO..',
      '...ORWWWWWWRO...',
      '..ORROOOOOORRO..',
      '.ORRO.ORRO.ORRO.',
      '..OO..ORRO..OO..',
      '.......OO.......',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', R: '#EF4444', W: '#FEE2E2', Y: '#FBBF24' },
  },
  field_promotion: {
    rows: [
      '.......OO.......',
      '......OYYO......',
      '.....OYWWYO.....',
      '....OYYYYYYO....',
      '...OYYOOOYYO....',
      '...OYOYYYYOYO...',
      '....OYYYYYYO....',
      '.....OYYYYO.....',
      '....OOOBBOOO....',
      '...OBBWWWWBBO...',
      '...OBBBBBBBBO...',
      '..OBBBBBBBBBBO..',
      '..OYYYYYYYYYYO..',
      '..OOOOOOOOOOOO..',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#FBBF24', W: '#FEF9C3', B: '#38BDF8' },
  },
  arcane_tome: {
    rows: [
      '.......OO.......',
      '......OYYO......',
      '..OOOOOYYOOOOO..',
      '.OBBBBBWWBBBBBO.',
      '.OBWWWBWWBWWWBO.',
      '.OBWCWBWWBWCWBO.',
      '.OBWWWBWWBWWWBO.',
      '.OBBBBBWWBBBBBO.',
      '.OBWCWBWWBWCWBO.',
      '.OBWWWBWWBWWWBO.',
      '.OBBBBBWWBBBBBO.',
      '..OYYYYOOYYYYO..',
      '...OOOOOOOOOO...',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', B: '#3B82F6', W: '#EFF6FF', C: '#22D3EE', Y: '#FBBF24' },
  },
  purify: {
    rows: [
      '.......OO.......',
      '......OWWO......',
      '.....OYYYYO.....',
      '......OWWO......',
      '..OO..OWWO..OO..',
      '.OWWO.OYYO.OWWO.',
      'OWWWWOYYYYOWWWWO',
      '.OWWO.OYYO.OWWO.',
      '..OO..OWWO..OO..',
      '......OWWO......',
      '.....OCCCCO.....',
      '....OCCWWCCO....',
      '.....OCCCCO.....',
      '......OOOO......',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', W: '#FEFCE8', Y: '#FACC15', C: '#38BDF8' },
  },
  royal_dash: {
    rows: [
      '................',
      '..OO...OO...OO..',
      '.OYYO.OYWO.OYYO.',
      '.OYYYOYYYYOYYYO.',
      '..OYYYYWWYYYYO..',
      '..OYYYYYYYYYYO..',
      '..OYYBBBBBBYYO..',
      '..OOOOOOOOOOOO..',
      '....OCC..CCO....',
      '..OOCCCOOCCCOO..',
      '.OCCWWCCCCWWCCO.',
      '..OOCCCOOCCCOO..',
      '....OO....OO....',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#FBBF24', W: '#FEF3C7', B: '#EF4444', C: '#38BDF8' },
  },
  alfil_leap: {
    rows: [
      '..OOOO....OOOO..',
      '.ORWWRO..ORWWRO.',
      '.ORRRRO..ORRRRO.',
      '..ORROO..OORRO..',
      '....OYYOOYYO....',
      '.....OYYYYO.....',
      '....OYYWWYYO....',
      '....OYYYYYYO....',
      '.....OYYYYO.....',
      '....OYYOOYYO....',
      '..ORROO..OORRO..',
      '.ORRRRO..ORRRRO.',
      '.ORWWRO..ORWWRO.',
      '..OOOO....OOOO..',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', R: '#EF4444', W: '#FEE2E2', Y: '#F59E0B' },
  },
  vanguard_lance: {
    rows: [
      '.......OO.......',
      '......OWWO......',
      '.....OWMMWO.....',
      '.....OMWWMO.....',
      '......OMMO......',
      '......OMMO......',
      '....OOYYYYOO....',
      '...OYYWWWWYYO...',
      '....OOORROOO....',
      '......ORRO......',
      '......ORRO......',
      '......ORRO......',
      '.....OYYYYO.....',
      '......OOOO......',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', W: '#F8FAFC', M: '#94A3B8', Y: '#FBBF24', R: '#EF4444' },
  },
  center_drop: {
    rows: [
      '................',
      '..OOOO....OOOO..',
      '.OGGGGO..OGGGGO.',
      '.OGWWGO..OGWWGO.',
      '.OGGGGO..OGGGGO.',
      '..OOOOOYYOOOOO..',
      '......OYYO......',
      '.....OYWWYO.....',
      '......OYYO......',
      '..OOOOOYYOOOOO..',
      '.OGGGGO..OGGGGO.',
      '.OGWWGO..OGWWGO.',
      '.OGGGGO..OGGGGO.',
      '..OOOO....OOOO..',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', G: '#10B981', W: '#D1FAE5', Y: '#FACC15' },
  },
  royal_escape: {
    rows: [
      '................',
      '.OO.OO..OO......',
      '.OYYYO.OBBO.OO..',
      '.OYWYO.OBBBBBBO.',
      '.OYYYO.OBWWBBBO.',
      '..OOO..OBBBBBBO.',
      '..OO.OYYOO.OBBO.',
      '.OCCOYYYYO..OO..',
      '.OCWCOYYO..OBBO.',
      '..CCO....OOBBBO.',
      '....OO..OBBWWBO.',
      '...OYYO.OBBBBBO.',
      '....OO..OOOOOOO.',
      '................',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', Y: '#FBBF24', W: '#FEF3C7', B: '#38BDF8', C: '#A78BFA' },
  },
};

export const SkillPixelIllustration: React.FC<{
  skillId: SkillId;
  className?: string;
}> = React.memo(({ skillId, className = 'w-10 h-10' }) => {
  const sprite = SKILL_SPRITES[skillId];
  return <MatrixSprite rows={sprite.rows} palette={sprite.palette} className={className} />;
});
SkillPixelIllustration.displayName = 'SkillPixelIllustration';

export const AugmentPixelBadge: React.FC<{
  augmentId: AugmentId;
  className?: string;
}> = React.memo(({ augmentId, className = 'w-8 h-8' }) => {
  const accentMap: Record<AugmentId, string> = {
    double_pawn_march: '#EF4444',
    late_bloom: '#F59E0B',
    mana_well: '#38BDF8',
    recycle_pro: '#10B981',
    cheap_skills: '#A78BFA',
    forward_aura: '#FB7185',
    knight_step: '#34D399',
    holy_bishop: '#FACC15',
    castle_vault: '#FBBF24',
    check_press: '#F43F5E',
    large_hand: '#60A5FA',
    first_refund: '#2DD4BF',
    opening_intel: '#38BDF8',
    tactical_reserve: '#818CF8',
    mana_siphon: '#F43F5E',
    arcane_surge: '#C084FC',
    royal_guard: '#FBBF24',
    veteran_pawn: '#FB923C',
    iron_castle: '#94A3B8',
    swift_recovery: '#34D399',
  };
  const accent = accentMap[augmentId] || '#F59E0B';
  return (
    <MatrixSprite
      className={className}
      rows={[
        '.......OO.......',
        '.....OOAAOO.....',
        '....OAAWWAAO....',
        '..OOAAWWWWAAOO..',
        '.OAAWWWWWWWWAAO.',
        '.OAWWWAAAAWWWAO.',
        'OAAWWAAAAAAWWAAO',
        'OAAWWAAAAAAWWAAO',
        '.OAWWWAAAAWWWAO.',
        '.OAAWWWWWWWWAAO.',
        '..OOAAWWWWAAOO..',
        '....OAAWWAAO....',
        '.....OOAAOO.....',
        '.......OO.......',
        '................',
        '................',
      ]}
      palette={{ O: '#0F131D', A: accent, W: '#FEF9C3' }}
    />
  );
});
AugmentPixelBadge.displayName = 'AugmentPixelBadge';

export const PixelManaGem: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <MatrixSprite
    className={className}
    rows={[
      '.......OO.......',
      '......OBBO......',
      '.....OBWWBO.....',
      '....OBWBBWBO....',
      '...OBWBBBBWBO...',
      '..OBBBBBBBBBBO..',
      '..OBBDDDDDDBBO..',
      '..OBDDDDDDDDBO..',
      '...OBDDDDDDBBO..',
      '....OBDDDDBBO...',
      '.....OBDDBBO....',
      '......OBBBO.....',
      '.......OO.......',
      '................',
      '................',
      '................',
    ]}
    palette={{
      O: '#0B1120',
      B: '#38BDF8',
      W: '#E0F2FE',
      D: '#0284C7',
    }}
  />
);

export const PixelTrashCan: React.FC<{ isOpen?: boolean; className?: string }> = ({
  isOpen = false,
  className = 'w-10 h-10',
}) => {
  const closedRows = [
    '................',
    '.....OOOOOO.....',
    '....OSSSSSSO....',
    '..OOOOOOOOOOOO..',
    '.OSSSSSSSSSSSSO.',
    '..OOOOOOOOOOOO..',
    '...OMMMMMMMMO...',
    '...OMOMMOMOMO...',
    '...OMOMMOMOMO...',
    '...OMOMMOMOMO...',
    '...OMOMMOMOMO...',
    '...OMOMMOMOMO...',
    '...OMMMMMMMMO...',
    '...OOOOOOOOOO...',
    '................',
    '................',
  ];
  const openRows = [
    '..OOOOOO........',
    '.OSSSSSSO.......',
    'OOOOOOOOOOOO....',
    '.OSSSSSSSSSSO...',
    '................',
    '...OOOOOOOOOO...',
    '...OMMMMMMMMO...',
    '...OMOMMOMOMO...',
    '...OMOMMOMOMO...',
    '...OMOMMOMOMO...',
    '...OMOMMOMOMO...',
    '...OMOMMOMOMO...',
    '...OMMMMMMMMO...',
    '...OOOOOOOOOO...',
    '................',
    '................',
  ];
  return (
    <MatrixSprite
      className={className}
      rows={isOpen ? openRows : closedRows}
      palette={{
        O: '#0F131D',
        S: isOpen ? '#F59E0B' : '#94A3B8',
        M: isOpen ? '#D97706' : '#64748B',
      }}
    />
  );
};

const AI_AVATAR_SPRITES: Record<AiLevel, { rows: string[]; palette: Record<string, string> }> = {
  // 1. 리암 (캐주얼 티셔츠, 짧은 갈색 머리)
  1: {
    rows: [
      '....OOOOOOOO....',
      '...OHHHHHHHHO...',
      '..OHHHHHHHHHHO..',
      '..OHHSSSSSSHHO..',
      '..OHSOSSSSOSHO..',
      '..OHSSSSSSSSHO..',
      '..OSSSSMMSSSSO..',
      '...OSSSSSSSSO...',
      '....OOSSSSOO....',
      '..OOGGGGGGGGOO..',
      '.OGGWWWWWWWWGGO.',
      '.OGGGGGGGGGGGGO.',
      '.OGG.OOOOOO.GGO.',
      '..OO.OGGGGO.OO..',
      '.....OOOOOO.....',
      '................',
    ],
    palette: { O: '#0F131D', H: '#5C4033', S: '#FBD3B6', M: '#D97757', G: '#22C55E', W: '#DCFCE7' },
  },
  // 2. 클라라 (단발 머리 + 머리핀 + 하늘색 카디건)
  2: {
    rows: [
      '....OOOOOOOO....',
      '...OHHHHHHHHO...',
      '..OHHHYHHHHHHO..',
      '..OHHSSSSSSHHO..',
      '..OHSOSSSSOSHO..',
      '..OHSSSSSSSSHO..',
      '..OHSSSMMSSSHO..',
      '..OHSSSSSSSSHO..',
      '...OHOSSSSOHO...',
      '..OOBBBBBBBBOO..',
      '.OBBBWWWWWWBBBO.',
      '.OBBBBBBBBBBBBO.',
      '.OBB.OOOOOO.BBO.',
      '..OO.OBBBBO.OO..',
      '.....OOOOOO.....',
      '................',
    ],
    palette: { O: '#0F131D', H: '#4A2C2A', Y: '#FACC15', S: '#FCE0CC', M: '#E11D48', B: '#38BDF8', W: '#F8FAFC' },
  },
  // 3. 올리버 (안경 쓴 동호인 + 네이비 후드)
  3: {
    rows: [
      '....OOOOOOOO....',
      '...OHHHHHHHHO...',
      '..OHHHHHHHHHHO..',
      '..OHSSSSSSSSHO..',
      '..OSOOOOOOOOSSO.',
      '..OSOGWSSWGOSO..',
      '..OSOOOOOOOOSSO.',
      '..OSSSSMMSSSSO..',
      '...OSSSSSSSSO...',
      '..OONNNNNNNNOO..',
      '.ONNNWWWWWWNNNO.',
      '.ONNNNNNNNNNNNO.',
      '.ONN.OOOOOO.NNO.',
      '..OO.ONNNNO.OO..',
      '.....OOOOOO.....',
      '................',
    ],
    palette: { O: '#0F131D', H: '#1E293B', S: '#FAD2B4', G: '#334155', W: '#E0F2FE', M: '#C27D63', N: '#3B82F6' },
  },
  // 4. 소피아 (올림머리 + 버건디 재킷 + 셔츠)
  4: {
    rows: [
      '.....OOOOOO.....',
      '....OHHHHHHO....',
      '...OHHHHHHHHO...',
      '..OHHSSSSSSHHO..',
      '..OHSOSSSSOSHO..',
      '..OHSSSSSSSSHO..',
      '..OSSSSMMSSSSO..',
      '...OSSSSSSSSO...',
      '..OORRRRRRRROO..',
      '.ORRWWWWWWRRRRO.',
      '.ORRRWWWWWRRRRO.',
      '.ORRRRRRRRRRRRO.',
      '.ORR.OOOOOO.RRO.',
      '..OO.ORRRRO.OO..',
      '.....OOOOOO.....',
      '................',
    ],
    palette: { O: '#0F131D', H: '#27272A', S: '#FCE0CC', M: '#BE123C', R: '#9F1239', W: '#F8FAFC' },
  },
  // 5. 빅토르 (정장 & 넥타이 + 안경 마스터)
  5: {
    rows: [
      '....OOOOOOOO....',
      '...OGHHHHHHGO...',
      '..OGGHHHHHHGGO..',
      '..OHSSSSSSSSHO..',
      '..OSOOOOOOOOSSO.',
      '..OSOGWSSWGOSO..',
      '..OSOOOOOOOOSSO.',
      '..OSSSSMMSSSSO..',
      '...OSSSSSSSSO...',
      '..OODDDDDDDDOO..',
      '.ODDWWRRRRWWDD0.'.replace('0', 'O'),
      '.ODDDWRRRRWRDDO.',
      '.ODD.OOOOOO.DDO.',
      '..OO.ODDDDO.OO..',
      '.....OOOOOO.....',
      '................',
    ],
    palette: { O: '#0F131D', H: '#334155', G: '#94A3B8', S: '#F5CBA7', W: '#F8FAFC', M: '#A1624F', D: '#1E293B', R: '#EF4444' },
  },
};

export const PixelAiAvatar: React.FC<{
  level: AiLevel;
  className?: string;
}> = React.memo(({ level, className = 'w-8 h-8' }) => {
  const sprite = AI_AVATAR_SPRITES[level];
  return <MatrixSprite rows={sprite.rows} palette={sprite.palette} className={className} />;
});
PixelAiAvatar.displayName = 'PixelAiAvatar';

const PAWN_TIER_ROWS = [
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
];

const BISHOP_TIER_ROWS = [
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
];

const ROOK_TIER_ROWS = [
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
];

const QUEEN_TIER_ROWS = [
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
];

const TIER_SPRITES: Record<
  RankTierId,
  { rows: string[]; palette: Record<string, string> }
> = {
  // 언랭크: 중립 회색 엠블럼
  unranked: {
    rows: [
      '................',
      '....OOOOOOOO....',
      '...OGGGGGGGGO...',
      '..OGGDDDDDDGGO..',
      '..OGDDDDDDDDGO..',
      '..OGDDGGGGDDGO..',
      '..OGDDGDDGDDGO..',
      '..OGDDDDDDDDGO..',
      '..OGDDDDDDDDGO..',
      '..OGDDGGGGDDGO..',
      '...OGDDDDDDGO...',
      '....OGDDDDGO....',
      '.....OGDDGO.....',
      '......OOOO......',
      '................',
      '................',
    ],
    palette: { O: '#0F131D', G: '#64748B', D: '#334155' },
  },
  // 아이언: 강철 폰
  iron: {
    rows: PAWN_TIER_ROWS,
    palette: { O: '#0F131D', M: '#71717A', H: '#D4D4D8', S: '#3F3F46', A: '#A1A1AA' },
  },
  // 브론즈: 청동/구리 폰
  bronze: {
    rows: PAWN_TIER_ROWS,
    palette: { O: '#0F131D', M: '#C2591B', H: '#FDBA74', S: '#7C2D12', A: '#F59E0B' },
  },
  // 실버: 백은 폰
  silver: {
    rows: PAWN_TIER_ROWS,
    palette: { O: '#0F131D', M: '#CBD5E1', H: '#FFFFFF', S: '#64748B', A: '#E2E8F0' },
  },
  // 골드: 황금 비숍
  gold: {
    rows: BISHOP_TIER_ROWS,
    palette: { O: '#0F131D', M: '#F59E0B', H: '#FEF08A', S: '#B45309', A: '#FFFBEB' },
  },
  // 플레티넘: 청록 비숍
  platinum: {
    rows: BISHOP_TIER_ROWS,
    palette: { O: '#0F131D', M: '#2DD4BF', H: '#CCFBF1', S: '#0F766E', A: '#E0F2FE' },
  },
  // 에메랄드: 에메랄드 비숍
  emerald: {
    rows: BISHOP_TIER_ROWS,
    palette: { O: '#0F131D', M: '#10B981', H: '#A7F3D0', S: '#047857', A: '#ECFDF5' },
  },
  // 다이아: 다이아몬드 룩
  diamond: {
    rows: ROOK_TIER_ROWS,
    palette: { O: '#0F131D', M: '#38BDF8', H: '#E0F2FE', S: '#0369A1', A: '#BAE6FD' },
  },
  // 마스터: 자수정 퀸
  master: {
    rows: QUEEN_TIER_ROWS,
    palette: { O: '#0F131D', M: '#A855F7', H: '#F3E8FF', S: '#6B21A8', A: '#FDE047' },
  },
  // 그랜드마스터: 진홍 황금 퀸
  grandmaster: {
    rows: QUEEN_TIER_ROWS,
    palette: { O: '#0F131D', M: '#E11D48', H: '#FFE4E6', S: '#881337', A: '#FACC15' },
  },
};

export const PixelTierIcon: React.FC<{
  tierId: RankTierId;
  className?: string;
}> = React.memo(({ tierId, className = 'w-5 h-5' }) => {
  const sprite = TIER_SPRITES[tierId] || TIER_SPRITES.unranked;
  return <MatrixSprite rows={sprite.rows} palette={sprite.palette} className={className} />;
});
PixelTierIcon.displayName = 'PixelTierIcon';
