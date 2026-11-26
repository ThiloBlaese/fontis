import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CRITICAL UI ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1 style={{ color: '#e11d48' }}>Ein Fehler ist aufgetreten</h1>
          <p style={{ color: '#475569' }}>Die Anwendung konnte nicht geladen werden oder ist abgestürzt.</p>
          <pre style={{ 
            marginTop: '20px', 
            padding: '20px', 
            background: '#f1f5f9', 
            borderRadius: '8px', 
            textAlign: 'left',
            display: 'inline-block',
            maxWidth: '90%',
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {this.state.error?.toString()}
          </pre>
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => window.location.reload()}
              style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
