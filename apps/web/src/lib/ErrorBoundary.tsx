import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ name?: string; children: ReactNode; fallback?: (e: Error) => ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(`[${this.props.name ?? 'widget'}]`, error); }
  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error);
      return (
        <div className="rounded-lg border border-bad/40 bg-bad/5 p-3 text-xs text-bad">
          <div className="font-semibold">{this.props.name ?? 'Component'} failed to render</div>
          <div className="mt-1 font-mono opacity-80">{String(this.state.error.message)}</div>
          <button className="btn btn-sm mt-2" onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
