import { useEffect, useRef, useState } from 'react';

export default function PdfAnalyzer({ apiConfig, onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');

  const fileInputRef = useRef(null);
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
            setTaskId(null);

            if (onAnalysisComplete) {
              onAnalysisComplete(data.result);
            }
          } else if (data.status === 'failed') {
            setLoading(false);
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

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const droppedFile = event.dataTransfer.files[0];

      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
      } else {
        alert('Please upload PDF files only.');
      }
    }
  };

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) return;

    setLoading(true);
    setReport(null);
    setLogs(['Preparing PDF upload...']);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/analyze-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setTaskId(data.taskId);
        setLogs((prev) => [...prev, 'PDF uploaded. Analysis queue started.']);
      } else {
        setLoading(false);
        alert(data.error || 'Failed to start analysis');
      }
    } catch (error) {
      setLoading(false);
      alert(`Network error: ${error.message}`);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="analyzer-card glass-panel">
        {!loading ? (
          <form onSubmit={handleSubmit}>
            <div
              className={`file-drag-zone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/pdf"
                style={{ display: 'none' }}
              />
              <div className="drag-icon">PDF</div>
              {file ? (
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>{file.name}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB. Click or drop another file to replace it.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: 700 }}>Drop a project report here</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Click to browse or drag in a PDF up to 25MB.
                  </p>
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={!file} style={{ marginTop: '20px' }}>
              Analyze project report
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  border: '3px solid rgba(30, 196, 180, 0.16)',
                  borderTopColor: 'var(--accent-teal)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>Processing uploaded project brief...</span>
            </div>

            <div className="logs-panel-wrapper">
              <div className="logs-panel" ref={logsContainerRef}>
                <div style={{ fontSize: '0.78rem', borderBottom: '1px solid rgba(138, 224, 210, 0.18)', paddingBottom: '6px', marginBottom: '10px', color: '#a9f1e6' }}>
                  LIVE PDF AGENT LOGS
                </div>
                {logs.map((log, index) => (
                  <div key={index} className="log-line">
                    &gt; {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {report ? (
        <div className="report-panel glass-panel" style={{ width: '100%' }}>
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
                  <h3>Estimated technology stack</h3>
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
                <h2>Project features</h2>
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
                <h2>System architecture</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <h4 style={{ marginBottom: '8px', color: 'var(--accent-teal)' }}>Project layout overview</h4>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>{report.architecture?.structureDescription}</p>
                  </div>
                  <div>
                    <h4 style={{ marginBottom: '8px', color: 'var(--accent-teal)' }}>Data flow</h4>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>{report.architecture?.dataFlow}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'suggestions' ? (
              <div className="report-section">
                <h2>Mentor advice</h2>

                {report.missingComponents?.length ? (
                  <div>
                    <h4 style={{ marginBottom: '12px', color: 'var(--accent-red)' }}>Missing or unclear sections</h4>
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
      ) : null}
    </div>
  );
}
