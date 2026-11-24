import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || '예기치 않은 오류가 발생했습니다.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-dvh w-full pixel-grid-bg flex items-center justify-center p-4">
          <div className="pixel-panel max-w-md w-full p-5 text-center space-y-3">
            <div className="w-10 h-10 mx-auto bg-red-950 border-2 border-red-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-base font-extrabold text-slate-100">
              화면 처리 중 오류가 발생했습니다
            </h2>
            <p className="text-xs text-slate-400 break-all">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="pixel-btn inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 border-2 border-amber-200 text-xs font-extrabold text-[#14171F] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>새로고침</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
