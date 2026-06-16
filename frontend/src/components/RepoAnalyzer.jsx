import React, { useState, useEffect, useRef } from 'react';

function FileTree({ data, name = "Root", depth = 0 }) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  
  if (data === null) {
    return (
      <div className="tree-file">
        <span>📄 {name}</span>
      </div>
    );
  }
  
  return (
    <div className="tree-node" style={{ marginLeft: depth > 0 ? '12px' : '0' }}>
      <div className="tree-folder" onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
        <span>{isOpen ? '📂' : '📁'} {name}</span>
      </div>
      {isOpen && Object.entries(data).sort((a,b) => {
        // Folders first
        const aIsDir = a[1] !== null;
        const bIsDir = b[1] !== null;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a[0].localeCompare(b[0]);
      }).map(([key, val]) => (
        <FileTree key={key} name={key} data={val} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function RepoAnalyzer({ apiConfig, onAnalysisComplete }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  
  const logsEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Poll status of running analysis
  useEffect(() => {
    let timer;
    if (taskId && loading) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/status/${taskId}`);
          const data = await res.json();
          
          if (data.logs) {
            setLogs(data.logs);
          }
          
          if (data.status === 'completed') {
            setLoading(false);
            setReport(data.result);
            setStatus('completed');
            setTaskId(null);
            if (onAnalysisComplete) {
              onAnalysisComplete(data.result);
            }
          } else if (data.status === 'failed') {
            setLoading(false);
            setStatus('failed');
            setTaskId(null);
            alert(`Analysis failed: ${data.error}`);
          }
        } catch (e) {
          console.error("Error polling task status:", e);
        }
      };

      timer = setInterval(checkStatus, 2000);
    }
    return () => clearInterval(timer);
  }, [taskId, loading]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!repoUrl) return;

    setLoading(true);
    setReport(null);
    setLogs(["Submitting job to agentic reviewer backend..."]);
    setStatus('pending');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTaskId(data.taskId);
        setStatus('running');
      } else {
        setLoading(false);
        alert(data.error || "Failed to start analysis");
      }
    } catch (err) {
      setLoading(false);
      alert(`Network error: ${err.message}`);
    }
  };


  const getStepClass = (stepIndex) => {
    // Basic heuristics to highlight stepper stages based on logs
    const logStr = logs.join('\n').toLowerCase();
    
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    if (!loading) return 'pending';

    switch (stepIndex) {
      case 1: // Clone
        if (logStr.includes('cloning')) return 'running';
        if (logStr.includes('detected') || logStr.includes('inspecting')) return 'completed';
        return 'pending';
      case 2: // Inspect structure
        if (logStr.includes('inspecting') && !logStr.includes('querying')) return 'running';
        if (logStr.includes('querying') || logStr.includes('synthesis') || logStr.includes('analyzing')) return 'completed';
        return 'pending';
      case 3: // Agent decision
        if (logStr.includes('querying') || logStr.includes('decided to inspect') || logStr.includes('deeply inspecting')) return 'running';
        if (logStr.includes('synthesizing') || logStr.includes('synthesis') || logStr.includes('report synthesized')) return 'completed';
        return 'pending';
      case 4: // Synthesis
        if (logStr.includes('synthesis') || logStr.includes('synthesizing')) return 'running';
        if (logStr.includes('completed successfully')) return 'completed';
        return 'pending';
      default:
        return 'pending';
    }
  };

  const loadExample = (url) => {
    setRepoUrl(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="analyzer-card glass-panel">
        <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <div className="input-wrapper">
              <input
                type="text"
                className="form-input"
                placeholder="https://github.com/username/project-repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={loading}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Examples:</span>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => loadExample('https://github.com/miguelgrinberg/flasky-first-edition')} 
                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                disabled={loading}
              >
                Flasky App
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => loadExample('https://github.com/reduxjs/redux-templates')} 
                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                disabled={loading}
              >
                Redux Template
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Analyzing Codebase...' : 'Run Agentic Review'}
          </button>
        </form>

        {loading && (
          <div className="stepper-logs-grid">
            <div className="stepper-container">
              <div className={`step-item ${getStepClass(1)}`}>
                <div className="step-status">1</div>
                <div className="step-label">Cloning Code</div>
              </div>
              <div className={`step-item ${getStepClass(2)}`}>
                <div className="step-status">2</div>
                <div className="step-label">Mapping Structure</div>
              </div>
              <div className={`step-item ${getStepClass(3)}`}>
                <div className="step-status">3</div>
                <div className="step-label">Inspecting Files</div>
              </div>
              <div className={`step-item ${getStepClass(4)}`}>
                <div className="step-status">4</div>
                <div className="step-label">Synthesizing Report</div>
              </div>
            </div>

            <div className="logs-panel">
              <div style={{ fontSize: '0.8rem', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '4px', marginBottom: '8px', color: '#60a5fa' }}>
                LIVE AGENT EXECUTION LOGS
              </div>
              {logs.map((log, i) => (
                <div key={i} className={`log-line ${log.toLowerCase().includes('error') ? 'error' : ''}`}>
                  &gt; {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {report && (
        <div className="results-container">
          <div className="tree-explorer glass-panel">
            <h3>🗂 Codebase Files</h3>
            <FileTree data={report.tree} name={report.projectName} />
          </div>

          <div className="report-panel glass-panel">
            <div className="tab-headers">
              <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
              <button className={`tab-btn ${activeTab === 'features' ? 'active' : ''}`} onClick={() => setActiveTab('features')}>Features</button>
              <button className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`} onClick={() => setActiveTab('architecture')}>Architecture</button>
              <button className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`} onClick={() => setActiveTab('suggestions')}>Mentorship Advice</button>
              <button className={`tab-btn ${activeTab === 'learning' ? 'active' : ''}`} onClick={() => setActiveTab('learning')}>Learning Pathway</button>
            </div>

            <div className="report-content">
              {activeTab === 'summary' && (
                <div className="report-section">
                  <div className="project-meta-header">
                    <h2>{report.projectName}</h2>
                    <span className={`badge-difficulty ${report.difficultyLevel?.toLowerCase() || 'intermediate'}`}>
                      Difficulty: {report.difficultyLevel}
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '1.05rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                    {report.summary}
                  </p>

                  <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                    <h3>Detected Technology Stack</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px' }}>
                      {report.techStack?.languages && (
                        <div className="tech-group">
                          <div className="tech-group-title">Languages</div>
                          <div className="tech-chips">
                            {report.techStack.languages.map((t, idx) => <span key={idx} className="tech-chip">{t}</span>)}
                          </div>
                        </div>
                      )}
                      {report.techStack?.frontend && (
                        <div className="tech-group">
                          <div className="tech-group-title">Frontend Frameworks</div>
                          <div className="tech-chips">
                            {report.techStack.frontend.map((t, idx) => <span key={idx} className="tech-chip">{t}</span>)}
                          </div>
                        </div>
                      )}
                      {report.techStack?.backend && (
                        <div className="tech-group">
                          <div className="tech-group-title">Backend Frameworks</div>
                          <div className="tech-chips">
                            {report.techStack.backend.map((t, idx) => <span key={idx} className="tech-chip">{t}</span>)}
                          </div>
                        </div>
                      )}
                      {report.techStack?.database && (
                        <div className="tech-group">
                          <div className="tech-group-title">Database System</div>
                          <div className="tech-chips">
                            {report.techStack.database.map((t, idx) => <span key={idx} className="tech-chip">{t}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="report-section">
                  <h2>Core Features Extracted</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    The AI Agent parsed the implementation code and extracted the main user journeys and feature logic:
                  </p>
                  <div className="feature-list">
                    {report.features?.map((f, idx) => (
                      <div key={idx} className="feature-item">
                        <h4>{f.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>{f.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'architecture' && (
                <div className="report-section">
                  <h2>Architecture & Data Flow</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
                    <div>
                      <h4 style={{ color: 'var(--accent-purple)', marginBottom: '8px' }}>Project Layout Overview</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                        {report.architecture?.structureDescription}
                      </p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                      <h4 style={{ color: 'var(--accent-purple)', marginBottom: '8px' }}>Data & Execution Flow</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                        {report.architecture?.dataFlow}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'suggestions' && (
                <div className="report-section">
                  <h2>Code Quality & Mentor Suggestions</h2>
                  
                  {report.missingComponents && report.missingComponents.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ color: 'var(--accent-red)', marginBottom: '12px' }}>⚠️ Missing Components</h4>
                      <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {report.missingComponents.map((item, idx) => <li key={idx}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                    <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '16px' }}>🛠 Refactoring & Enhancement Recommendations</h4>
                    <div className="suggestion-list">
                      {report.improvementSuggestions?.map((s, idx) => (
                        <div key={idx} className={`suggestion-item ${s.area?.toLowerCase() || 'quality'}`}>
                          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {s.area || 'General'} Advice
                          </h4>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px', lineHeight: '1.6' }}>
                            {s.suggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'learning' && (
                <div className="report-section">
                  <h2>Recommended Learning Pathway</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    To expand your knowledge or upgrade this specific application, a senior mentor agent recommends studying these key topics next:
                  </p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '20px' }}>
                    {report.learningRecommendations?.map((rec, idx) => (
                      <li key={idx} style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6' }}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
