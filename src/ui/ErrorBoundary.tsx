import { Component, type ReactNode } from 'react';

/** Last line of defence: show a way out instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="lobby">
        <div className="lobby-card lobby-narrow">
          <h2>Alguna cosa ha fallat</h2>
          <p>Torna a carregar la pàgina. Si jugaves en línia, la partida continua guardada a la sala.</p>
          <button type="button" className="lobby-primary" onClick={() => window.location.reload()}>Torna a carregar</button>
        </div>
      </div>
    );
  }
}
