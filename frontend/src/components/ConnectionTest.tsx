// frontend/src/components/ConnectionTest.tsx
import React, { useState, useEffect } from 'react';

const ConnectionTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Testing connection...');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await fetch('http://localhost:3000/health');
        
        if (response.ok) {
          const result = await response.json();
          setStatus('Connected successfully');
          setData(result);
        } else {
          setStatus('Connection failed');
          setError(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err: unknown) {
        setStatus('Connection error');
        setError(err instanceof Error ? err.message : 'Connection error');
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #e0e0e0', 
      borderRadius: '8px',
      margin: '20px',
      backgroundColor: '#f9f9f9'
    }}>
      <h3 style={{ marginTop: 0 }}>Backend Connection Test</h3>
      <p><strong>Status:</strong> {status}</p>
      <p><strong>Backend URL:</strong> http://localhost:3000</p>
      
      {data && (
        <div style={{ marginTop: '15px' }}>
          <p><strong>Response Data:</strong></p>
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto'
          }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
      
      {error && (
        <div style={{ 
          marginTop: '15px', 
          color: '#d32f2f',
          backgroundColor: '#ffebee',
          padding: '10px',
          borderRadius: '4px'
        }}>
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
    </div>
  );
};

export default ConnectionTest;
