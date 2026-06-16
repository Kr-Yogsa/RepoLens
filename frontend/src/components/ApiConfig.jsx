import React, { useState, useEffect } from 'react';

export default function ApiConfig({ isOpen, onClose, onConfigChange }) {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem('repolens_provider') || 'gemini';
    const savedKey = localStorage.getItem('repolens_apikey') || '';
    const savedModel = localStorage.getItem('repolens_modelname') || '';

    setProvider(savedProvider);
    setApiKey(savedKey);
    
    if (savedModel) {
      setModelName(savedModel);
    } else {
      // Set default models
      setModelName(savedProvider === 'gemini' ? 'gemini-1.5-flash' : 'meta/llama-3.1-70b-instruct');
    }
  }, [isOpen]);

  const handleProviderChange = (e) => {
    const prov = e.target.value;
    setProvider(prov);
    setModelName(prov === 'gemini' ? 'gemini-1.5-flash' : 'meta/llama-3.1-70b-instruct');
  };

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('repolens_provider', provider);
    localStorage.setItem('repolens_apikey', apiKey);
    localStorage.setItem('repolens_modelname', modelName);
    
    onConfigChange({ provider, apiKey, modelName });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h2>Configure AI LLM Models</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">LLM Provider</label>
            <select 
              className="form-input" 
              value={provider} 
              onChange={handleProviderChange}
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="gemini">Google Gemini AI</option>
              <option value="nvidia">NVIDIA NIM (LLaMA/Nemotron)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{provider === 'gemini' ? 'Gemini API Key' : 'NVIDIA NIM API Key'}</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder={provider === 'gemini' ? 'AIzaSy...' : 'nvapi-...'}
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Your key is saved locally in your browser cache and is only sent to your local backend server.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Model Name</label>
            {provider === 'gemini' ? (
              <select 
                className="form-input" 
                value={modelName} 
                onChange={(e) => setModelName(e.target.value)}
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                <option value="gemini-1.5-flash">gemini-1.5-flash (Fast, Recommended)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Accurate, Slower)</option>
                <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Experimental)</option>
              </select>
            ) : (
              <select 
                className="form-input" 
                value={modelName} 
                onChange={(e) => setModelName(e.target.value)}
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                <option value="meta/llama-3.1-70b-instruct">meta/llama-3.1-70b-instruct (Llama 3.1 NIM)</option>
                <option value="meta/llama-3.1-405b-instruct">meta/llama-3.1-405b-instruct (Llama 3.1 405B NIM)</option>
                <option value="nvidia/nemotron-4-340b-instruct">nvidia/nemotron-4-340b-instruct (Nemotron 340B NIM)</option>
              </select>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
