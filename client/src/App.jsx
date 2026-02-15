import { useState } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import MiningPage from './pages/MiningPage';
import ServicePage from './pages/ServicePage';
import TasksPage from './pages/TasksPage';
import StatisticsPage from './pages/StatisticsPage';
import TokenPage from './pages/TokenPage';
import './App.css';

const TABS = [
  { id: 'mining', label: 'Mining', icon: '⛏️' },
  { id: 'service', label: 'Service', icon: '⚡' },
  { id: 'tasks', label: 'Tasks', icon: '📋' },
  { id: 'statistics', label: 'Statistics', icon: '📊' },
  { id: 'token', label: 'Token', icon: '💎' }
];

function AppContent() {
  const [activeTab, setActiveTab] = useState('mining');
  const { user, loading, error } = useUser();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-logo">
          <span className="logo-text">X</span>
          <div className="loading-ring"></div>
        </div>
        <h2>XenoHash</h2>
        <p>Initializing mining system...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <span className="error-icon">⚠️</span>
        <h2>Connection Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'mining': return <MiningPage />;
      case 'service': return <ServicePage />;
      case 'tasks': return <TasksPage />;
      case 'statistics': return <StatisticsPage />;
      case 'token': return <TokenPage />;
      default: return <MiningPage />;
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">X</span>
          <h1 className="header-title">#XenoHash</h1>
        </div>
        <div className="header-right">
          <span className="header-tokens">💰 {user?.tokens?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {renderPage()}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
