import React from 'react';
import { X } from 'lucide-react';
import { AI_TIERS } from '../types/chess';
import { AUGMENT_LIST, SKILL_LIST } from '../engine/skillChess';
import { PixelAiAvatar } from './SkillPixelArt';

interface RulesModalProps {
  open: boolean;
  initialTab?: 'rules' | 'skills';
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({
  open,
  initialTab = 'rules',
  onClose,
}) => {
  const [tab, setTab] = React.useState<'rules' | 'skills'>(initialTab);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0E14]/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="게임 규칙 및 안내"
    >
      <div className="pixel-panel w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2B3244]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTab('rules')}
              className={`text-sm font-bold pb-1 border-b-2 cursor-pointer whitespace-nowrap ${
                tab === 'rules'
                  ? 'text-amber-300 border-amber-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              체스 규칙 & 조작법
            </button>
            <button
              type="button"
              onClick={() => setTab('skills')}
              className={`text-sm font-bold pb-1 border-b-2 cursor-pointer whitespace-nowrap ${
                tab === 'skills'
                  ? 'text-amber-300 border-amber-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              스킬 체스 규칙
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed">
          {tab === 'rules' ? (
            <>
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-1">
                  1. 터치 이동 및 애니메이션
                </h3>
                <p className="text-xs text-slate-400">
                  내 차례에 기물을 터치하면 이동 가능한 빈 칸에는 초록색(스킬 강화 이동은 하늘색) 픽셀 표시가, 잡을 수 있는 상대 기물에는 붉은색 조준 표시가 애니메이션으로 나타납니다.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-1">
                  2. 정식 체스 특수 규칙
                </h3>
                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                  <li>
                    <strong className="text-slate-200">캐슬링:</strong> 킹과 룩이 움직이지 않았고 사이 경로가 안전할 때 킹을 2칸 이동합니다.
                  </li>
                  <li>
                    <strong className="text-slate-200">체스960 (피셔 랜덤):</strong> 매 판 960가지 대칭 초기 배치 중 하나로 시작합니다. 캐슬링 시 킹을 선택하고 목표 칸(g/c) 또는 아군 룩을 직접 눌러 캐슬링합니다.
                  </li>
                  <li>
                    <strong className="text-slate-200">친구 대전 레이팅 &amp; 순위표:</strong> 친구 온라인 대전 승리 시 기물 점수차와 수 길이에 따라 최소 15점에서 최대 30점까지 오르며, 0점부터 시작해 언랭크 → 아이언 → 브론즈 → 실버 → 골드 → 플레티넘 → 에메랄드 → 다이아 → 마스터 → 그랜드마스터로 승급합니다. (0점 미만으로 내려가지 않습니다.)
                  </li>
                  <li>
                    <strong className="text-slate-200">앙파상 / 폰 승급:</strong> 앙파상 포획과 끝 줄 도달 시 퀸·룩·비숍·나이트 승급을 지원합니다.
                  </li>
                  <li>
                    <strong className="text-slate-200">기보 기록:</strong> 대국 중 상단 기보 아이콘 또는 대국 종료 후 게임 기록 탭에서 모든 기보를 다시 볼 수 있습니다.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-1.5">
                  3. AI 대결 상대
                </h3>
                <div className="space-y-1">
                  {AI_TIERS.map((t) => (
                    <div
                      key={t.level}
                      className="flex items-center justify-between gap-3 text-xs bg-[#14171F] border border-[#262C3D] px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PixelAiAvatar level={t.level} className="w-6 h-6 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-amber-300">{t.title}</span>
                          <span className="text-slate-400"> — {t.description}</span>
                        </div>
                      </div>
                      <span className="font-mono-tabular text-slate-400 shrink-0">
                        {t.estimatedRating}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <h3 className="text-sm font-bold text-amber-300 mb-1">
                  스킬 체스 핵심 규칙 (스킬 {SKILL_LIST.length}종 · 증강 {AUGMENT_LIST.length}종)
                </h3>
                <ul className="space-y-1.5 list-disc pl-4 text-slate-400">
                  <li>
                    <strong className="text-slate-200">시작 증강 선택:</strong> 대국 시작 시 양측 모두에게 똑같은 3개의 증강이 제시되며, 각자 원하는 1개를 골라 게임 내내 적용합니다.
                  </li>
                  <li>
                    <strong className="text-slate-200">스킬 뽑기 (3 MP):</strong> 시작 시 스킬 카드가 없으며, 내 차례에 3 MP를 사용해 비밀 스킬 카드를 1장 뽑을 수 있습니다. (상대에게는 보이지 않습니다)
                  </li>
                  <li>
                    <strong className="text-slate-200">마나(MP) 획득:</strong> 시작 시 3 MP로 출발하며, 턴 시작 시 +1 MP, 내 기물이 상대에게 잡힐 때마다 +1 MP를 얻습니다. (최대 10 MP)
                  </li>
                  <li>
                    <strong className="text-slate-200">쓰레기통 버리기:</strong> 매 턴 1회, 사용하지 않을 카드를 오른쪽 쓰레기통으로 끌어다 놓으면 버리고 즉시 +1 MP를 얻습니다.
                  </li>
                  <li>
                    <strong className="text-slate-200">기물 지정 스킬 & 상태이상 확인:</strong> 상태이상이 걸린 기물·칸을 누르면 효과를 확인할 수 있고, 보드 왼쪽 증강 아이콘을 눌러 증강 설명을 볼 수 있습니다.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
