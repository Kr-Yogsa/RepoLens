import { useState } from 'react';
import {
  FileText,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import './App.css';
import RepoAnalyzer from './components/RepoAnalyzer';
import PdfAnalyzer from './components/PdfAnalyzer';
import InterviewTrainer from './components/InterviewTrainer';

const workspaceOptions = [
  {
    id: 'repo',
    title: 'Repository Scan',
    description: '',
    cta: 'Analyze repository',
    icon: FolderGit2,
    tone: 'teal',
  },
  {
    id: 'pdf',
    title: 'PDF Project Brief',
    description: '',
    cta: 'Upload PDF',
    icon: FileText,
    tone: 'amber',
  },
];

const navItems = [
  { id: 'analyzer', label: 'Analyzer Workspace', icon: LayoutDashboard },
  { id: 'interview-trainer', label: 'Interview Arena', icon: GraduationCap },
];

function App() {
  const [activeTab, setActiveTab] = useState('analyzer');
  const [activeOption, setActiveOption] = useState(null);
  const [interviewQuestions, setInterviewQuestions] = useState([]);

  const handleAnalysisComplete = (report) => {
    if (report?.interviewQuestions) {
      setInterviewQuestions(report.interviewQuestions);
    }
  };

  const resetAnalysis = () => {
    setActiveOption(null);
  };

  return (
    <div className="app-shell">
      <div className="app-background" />

      <aside className="app-sidebar">
        <div className="brand-section">
          <div className="brand-logo">
            <Sparkles size={18} strokeWidth={2.2} />
          </div>
          <div>
            <p className="brand-kicker">AI Project Intelligence</p>
            <span className="brand-name">RepoLens</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {item.id === 'interview-trainer' && interviewQuestions.length > 0 ? (
                      <span className="menu-pill">{interviewQuestions.length}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="model-badge active">
            <span className="dot" />
            <span>Agent engine online</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <section
          className="workspace-section"
          style={{ display: activeTab === 'analyzer' ? 'flex' : 'none' }}
        >
          {activeOption === null ? (
            <div className="selection-stage">
              <div className="workspace-heading">
                <div>
                  <p className="section-kicker">Choose your route</p>
                  <h2>Pick one</h2>
                </div>
              </div>

              <div className="selection-grid">
                {workspaceOptions.map((option) => {
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`selection-card glass-panel ${option.tone}`}
                      onClick={() => setActiveOption(option.id)}
                    >
                      <div className="selection-icon">
                        <Icon size={28} />
                      </div>
                      <div className="selection-copy">
                        <span className="selection-tag">
                          {option.id === 'repo' ? 'Live repository' : 'Report upload'}
                        </span>
                        <h3>{option.title}</h3>
                        {option.description ? <p>{option.description}</p> : null}
                      </div>
                      <span className="selection-cta">{option.cta}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="active-workspace">
              <div className="workspace-toolbar">
                <button type="button" className="btn-secondary" onClick={resetAnalysis}>
                  Back to source selection
                </button>
              </div>

              <div style={{ display: activeOption === 'repo' ? 'block' : 'none' }}>
                <RepoAnalyzer apiConfig={{}} onAnalysisComplete={handleAnalysisComplete} />
              </div>

              <div style={{ display: activeOption === 'pdf' ? 'block' : 'none' }}>
                <PdfAnalyzer apiConfig={{}} onAnalysisComplete={handleAnalysisComplete} />
              </div>
            </div>
          )}
        </section>

        <section
          className="workspace-section"
          style={{ display: activeTab === 'interview-trainer' ? 'flex' : 'none' }}
        >
          <InterviewTrainer apiConfig={{}} interviewQuestions={interviewQuestions} />
        </section>
      </main>
    </div>
  );
}

export default App;
