'use client';
import { SessionProvider } from 'next-auth/react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from '@/i18n/LanguageProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ReduxProvider store={store}>
        <LanguageProvider>
          {children}
          <Toaster position="top-right" />
        </LanguageProvider>
      </ReduxProvider>
    </SessionProvider>
  );
}
