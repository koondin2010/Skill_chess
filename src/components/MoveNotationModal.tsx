import React from 'react';
import { X } from 'lucide-react';
import type { MoveRecord } from '../types/chess';

interface MoveNotationModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  moves: MoveRecord[];
  onClose: () => void;
}

export const MoveNotationModal: React.FC<MoveNotationModalProps> = ({
  open,
  title,
  subtitle,
  moves,
  onClose,
}) => {
  if (!open) return null;

  const pairs: Array<{ moveNumber: number; white?: MoveRecord; black?: MoveRecord }> = [];
  for (const m of moves) {
    if (m.color === 'w') {
      pairs.push({ moveNumber: m.moveNumber, white: m });
    } else {
      const last = pairs[pairs.length - 1];
      if (last && last.moveNumber === m.moveNumber && !last.black) {
        last.black = m;
      } else {
        pairs.push({ moveNumber: m.moveNumber, black: m });
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0E14]/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="pixel-panel w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2B3244]">
          <div>
            <h3 className="text-sm font-bold text-amber-300">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="기보 창 닫기"
            className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-[#13161F]">
          {pairs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">
              아직 기록된 수가 없습니다.
            </p>
          ) : (
            <table className="w-full text-xs font-mono-tabular">
              <thead>
                <tr className="text-slate-500 border-b border-[#252B3B]">
                  <th className="py-1.5 text-left w-10">#</th>
                  <th className="py-1.5 text-left">백 (White)</th>
                  <th className="py-1.5 text-left">흑 (Black)</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((pair) => (
                  <tr key={pair.moveNumber} className="border-b border-[#1E2330] last:border-none">
                    <td className="py-1.5 text-slate-500">{pair.moveNumber}.</td>
                    <td className="py-1.5 text-slate-100 font-semibold">
                      {pair.white?.san || ''}
                    </td>
                    <td className="py-1.5 text-slate-300 font-semibold">
                      {pair.black?.san || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
