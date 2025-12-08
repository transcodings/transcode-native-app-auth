'use client';

import { useEffect } from 'react';
import Script from 'next/script';

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
      token: {
        hasPrivateKey: () => Promise<boolean>;
        getAccessToken: () => Promise<string | null>;
      };
    };
  }
}

export default function SilentRefreshPage() {
  const projectId = process.env.NEXT_PUBLIC_TRANSCODES_PROJECT_ID;

  const sendToNative = (type: string, payload: unknown) => {
    const message = JSON.stringify({ type, payload });
    
    if (window.webkit?.messageHandlers?.nativeBridge) {
      window.webkit.messageHandlers.nativeBridge.postMessage(message);
    } else if (window.AndroidBridge) {
      window.AndroidBridge.postMessage(message);
    }
  };

  useEffect(() => {
    const refreshToken = async () => {
      if (!window.transcodes) {
        sendToNative('REFRESH_FAILED', { reason: 'SDK_NOT_LOADED' });
        return;
      }

      try {
        const hasKey = await window.transcodes.token.hasPrivateKey();
        
        if (!hasKey) {
          sendToNative('REFRESH_FAILED', { reason: 'NO_PRIVATE_KEY' });
          return;
        }

        const token = await window.transcodes.token.getAccessToken();
        
        if (token) {
          sendToNative('REFRESH_SUCCESS', { token });
        } else {
          sendToNative('REFRESH_FAILED', { reason: 'TOKEN_GENERATION_FAILED' });
        }
      } catch (error) {
        sendToNative('REFRESH_FAILED', { 
          reason: 'ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    if (typeof window.transcodes !== 'undefined') {
      refreshToken();
    }
  }, []);

  return null; // Hidden page for silent refresh
}

