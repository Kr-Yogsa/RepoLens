import React, { useState, useEffect } from 'react';

export default function InterviewTrainer({ apiConfig, interviewQuestions }) {
  const [questions, setQuestions] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);

  // Synchronize and format interviewQuestions prop into state
  useEffect(() => {
    if (interviewQuestions && interviewQuestions.length > 0) {
      setQuestions(
        interviewQuestions.map((q) => {
          if (typeof q === 'string') {
            return { question: q, answer: null };
          } else {
            return { question: q.question || '', answer: q.answer || null };
          }
        })
      );
      setSelectedIdx(0);
      setUserAnswer('');
      setShowModelAnswer(false);
      setReviewResult(null);
    }
  }, [interviewQuestions]);

  if (!interviewQuestions || interviewQuestions.length === 0) {
    return (
      <div className="empty-trainer-state glass-panel">
        <div className="empty-trainer-icon">🎓</div>
        <h2>No Questions Loaded</h2>
        <p>
          Please run a repository or PDF analysis first to generate custom questions for your project.
        </p>
      </div>
    );
  }

  const currentQA = questions[selectedIdx] || { question: '', answer: null };

  const handleSelectQuestion = (idx) => {
    setSelectedIdx(idx);
    setUserAnswer('');
    setShowModelAnswer(false);
    setReviewResult(null);
  };

  // Helper function to fetch the model answer on-demand
  const fetchModelAnswer = async (idx) => {
    const qObj = questions[idx];
    if (qObj.answer) return qObj.answer;

    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: qObj.question })
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        // Cache the answer in local state
        const updatedQuestions = [...questions];
        updatedQuestions[idx].answer = data.answer;
        setQuestions(updatedQuestions);
        return data.answer;
      } else {
        throw new Error(data.error || "Failed to generate answer");
      }
    } catch (err) {
      alert(`Error generating answer: ${err.message}`);
      return null;
    }
  };

  const handleToggleModelAnswer = async () => {
    if (showModelAnswer) {
      setShowModelAnswer(false);
      return;
    }

    if (currentQA.answer) {
      setShowModelAnswer(true);
      return;
    }

    setLoadingAnswer(true);
    const ans = await fetchModelAnswer(selectedIdx);
    setLoadingAnswer(false);
    if (ans) {
      setShowModelAnswer(true);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!userAnswer.trim()) return;

    setLoadingReview(true);
    setReviewResult(null);

    try {
      // 1. Ensure we have the model answer loaded. If not, fetch it first.
      let modelAnswer = currentQA.answer;
      if (!modelAnswer) {
        setLoadingAnswer(true);
        modelAnswer = await fetchModelAnswer(selectedIdx);
        setLoadingAnswer(false);
        if (!modelAnswer) {
          throw new Error("Could not retrieve model answer for evaluation.");
        }
      }

      // 2. Submit user answer and model answer for AI review
      const res = await fetch('/api/interview/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQA.question,
          modelAnswer: modelAnswer,
          userAnswer: userAnswer
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setReviewResult(data);
      } else {
        alert(data.error || "Failed to submit answer for review");
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setLoadingReview(false);
    }
  };

  const getScoreClass = (score) => {
    if (score >= 80) return 'good';
    if (score >= 50) return 'medium';
    return 'bad';
  };

  return (
    <div className="trainer-grid">
      <div className="question-list-panel glass-panel">
        <h3 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '12px' }}>
          Questions ({questions.length})
        </h3>
        {questions.map((qObj, idx) => (
          <div
            key={idx}
            className={`question-item-card ${selectedIdx === idx ? 'active' : ''}`}
            onClick={() => handleSelectQuestion(idx)}
          >
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Question {idx + 1}
            </span>
            <h4 style={{ marginTop: '4px' }}>
              {qObj.question.length > 80 ? `${qObj.question.substring(0, 80)}...` : qObj.question}
            </h4>
          </div>
        ))}
      </div>

      <div className="question-detail-panel glass-panel">
        <div style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-purple)', fontWeight: 700 }}>
            Active Question
          </span>
          <h2 style={{ fontSize: '1.4rem', marginTop: '4px', lineHeight: '1.4' }}>{currentQA.question}</h2>
        </div>

        <form onSubmit={handleSubmitAnswer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Your Answer</label>
            <textarea
              className="form-input"
              rows="6"
              placeholder="Type your technical answer here..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={loadingReview}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loadingReview || loadingAnswer || !userAnswer.trim()}
            >
              {loadingReview ? 'Reviewing Answer...' : 'Submit to AI Interviewer'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleToggleModelAnswer}
              disabled={loadingReview || loadingAnswer}
            >
              {loadingAnswer ? 'Disclosing Answer...' : showModelAnswer ? 'Hide Model Answer' : 'Disclose Model Answer'}
            </button>
          </div>
        </form>

        {showModelAnswer && currentQA.answer && (
          <div className="chat-bubble interviewer" style={{ marginTop: '24px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }}>Senior Mentor Answer Guidance</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
              {currentQA.answer}
            </p>
          </div>
        )}

        {reviewResult && (
          <div style={{ marginTop: '28px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Interviewer Evaluation</h3>
            
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className={`score-circle ${getScoreClass(reviewResult.score)}`}>
                {reviewResult.score}
              </div>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>Review Feedback</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  {reviewResult.feedback}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
              <div className="suggestion-item quality">
                <h4 style={{ color: 'var(--accent-green)' }}>👍 What You Did Well</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px', lineHeight: '1.5' }}>
                  {reviewResult.whatWasGood || "Your explanation covers the basic concepts well."}
                </p>
              </div>
              <div className="suggestion-item security">
                <h4 style={{ color: 'var(--accent-orange)' }}>📈 How To Improve</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px', lineHeight: '1.5' }}>
                  {reviewResult.howToImprove || "Try to refer to specific file paths, package configs, or database tables next time."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
