import { useEffect, useState } from 'react';

const parseInlineMarkdown = (text) => {
  if (!text) return '';
  const parts = text.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{parseCodeInline(part)}</strong>;
    }
    return parseCodeInline(part);
  });
};

const parseCodeInline = (text) => {
  if (!text) return '';
  const parts = text.split('`');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <code key={index} style={{ 
          background: 'rgba(255, 255, 255, 0.08)', 
          padding: '2px 6px', 
          borderRadius: '4px',
          fontFamily: 'monospace',
          color: 'var(--accent-teal)'
        }}>
          {part}
        </code>
      );
    }
    return part;
  });
};

const renderMarkdown = (text) => {
  if (!text) return null;

  const lines = text.split('\n');
  const renderedElements = [];
  
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];

    // Check if the next line is an underline header (=== or ---)
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (/^={3,}$/.test(nextLine)) {
        renderedElements.push(
          <h3 key={i} style={{ color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }}>
            {parseInlineMarkdown(line)}
          </h3>
        );
        i += 2;
        continue;
      } else if (/^-{3,}$/.test(nextLine)) {
        renderedElements.push(
          <h4 key={i} style={{ color: 'var(--text-primary)', marginTop: '14px', marginBottom: '6px' }}>
            {parseInlineMarkdown(line)}
          </h4>
        );
        i += 2;
        continue;
      }
    }

    if (line.startsWith('# ')) {
      renderedElements.push(<h2 key={i} style={{ color: 'var(--text-primary)', marginTop: '20px', marginBottom: '10px' }}>{parseInlineMarkdown(line.slice(2))}</h2>);
    } else if (line.startsWith('## ')) {
      renderedElements.push(<h3 key={i} style={{ color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px' }}>{parseInlineMarkdown(line.slice(3))}</h3>);
    } else if (line.startsWith('### ')) {
      renderedElements.push(<h4 key={i} style={{ color: 'var(--text-primary)', marginTop: '14px', marginBottom: '6px' }}>{parseInlineMarkdown(line.slice(4))}</h4>);
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      renderedElements.push(
        <ul key={i} style={{ marginLeft: '20px', marginBottom: '6px', listStyleType: 'disc' }}>
          <li style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{parseInlineMarkdown(line.slice(2))}</li>
        </ul>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+\.\s)(.*)/);
      renderedElements.push(
        <ol key={i} style={{ marginLeft: '20px', marginBottom: '6px', listStyleType: 'decimal' }}>
          <li style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{parseInlineMarkdown(match[2])}</li>
        </ol>
      );
    } else if (line.trim() === '') {
      renderedElements.push(<div key={i} style={{ height: '8px' }} />);
    } else {
      renderedElements.push(
        <p key={i} style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '8px' }}>
          {parseInlineMarkdown(line)}
        </p>
      );
    }
    i++;
  }

  return <div className="markdown-content">{renderedElements}</div>;
};

export default function InterviewTrainer({ apiConfig, interviewQuestions }) {
  const [questions, setQuestions] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);

  useEffect(() => {
    if (interviewQuestions && interviewQuestions.length > 0) {
      setQuestions(
        interviewQuestions.map((question) =>
          typeof question === 'string'
            ? { question, answer: null, userAnswer: '', showModelAnswer: false, reviewResult: null }
            : { 
                question: question.question || '', 
                answer: question.answer || null, 
                userAnswer: question.userAnswer || '', 
                showModelAnswer: question.showModelAnswer || false, 
                reviewResult: question.reviewResult || null 
              }
        )
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
        <div className="empty-trainer-icon">Q</div>
        <h2>No interview prompts yet</h2>
        <p>Run an analysis first.</p>
      </div>
    );
  }

  const currentQA = questions[selectedIdx] || { question: '', answer: null };

  const handleSelectQuestion = (index) => {
    setQuestions((prevQuestions) => {
      const updated = [...prevQuestions];
      if (updated[selectedIdx]) {
        updated[selectedIdx] = {
          ...updated[selectedIdx],
          userAnswer,
          showModelAnswer,
          reviewResult,
        };
      }
      
      const target = updated[index];
      if (target) {
        setUserAnswer(target.userAnswer || '');
        setShowModelAnswer(target.showModelAnswer || false);
        setReviewResult(target.reviewResult || null);
      }
      
      return updated;
    });
    setSelectedIdx(index);
  };

  const fetchModelAnswer = async (index) => {
    const selectedQuestion = questions[index];

    if (selectedQuestion.answer) {
      return selectedQuestion.answer;
    }

    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: selectedQuestion.question }),
      });

      const data = await res.json();

      if (res.ok && data.answer) {
        const updatedQuestions = [...questions];
        updatedQuestions[index].answer = data.answer;
        setQuestions(updatedQuestions);
        return data.answer;
      }

      throw new Error(data.error || 'Failed to generate answer');
    } catch (error) {
      alert(`Error generating answer: ${error.message}`);
      return null;
    }
  };

  const handleToggleModelAnswer = async () => {
    if (showModelAnswer) {
      setShowModelAnswer(false);
      setQuestions((prev) => {
        const updated = [...prev];
        if (updated[selectedIdx]) {
          updated[selectedIdx].showModelAnswer = false;
        }
        return updated;
      });
      return;
    }

    if (currentQA.answer) {
      setShowModelAnswer(true);
      setQuestions((prev) => {
        const updated = [...prev];
        if (updated[selectedIdx]) {
          updated[selectedIdx].showModelAnswer = true;
        }
        return updated;
      });
      return;
    }

    setLoadingAnswer(true);
    const answer = await fetchModelAnswer(selectedIdx);
    setLoadingAnswer(false);

    if (answer) {
      setShowModelAnswer(true);
      setQuestions((prev) => {
        const updated = [...prev];
        if (updated[selectedIdx]) {
          updated[selectedIdx].showModelAnswer = true;
          updated[selectedIdx].answer = answer;
        }
        return updated;
      });
    }
  };

  const handleSubmitAnswer = async (event) => {
    event.preventDefault();

    if (!userAnswer.trim()) return;

    setLoadingReview(true);
    setReviewResult(null);

    try {
      let modelAnswer = currentQA.answer;

      if (!modelAnswer) {
        setLoadingAnswer(true);
        modelAnswer = await fetchModelAnswer(selectedIdx);
        setLoadingAnswer(false);

        if (!modelAnswer) {
          throw new Error('Could not retrieve model answer for evaluation.');
        }
      }

      const res = await fetch('/api/interview/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQA.question,
          modelAnswer,
          userAnswer,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setReviewResult(data);
        setQuestions((prev) => {
          const updated = [...prev];
          if (updated[selectedIdx]) {
            updated[selectedIdx].reviewResult = data;
            updated[selectedIdx].userAnswer = userAnswer;
          }
          return updated;
        });
      } else {
        alert(data.error || 'Failed to submit answer for review');
      }
    } catch (error) {
      alert(`Network error: ${error.message}`);
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
        <h3 style={{ marginBottom: '4px' }}>Question queue</h3>
        <p style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>{questions.length} prompts</p>

        {questions.map((question, index) => (
          <div
            key={index}
            className={`question-item-card ${selectedIdx === index ? 'active' : ''}`}
            onClick={() => handleSelectQuestion(index)}
          >
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.12em' }}>
              Question {index + 1}
            </span>
            <h4 style={{ marginTop: '8px', lineHeight: '1.55' }}>
              {question.question.length > 90 ? `${question.question.substring(0, 90)}...` : question.question}
            </h4>
          </div>
        ))}
      </div>

      <div className="question-detail-panel glass-panel">
        <div style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--accent-amber)', fontWeight: 800, letterSpacing: '0.16em' }}>
            Active prompt
          </span>
          <h2 style={{ fontSize: '1.45rem', marginTop: '8px', lineHeight: '1.45' }}>{currentQA.question}</h2>
        </div>

        <form onSubmit={handleSubmitAnswer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Your answer</label>
            <textarea
              className="form-input"
              rows="7"
              placeholder="Explain your reasoning, refer to architecture decisions, and mention concrete implementation details."
              value={userAnswer}
              onChange={(event) => setUserAnswer(event.target.value)}
              disabled={loadingReview}
              style={{ resize: 'vertical', paddingTop: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="submit" className="btn-primary" disabled={loadingReview || loadingAnswer || !userAnswer.trim()}>
              {loadingReview ? 'Reviewing answer...' : 'Submit for review'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleToggleModelAnswer} disabled={loadingReview || loadingAnswer}>
              {loadingAnswer ? 'Loading guidance...' : showModelAnswer ? 'Hide guidance' : 'Show model guidance'}
            </button>
          </div>
        </form>

        {showModelAnswer && currentQA.answer ? (
          <div className="chat-bubble interviewer" style={{ marginTop: '24px' }}>
            <h4 style={{ marginBottom: '10px', color: 'var(--accent-teal)' }}>Model answer guidance</h4>
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>{renderMarkdown(currentQA.answer)}</div>
          </div>
        ) : null}

        {reviewResult ? (
          <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border-light)' }}>
            <h3 style={{ marginBottom: '16px' }}>Evaluation</h3>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className={`score-circle ${getScoreClass(reviewResult.score)}`}>{reviewResult.score}</div>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <h4 style={{ marginBottom: '6px' }}>Reviewer feedback</h4>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>{renderMarkdown(reviewResult.feedback)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '22px' }}>
              <div className="suggestion-item quality">
                <h4 style={{ color: 'var(--accent-green)' }}>What worked</h4>
                <div style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>
                  {reviewResult.whatWasGood ? renderMarkdown(reviewResult.whatWasGood) : <p>Your explanation covered the core concepts clearly.</p>}
                </div>
              </div>
              <div className="suggestion-item security">
                <h4 style={{ color: 'var(--accent-amber)' }}>Where to improve</h4>
                <div style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>
                  {reviewResult.howToImprove ? renderMarkdown(reviewResult.howToImprove) : <p>Add more concrete file paths, package names, or implementation tradeoffs next time.</p>}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
