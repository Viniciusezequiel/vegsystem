import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold text-foreground">Algo deu errado nesta página</h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.error.message}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => this.setState({ error: null })}>Tentar novamente</Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
