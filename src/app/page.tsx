'use client';

import dynamic from 'next/dynamic';

const GameApp = dynamic(() => import('@/App'), { ssr: false });

export default function Home() {
  return <GameApp />;
}
