'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentUser } from '@/app/actions/auth';
import { User } from '@/app/generated/prisma/client';

interface TelegramContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  startParam: string | null;
  webApp?: any;
}

const TelegramContext = createContext<TelegramContextType>({
  user: null,
  isLoading: true,
  error: null,
  startParam: null,
  webApp: undefined,
});

export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [webApp, setWebApp] = useState<any>(undefined);

  useEffect(() => {
    const init = async () => {
      try {
        // Check if running in browser environment
        if (typeof window === 'undefined') return;

        // Dynamically import Telegram WebApp SDK
        const WebApp = (await import('@twa-dev/sdk')).default;
        setWebApp(WebApp);

        // Initialize Telegram WebApp
        WebApp.ready();
        WebApp.expand();

        // Get start parameter if exists (for deep linking)
        const param = WebApp.initDataUnsafe.start_param;
        if (param) {
          setStartParam(param);
        }

        const initData = WebApp.initData;
        
        if (initData) {
          const result = await getCurrentUser(initData);
          if (result.success && result.user) {
            setUser(result.user);
          } else {
            setError(result.error || 'Authentication failed');
          }
        } else {
          // Dev mode or outside Telegram
          console.warn('No initData found. Running outside Telegram?');
          // For development purposes, you might want to mock a user here if env is dev
          if (process.env.NODE_ENV === 'development') {
             // Optional: mock user
          }
        }
      } catch (e) {
        console.error('Telegram init error:', e);
        setError('Failed to initialize application');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  return (
    <TelegramContext.Provider value={{ user, isLoading, error, startParam, webApp }}>
      {children}
    </TelegramContext.Provider>
  );
}
