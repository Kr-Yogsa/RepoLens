import { useEffect, useRef, useState } from 'react';
import { Folder, FolderOpen, File, ChevronDown, ChevronRight } from 'lucide-react';

function FileTree({ data, name = 'Root', depth = 0 }) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  if (data === null) {
    return (
      <div className="tree-file" style={{ paddingLeft: '20px', gap: '6px' }}>
        <File size={14} style={{ color: 'var(--text-muted)', minWidth: '14px' }} />
        <span>{name}</span>
      </div>
    );
  }

  return (
    <div className="tree-node" style={{ marginLeft: 0 }}>
      <div className="tree-folder" onClick={() => setIsOpen(!isOpen)} style={{ gap: '6px' }}>
        {isOpen ? (
          <ChevronDown size={14} style={{ color: 'var(--text-muted)', minWidth: '14px' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--text-muted)', minWidth: '14px' }} />
        )}
        {isOpen ? (
          <FolderOpen size={15} style={{ color: 'var(--accent-teal)', minWidth: '15px' }} />
        ) : (
          <Folder size={15} style={{ color: 'var(--accent-teal)', minWidth: '15px' }} />
        )}
        <span>{name}</span>
      </div>
      {isOpen && (
        <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', marginLeft: '6px', paddingLeft: '6px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
          {Object.entries(data)
            .sort((a, b) => {
              const aIsDir = a[1] !== null;
              const bIsDir = b[1] !== null;

              if (aIsDir && !bIsDir) return -1;
              if (!aIsDir && bIsDir) return 1;

              return a[0].localeCompare(b[0]);
            })
            .map(([key, value]) => <FileTree key={key} name={key} data={value} depth={depth + 1} />)}
        </div>
      )}
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

  const logsContainerRef = useRef(null);

  useEffect(() => {
    const container = logsContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      if (isNearBottom || logs.length <= 1) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [logs]);

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
        } catch (error) {
          console.error('Error polling task status:', error);
        }
      };

      timer = setInterval(checkStatus, 2000);
    }

    return () => clearInterval(timer);
  }, [loading, onAnalysisComplete, taskId]);

  const handleAnalyze = async (event) => {
    event.preventDefault();

    if (!repoUrl) return;

    setLoading(true);
    setReport(null);
    setLogs(['Submitting repository for analysis...']);
    setStatus('pending');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await res.json();

      if (res.ok) {
        setTaskId(data.taskId);
        setStatus('running');
      } else {
        setLoading(false);
        alert(data.error || 'Failed to start analysis');
      }
    } catch (error) {
      setLoading(false);
      alert(`Network error: ${error.message}`);
    }
  };

  const getStepClass = (stepIndex) => {
    const logStr = logs.join('\n').toLowerCase();

    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    if (!loading) return 'pending';

    switch (stepIndex) {
      case 1:
        if (logStr.includes('cloning')) return 'running';
        if (logStr.includes('detected') || logStr.includes('inspecting')) return 'completed';
        return 'pending';
      case 2:
        if (logStr.includes('inspecting') && !logStr.includes('querying')) return 'running';
        if (logStr.includes('querying') || logStr.includes('synthesis') || logStr.includes('analyzing')) return 'completed';
        return 'pending';
      case 3:
        if (logStr.includes('querying') || logStr.includes('decided to inspect') || logStr.includes('deeply inspecting')) return 'running';
        if (logStr.includes('synthesizing') || logStr.includes('synthesis') || logStr.includes('report synthesized')) return 'completed';
        return 'pending';
      case 4:
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
            <label className="form-label">Repository URL</label>
            <div className="input-wrapper">
              <input
                type="text"
                className="form-input"
                placeholder="https://github.com/username/project-repo"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                disabled={loading}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Examples</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => loadExample('https://github.com/miguelgrinberg/flasky-first-edition')}
                style={{ minHeight: '38px', padding: '0 14px' }}
                disabled={loading}
              >
                Flasky App
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => loadExample('https://github.com/reduxjs/redux-templates')}
                style={{ minHeight: '38px', padding: '0 14px' }}
                disabled={loading}
              >
                Redux Template
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Analyzing repository...' : 'Run repository analysis'}
          </button>
        </form>

        {loading ? (
          <div className="stepper-logs-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.8fr) 1fr', marginTop: '24px' }}>
            <div className="stepper-container">
              <div className={`step-item ${getStepClass(1)}`}>
                <div className="step-status">1</div>
                <div className="step-label">Cloning source</div>
              </div>
              <div className={`step-item ${getStepClass(2)}`}>
                <div className="step-status">2</div>
                <div className="step-label">Mapping structure</div>
              </div>
              <div className={`step-item ${getStepClass(3)}`}>
                <div className="step-status">3</div>
                <div className="step-label">Inspecting code paths</div>
              </div>
              <div className={`step-item ${getStepClass(4)}`}>
                <div className="step-status">4</div>
                <div className="step-label">Synthesizing report</div>
              </div>
            </div>

            <div className="logs-panel-wrapper">
              <div className="logs-panel" ref={logsContainerRef}>
                <div style={{ fontSize: '0.78rem', borderBottom: '1px solid rgba(138, 224, 210, 0.18)', paddingBottom: '6px', marginBottom: '10px', color: '#a9f1e6' }}>
                  LIVE EXECUTION LOGS
                </div>
                {logs.map((log, index) => (
                  <div key={index} className={`log-line ${log.toLowerCase().includes('error') ? 'error' : ''}`}>
                    &gt; {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {report ? (
        <div className="results-container">
          <div className="tree-explorer glass-panel">
            <h3>Project tree</h3>
            <FileTree data={report.tree} name={report.projectName} />
          </div>

          <div className="report-panel glass-panel">
            <div className="tab-headers">
              <button type="button" className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
                Summary
              </button>
              <button type="button" className={`tab-btn ${activeTab === 'features' ? 'active' : ''}`} onClick={() => setActiveTab('features')}>
                Features
              </button>
              <button type="button" className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`} onClick={() => setActiveTab('architecture')}>
                Architecture
              </button>
              <button type="button" className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`} onClick={() => setActiveTab('suggestions')}>
                Recommendations
              </button>
              <button type="button" className={`tab-btn ${activeTab === 'learning' ? 'active' : ''}`} onClick={() => setActiveTab('learning')}>
                Learning path
              </button>
            </div>

            <div className="report-content">
              {activeTab === 'summary' ? (
                <div className="report-section">
                  <div className="project-meta-header">
                    <h2>{report.projectName}</h2>
                    <span className={`badge-difficulty ${report.difficultyLevel?.toLowerCase() || 'intermediate'}`}>
                      {report.difficultyLevel}
                    </span>
                  </div>

                  <p style={{ fontSize: '1.02rem', lineHeight: '1.75', color: 'var(--text-secondary)' }}>{report.summary}</p>

                  <div style={{ marginTop: '8px' }}>
                    <h3>Detected technology stack</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '16px' }}>
                      {report.techStack?.languages ? (
                        <div className="tech-group">
                          <div className="tech-group-title">Languages</div>
                          <div className="tech-chips">
                            {report.techStack.languages.map((tech, index) => (
                              <span key={index} className="tech-chip">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {report.techStack?.frontend ? (
                        <div className="tech-group">
                          <div className="tech-group-title">Frontend</div>
                          <div className="tech-chips">
                            {report.techStack.frontend.map((tech, index) => (
                              <span key={index} className="tech-chip">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {report.techStack?.backend ? (
                        <div className="tech-group">
                          <div className="tech-group-title">Backend</div>
                          <div className="tech-chips">
                            {report.techStack.backend.map((tech, index) => (
                              <span key={index} className="tech-chip">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {report.techStack?.database ? (
                        <div className="tech-group">
                          <div className="tech-group-title">Database</div>
                          <div className="tech-chips">
                            {report.techStack.database.map((tech, index) => (
                              <span key={index} className="tech-chip">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'features' ? (
                <div className="report-section">
                  <h2>Core features</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    The analysis traced the main implementation flows and summarized the primary capabilities below.
                  </p>
                  <div className="feature-list">
                    {report.features?.map((feature, index) => (
                      <div key={index} className="feature-item">
                        <h4>{feature.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>{feature.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === 'architecture' ? (
                <div className="report-section">
                  <h2>Architecture and flow</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                      <h4 style={{ marginBottom: '8px', color: 'var(--accent-teal)' }}>Project layout overview</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>{report.architecture?.structureDescription}</p>
                    </div>
                    <div>
                      <h4 style={{ marginBottom: '8px', color: 'var(--accent-teal)' }}>Data and execution flow</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>{report.architecture?.dataFlow}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'suggestions' ? (
                <div className="report-section">
                  <h2>Mentor recommendations</h2>

                  {report.missingComponents?.length ? (
                    <div>
                      <h4 style={{ marginBottom: '12px', color: 'var(--accent-red)' }}>Missing or unclear areas</h4>
                      <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {report.missingComponents.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="suggestion-list">
                    {report.improvementSuggestions?.map((suggestion, index) => (
                      <div key={index} className={`suggestion-item ${suggestion.area?.toLowerCase() || 'quality'}`}>
                        <h4>{suggestion.area || 'General'} focus</h4>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>{suggestion.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === 'learning' ? (
                <div className="report-section">
                  <h2>Recommended learning path</h2>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                    {report.learningRecommendations?.map((recommendation, index) => (
                      <li key={index} style={{ lineHeight: '1.7' }}>
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
