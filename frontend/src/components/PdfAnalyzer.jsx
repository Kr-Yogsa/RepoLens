import React, { useState, useEffect, useRef } from 'react';

export default function PdfAnalyzer({ apiConfig, onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  
  const fileInputRef = useRef(null);
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
            setTaskId(null);
            if (onAnalysisComplete) {
              onAnalysisComplete(data.result);
            }
          } else if (data.status === 'failed') {
            setLoading(false);
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

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        alert("Please upload PDF files only.");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setReport(null);
    setLogs(["Preparing PDF file upload..."]);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch('/api/analyze-pdf', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setTaskId(data.taskId);
        setLogs(prev => [...prev, "PDF uploaded successfully. Starting analysis queue..."]);
      } else {
        setLoading(false);
        alert(data.error || "Failed to start analysis");
      }
    } catch (err) {
      setLoading(false);
      alert(`Network error: ${err.message}`);
    }
  };


  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="analyzer-card glass-panel">
        {!loading && (
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
              <div className="drag-icon">📥</div>
              {file ? (
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{file.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Click or drag to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: 500 }}>Drag and drop your project report PDF here</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Supports files up to 25MB
                  </p>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={!file} 
              style={{ marginTop: '20px' }}
            >
              Analyze Project Report PDF
            </button>
          </form>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '20px', height: '20px', border: '3px solid rgba(0,242,254,0.1)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontWeight: 500, color: 'var(--accent-cyan)' }}>Processing project report PDF...</span>
            </div>
            
            <div className="logs-panel">
              <div style={{ fontSize: '0.8rem', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '4px', color: '#60a5fa' }}>
                LIVE PDF AGENT LOGS
              </div>
              {logs.map((log, i) => (
                <div key={i} className="log-line">&gt; {log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {report && (
        <div className="report-panel glass-panel" style={{ width: '100%' }}>
          <div className="tab-headers">
            <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
            <button className={`tab-btn ${activeTab === 'features' ? 'active' : ''}`} onClick={() => setActiveTab('features')}>Features</button>
            <button className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`} onClick={() => setActiveTab('architecture')}>Architecture</button>
            <button className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`} onClick={() => setActiveTab('suggestions')}>Mentor Suggestions</button>
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
                  <h3>Estimated Technology Stack</h3>
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
                        <div className="tech-group-title">Frontend</div>
                        <div className="tech-chips">
                          {report.techStack.frontend.map((t, idx) => <span key={idx} className="tech-chip">{t}</span>)}
                        </div>
                      </div>
                    )}
                    {report.techStack?.backend && (
                      <div className="tech-group">
                        <div className="tech-group-title">Backend</div>
                        <div className="tech-chips">
                          {report.techStack.backend.map((t, idx) => <span key={idx} className="tech-chip">{t}</span>)}
                        </div>
                      </div>
                    )}
                    {report.techStack?.database && (
                      <div className="tech-group">
                        <div className="tech-group-title">Database</div>
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
                <h2>Project Features Extracted</h2>
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
                <h2>System Architecture</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
                  <div>
                    <h4 style={{ color: 'var(--accent-purple)', marginBottom: '8px' }}>Project Layout Overview</h4>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                      {report.architecture?.structureDescription}
                    </p>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                    <h4 style={{ color: 'var(--accent-purple)', marginBottom: '8px' }}>Data Flow</h4>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                      {report.architecture?.dataFlow}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'suggestions' && (
              <div className="report-section">
                <h2>Mentor Advice</h2>
                
                {report.missingComponents && report.missingComponents.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ color: 'var(--accent-red)', marginBottom: '12px' }}>⚠️ Gaps & Missing Sections</h4>
                    <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {report.missingComponents.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                  <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '16px' }}>🛠 Recommendations</h4>
                  <div className="suggestion-list">
                    {report.improvementSuggestions?.map((s, idx) => (
                      <div key={idx} className={`suggestion-item ${s.area?.toLowerCase() || 'quality'}`}>
                        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {s.area} Advice
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
      )}
    </div>
  );
}
