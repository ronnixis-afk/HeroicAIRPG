'use client';

import { useAuth } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import LandingPage from '@/components/LandingPage';

const GameApp = dynamic(() => import('@/App'), { ssr: false });

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSignedIn) {
    return <GameApp />;
  }

  return <LandingPage />;
}
