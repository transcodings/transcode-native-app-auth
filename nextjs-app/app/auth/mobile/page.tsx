'use client';

import { useState, useEffect, useCallback } from 'react';

// Native Bridge 타입 정의
interface NativeBridge {
  postMessage: (message: string) => void;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        nativeBridge?: NativeBridge;
      };
    };
    AndroidBridge?: NativeBridge;
    transcodes?: {
      openAuthLoginModal: (params: {
        projectId?: string;
        showBrandingPanel?: boolean;
      }) => Promise<{
        success: boolean;
        payload: Array<{
          token: string;
          user: {
            id: string;
            email?: string;
            name?: string;
          };
        }>;
        error?: string;
      }>;
      token: {
        getAccessToken: () => Promise<string | null>;
        hasPrivateKey: () => Promise<boolean>;
      };
    };
  }
}

export default function MobileAuthPage() {
  const [status, setStatus] = useState<string>('Loading SDK...');
  const projectId = process.env.NEXT_PUBLIC_TRANSCODES_PROJECT_ID;
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';

  // Native 앱으로 메시지 전송
  const sendToNative = useCallback((type: string, payload: unknown) => {
    if (typeof window === 'undefined') return;
    
    const message = JSON.stringify({ type, payload });

    if (window.webkit?.messageHandlers?.nativeBridge) {
      window.webkit.messageHandlers.nativeBridge.postMessage(message);
    } else if (window.AndroidBridge) {
      window.AndroidBridge.postMessage(message);
    }
  }, []);

  // Get access token from API if payload token is empty
  const getAccessToken = useCallback(async (payloadToken: string): Promise<string | null> => {
    if (payloadToken) return payloadToken;
    
    if (!window.transcodes?.token?.getAccessToken) return null;
    
    try {
      const token = await window.transcodes.token.getAccessToken();
      return token;
    } catch {
      return null;
    }
  }, []);

  // Handle authentication result
  const handleAuthResult = useCallback(async (result: {
    success: boolean;
    payload?: Array<{
      token: string;
      user: { id: string; email?: string; name?: string };
    }>;
    error?: string;
  }) => {
    // User cancelled the modal (closed without completing authentication)
    if (!result.success && !result.error && !result.payload?.length) {
      setStatus('ℹ️ Authentication cancelled');
      sendToNative('AUTH_CANCELLED', {});
      return;
    }

    // Authentication failed with error
    if (!result.success || !result.payload?.length) {
      setStatus('❌ Authentication failed');
      sendToNative('AUTH_ERROR', {
        message: result.error || 'Authentication failed',
      });
      return;
    }

    // Authentication successful
    const { token: payloadToken, user } = result.payload[0];
    const accessToken = await getAccessToken(payloadToken);

    if (accessToken) {
      setStatus('✅ Authentication successful!');
      sendToNative('AUTH_SUCCESS', {
        token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } else {
      setStatus('⚠️ Token not available');
      sendToNative('AUTH_ERROR', {
        message: 'Token not available after authentication',
      });
    }
  }, [getAccessToken, sendToNative]);

  // Open auth modal
  const openAuthModal = useCallback(async () => {
    if (!window.transcodes?.openAuthLoginModal) return;

    setStatus('✅ SDK loaded');
    sendToNative('AUTH_STARTED', {});

    try {
      const result = await window.transcodes.openAuthLoginModal({
        projectId: projectId,
        showBrandingPanel: false,
      });
      await handleAuthResult(result);
    } catch (error) {
      setStatus('❌ Error opening modal');
      sendToNative('AUTH_ERROR', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [projectId, sendToNative, handleAuthResult]);

  // Check SDK initialization with recursive timeout
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setStatus('Checking SDK...');
    
    let checkCount = 0;
    const maxChecks = 20;
    const checkDelay = 300;
    let timeoutId: NodeJS.Timeout | null = null;

    const checkSDK = () => {
      checkCount++;

      if (window.transcodes?.openAuthLoginModal) {
        openAuthModal();
        return;
      }

      if (checkCount >= maxChecks) {
        setStatus('❌ SDK not found');
        return;
      }

      timeoutId = setTimeout(checkSDK, checkDelay);
    };

    checkSDK();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [openAuthModal]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: '#f5f5f5',
      }}
    >

      <div
        style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginBottom: '20px', fontSize: '24px' }}>
          SDK Script Load Test
        </h1>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#666', marginBottom: '10px', fontWeight: 'bold' }}>Status:</p>
          <p style={{ fontWeight: 'bold', fontSize: '18px', color: status.includes('✅') ? '#4CAF50' : status.includes('❌') ? '#f44336' : '#333' }}>
            {status}
          </p>
        </div>

        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', textAlign: 'left' }}>
          <p style={{ color: '#1976d2', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>Project ID:</p>
          <p style={{ color: '#1976d2', fontSize: '14px', fontFamily: 'monospace' }}>{projectId || 'Not set'}</p>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px', textAlign: 'left' }}>
          <p style={{ color: '#e65100', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>Script URL:</p>
          <p style={{ color: '#e65100', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {projectId ? `https://d2xt92e3v27lcm.cloudfront.net/${projectId}/webworker.js` : 'N/A'}
          </p>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f3e5f5', borderRadius: '8px', textAlign: 'left' }}>
          <p style={{ color: '#7b1fa2', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>App Version:</p>
          <p style={{ color: '#7b1fa2', fontSize: '14px', fontFamily: 'monospace' }}>v{appVersion}</p>
        </div>
      </div>
    </div>
  );
}
