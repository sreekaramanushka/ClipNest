import React, { useState } from 'react';
import SidePanel from './SidePanel.jsx';
import '../sidepanel/sidepanel.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#b33939', background: '#f5f2eb', fontFamily: 'sans-serif', border: '1px solid #b33939', borderRadius: '8px' }}>
          <h2>ClipNest - Render Error</h2>
          <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px', fontSize: '0.85rem' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  return (
    <ErrorBoundary>
      <SidePanel />
    </ErrorBoundary>
  );
};

export default App;
