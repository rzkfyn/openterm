import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error in view:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[#11111a] p-6 text-center select-none">
          <div className="rounded-full bg-rose-500/10 p-3 mb-3 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100 mb-1">
            {this.props.fallbackTitle || 'Something went wrong displaying this view'}
          </h3>
          <p className="text-xs text-rose-300 font-mono max-w-md break-words mb-4 px-2 py-1 rounded bg-rose-950/30 border border-rose-900/30">
            {this.state.error?.message || 'Unknown render error'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer transition-colors shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
