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
  const [sdkInfo, setSdkInfo] = useState<string>('');
  const projectId = process.env.NEXT_PUBLIC_TRANSCODES_PROJECT_ID;

  // Native 앱으로 메시지 전송
  const sendToNative = useCallback((type: string, payload: unknown) => {
    if (typeof window === 'undefined') return;
    
    const message = JSON.stringify({ type, payload });
    
    console.log('[Page] Sending to native:', type, payload);

    // iOS WKWebView
    if (window.webkit?.messageHandlers?.nativeBridge) {
      window.webkit.messageHandlers.nativeBridge.postMessage(message);
      return;
    }
    
    // Android WebView
    if (window.AndroidBridge) {
      window.AndroidBridge.postMessage(message);
      return;
    }
    
    // 브라우저에서 테스트할 때는 콘솔에 출력
    console.log('[Page] Native bridge not found. Message:', message);
  }, []);

  // Check SDK initialization after script is loaded from layout
  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('[Page] Checking for window.transcodes...');
    setStatus('Script loaded. Checking SDK...');
    
    // SDK가 전역 객체에 추가될 때까지 폴링
    let checkCount = 0;
    const maxChecks = 30;
    const checkInterval = 200; // 200ms
    
    // Check if DOMContentLoaded has already fired
    const isDOMReady = document.readyState === 'complete' || document.readyState === 'interactive';
    console.log('[Page] Document readyState:', document.readyState);
    
    function checkSDKInitialization() {
      const checkSDK = setInterval(() => {
        checkCount++;
        console.log(`[Page] Check ${checkCount}/${maxChecks} for window.transcodes`);
        
        if (window.transcodes) {
          console.log('[Page] window.transcodes found!');
          console.log('[Page] window.transcodes:', window.transcodes);
          
          if (typeof window.transcodes.openAuthLoginModal === 'function') {
            // Check function source to see if it's the dummy or real implementation
            const funcString = window.transcodes.openAuthLoginModal.toString();
            const isDummyFunction = funcString.includes('Not initialized') && funcString.includes('success: false');
            
            if (isDummyFunction) {
              console.log('[Page] SDK function exists but is still dummy function (waiting for setupAuthLoginModal)');
              setSdkInfo(`window.transcodes.openAuthLoginModal exists but is dummy function (check ${checkCount}/${maxChecks})`);
            } else {
              // Real implementation is ready
              console.log('[Page] SDK is fully initialized!');
              clearInterval(checkSDK);
              setStatus('✅ SDK loaded and initialized');
              setSdkInfo('window.transcodes.openAuthLoginModal is ready and initialized');
              
              // Automatically open the auth login modal
              console.log('[Page] Opening auth login modal automatically...');
              setStatus('Opening authentication modal...');
              sendToNative('AUTH_STARTED', {});
              
              window.transcodes.openAuthLoginModal({
                projectId: projectId,
                showBrandingPanel: true,
              })
                .then(async (result) => {
                  console.log('[Page] Auth login modal result:', result);
                  if (result.success && result.payload && result.payload.length > 0) {
                    const { token: payloadToken, user } = result.payload[0];
                    
                    // Get actual access token using token.getAccessToken()
                    let accessToken = payloadToken;
                    
                    // If token from payload is empty, try to get it from token API
                    // Wait for private key to be available first
                    if (!accessToken && window.transcodes?.token?.getAccessToken) {
                      console.log('[Page] Token from payload is empty, waiting for private key and trying getAccessToken()...');
                      
                      // Poll for private key availability (max 5 seconds)
                      const maxAttempts = 25;
                      const pollInterval = 200; // 200ms
                      let attempts = 0;
                      let hasKey = false;
                      
                      // First, wait for private key to be available
                      while (attempts < maxAttempts && !hasKey) {
                        try {
                          hasKey = await window.transcodes.token.hasPrivateKey();
                          if (hasKey) {
                            console.log('[Page] ✅ Private key is available');
                            break;
                          }
                          attempts++;
                          if (attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, pollInterval));
                          }
                        } catch (error) {
                          console.error('[Page] Error checking private key:', error);
                          break;
                        }
                      }
                      
                      if (hasKey) {
                        // Try to get token with retries
                        attempts = 0;
                        while (attempts < maxAttempts) {
                          try {
                            const tokenFromAPI = await window.transcodes.token.getAccessToken();
                            if (tokenFromAPI) {
                              accessToken = tokenFromAPI;
                              console.log('[Page] ✅ Got token from getAccessToken(), length:', accessToken.length);
                              break;
                            }
                            attempts++;
                            if (attempts < maxAttempts) {
                              console.log(`[Page] Token not ready yet, retrying... (${attempts}/${maxAttempts})`);
                              await new Promise(resolve => setTimeout(resolve, pollInterval));
                            }
                          } catch (tokenError) {
                            console.error('[Page] Error getting token from API:', tokenError);
                            attempts++;
                            if (attempts < maxAttempts) {
                              await new Promise(resolve => setTimeout(resolve, pollInterval));
                            }
                          }
                        }
                        
                        if (!accessToken) {
                          console.warn('[Page] ⚠️ getAccessToken() returned null after retries');
                        }
                      } else {
                        console.warn('[Page] ⚠️ Private key not available after waiting');
                      }
                    }
                    
                    if (accessToken) {
                      setStatus('✅ Authentication successful!');
                      setSdkInfo(`Authenticated as: ${user.email || user.id}\nToken length: ${accessToken.length}`);
                      
                      // Send token to native app
                      sendToNative('AUTH_SUCCESS', {
                        token: accessToken,
                        user: {
                          id: user.id,
                          email: user.email,
                          name: user.name,
                        },
                      });
                    } else {
                      setStatus('⚠️ Authentication succeeded but no token available');
                      setSdkInfo('User authenticated but token is not available. Please try refreshing.');
                      sendToNative('AUTH_ERROR', {
                        message: 'Token not available after authentication. Private key may not be ready yet.',
                      });
                    }
                  } else {
                    setStatus('❌ Authentication failed');
                    setSdkInfo(result.error || 'Authentication failed');
                    sendToNative('AUTH_ERROR', {
                      message: result.error || 'Authentication failed',
                    });
                  }
                })
                .catch((error) => {
                  console.error('[Page] Error opening auth login modal:', error);
                  setStatus('❌ Error opening modal');
                  setSdkInfo(`Error: ${error.message || error}`);
                  sendToNative('AUTH_ERROR', {
                    message: error.message || 'Unknown error',
                  });
                });
            }
          } else {
            console.warn('[Page] window.transcodes exists but openAuthLoginModal is not a function');
            setSdkInfo(`window.transcodes exists but openAuthLoginModal is: ${typeof window.transcodes.openAuthLoginModal}`);
          }
        } else if (checkCount >= maxChecks) {
          console.error('[Page] Timeout waiting for window.transcodes');
          clearInterval(checkSDK);
          setStatus('❌ Timeout: window.transcodes not found');
          setSdkInfo(`Checked ${maxChecks} times but window.transcodes was never available`);
        }
      }, checkInterval);
    }

    if (!isDOMReady) {
      console.log('[Page] Waiting for DOMContentLoaded event...');
      // Wait for DOMContentLoaded
      const onDOMReady = () => {
        console.log('[Page] DOMContentLoaded fired, checking SDK initialization...');
        checkSDKInitialization();
      };
      
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', onDOMReady);
      } else {
        // Fallback for older browsers
        window.addEventListener('load', onDOMReady);
      }
    } else {
      console.log('[Page] DOM is already ready, checking SDK...');
      setTimeout(checkSDKInitialization, 500);
    }

    // Cleanup function
    return () => {
      // Cleanup will be handled by the interval clearing logic above
    };
  }, [projectId, sendToNative]);

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

        {sdkInfo && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <p style={{ color: '#666', fontSize: '14px', wordBreak: 'break-word' }}>
              {sdkInfo}
            </p>
          </div>
        )}

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
      </div>
    </div>
  );
}
