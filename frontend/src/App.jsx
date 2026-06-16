import React, { useState, useEffect } from 'react';
import './App.css';
import RepoAnalyzer from './components/RepoAnalyzer';
import PdfAnalyzer from './components/PdfAnalyzer';
import InterviewTrainer from './components/InterviewTrainer';

function App() {
  const [activeTab, setActiveTab] = useState('analyzer');
  const [activeOption, setActiveOption] = useState(null); // 'repo', 'pdf', or null
  const [interviewQuestions, setInterviewQuestions] = useState([]);
  const [hasReport, setHasReport] = useState(false);

  const handleAnalysisComplete = (report) => {
    if (report && report.interviewQuestions) {
      setInterviewQuestions(report.interviewQuestions);
      setHasReport(true);
    }
  };

  const resetAnalysis = () => {
    setActiveOption(null);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="brand-section">
          <div className="brand-logo">RL</div>
          <span className="brand-name">RepoLENS</span>
        </div>

        <nav>
          <ul className="sidebar-menu">
            <li 
              className={`menu-item ${activeTab === 'analyzer' ? 'active' : ''}`}
              onClick={() => setActiveTab('analyzer')}
            >
              📊 <span>Analyzer Workspace</span>
            </li>
            <li 
              className={`menu-item ${activeTab === 'interview-trainer' ? 'active' : ''}`}
              onClick={() => setActiveTab('interview-trainer')}
              style={{ position: 'relative' }}
            >
              🎓 <span>Interview Arena</span>
              {interviewQuestions.length > 0 && (
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'var(--accent-purple)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  boxShadow: 'var(--glow-purple)'
                }}>
                  {interviewQuestions.length}
                </span>
              )}
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="model-badge active">
            <span className="dot"></span>
            <span>Agent Engine Online</span>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        <header className="top-header">
          <div className="page-title">
            <h1>
              {activeTab === 'analyzer' && activeOption === null && 'Welcome to RepoLENS'}
              {activeTab === 'analyzer' && activeOption === 'repo' && 'Repository Analyzer'}
              {activeTab === 'analyzer' && activeOption === 'pdf' && 'Project PDF Analyzer'}
              {activeTab === 'interview-trainer' && 'Interview Practice Arena'}
            </h1>
            <p>
              {activeTab === 'analyzer' && activeOption === null && 'Select a project source below to begin the analysis.'}
              {activeTab === 'analyzer' && activeOption === 'repo' && 'Inspect codebase layout, extract features, and generate senior mentor recommendations.'}
              {activeTab === 'analyzer' && activeOption === 'pdf' && 'Parse project reports to compile a technology assessment and learning pathway.'}
              {activeTab === 'interview-trainer' && 'Practice project-specific questions and receive constructive AI-based reviews.'}
            </p>
          </div>
        </header>

        {/* Tab Panels: Kept mounted using style display toggles to preserve running task states */}
        <div style={{ display: activeTab === 'analyzer' ? 'block' : 'none' }}>
          {activeOption === null ? (
            /* Selection Screen - Only 2 clean options shown */
            <div className="selection-grid">
              {/* Option 1: Repository Link */}
              <div 
                className="selection-card glass-panel glass-panel-hover" 
                onClick={() => setActiveOption('repo')}
              >
                <div className="selection-icon">🔗</div>
                <h3>Repository Link</h3>
                <p>
                  Analyze a public GitHub codebase layout and packages.
                </p>
                <button className="btn-primary">
                  Analyze Link
                </button>
              </div>

              {/* Option 2: PDF Document Upload */}
              <div 
                className="selection-card glass-panel glass-panel-hover" 
                onClick={() => setActiveOption('pdf')}
              >
                <div className="selection-icon">📄</div>
                <h3>PDF Document</h3>
                <p>
                  Upload a project report PDF to evaluate tech stack and roadmap.
                </p>
                <button className="btn-primary">
                  Upload PDF
                </button>
              </div>
            </div>
          ) : (
            /* Active Analysis View with Back Button */
            <div>
              <button 
                className="btn-secondary" 
                onClick={resetAnalysis} 
                style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                ← Back to Selection
              </button>

              {/* Conditionally render within the visible workspace option */}
              <div style={{ display: activeOption === 'repo' ? 'block' : 'none' }}>
                <RepoAnalyzer 
                  apiConfig={{}} 
                  onAnalysisComplete={handleAnalysisComplete} 
                />
              </div>

              <div style={{ display: activeOption === 'pdf' ? 'block' : 'none' }}>
                <PdfAnalyzer 
                  apiConfig={{}} 
                  onAnalysisComplete={handleAnalysisComplete} 
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: activeTab === 'interview-trainer' ? 'block' : 'none' }}>
          <InterviewTrainer 
            apiConfig={{}} 
            interviewQuestions={interviewQuestions} 
          />
        </div>
      </main>
    </div>
  );
}

export default App;
