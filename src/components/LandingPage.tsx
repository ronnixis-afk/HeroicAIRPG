'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const BACKGROUNDS = [
    '/login-bg.png',    // Fantasy
    '/bg-modern.png',   // Modern Dystopian
    '/bg-scifi.png',    // Sci-Fi
    '/bg-magitech.png'  // Magitech
];

const NEWS_ITEMS = [
    {
        date: 'Feb 28, 2026',
        title: 'User Tier System',
        content: 'Account tiers are now live. SuperAdmin users get exclusive AI access.'
    },
    {
        date: 'Feb 27, 2026',
        title: 'Cloud Save Sync',
        content: 'Back up and restore your worlds from the cloud. Never lose progress again.'
    },
    {
        date: 'Feb 27, 2026',
        title: 'Gemini 3 Integration',
        content: 'The AI engine now runs on Google Gemini 3 for richer, more immersive narratives.'
    },
    {
        date: 'Feb 26, 2026',
        title: 'Open Beta',
        content: 'Heroic AI RPG is now in Open Beta. Create worlds, forge characters, and embark on AI-driven adventures.'
    }
];

export default function LandingPage() {
    const [currentBg, setCurrentBg] = useState(0);

    // Rotate background every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentBg((prev) => (prev + 1) % BACKGROUNDS.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen flex flex-col relative overflow-y-auto bg-black">
            {/* Background Images with Cross-Fade */}
            <div className="fixed inset-0 z-0">
                {BACKGROUNDS.map((bg, index) => (
                    <div
                        key={bg}
                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${index === currentBg ? 'opacity-100' : 'opacity-0'
                            }`}
                        style={{ backgroundImage: `url('${bg}')` }}
                    />
                ))}
            </div>
            {/* Gradient Overlay for Readability */}
            <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90 pointer-events-none" />

            {/* Main Content Area */}
            <main className="relative z-10 flex-1 flex flex-col justify-between">

                {/* Hero Section (Centered) */}
                <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center min-h-[70vh]">
                    <h1 className="font-merriweather text-4xl md:text-6xl text-brand-text tracking-tight mb-2 drop-shadow-xl">
                        Heroic AI <span className="text-brand-accent">RPG</span>
                    </h1>
                    <p className="text-lg md:text-2xl text-brand-text-muted font-medium mb-10 tracking-widest uppercase drop-shadow-md">
                        Create, Play, Evolve
                    </p>

                    <Link
                        href="/sign-in"
                        className="bg-brand-accent hover:bg-brand-accent/80 text-black font-black text-lg py-4 px-10 rounded-full shadow-lg shadow-brand-accent/20 transition-all transform hover:scale-105"
                    >
                        Start Your Adventure
                    </Link>
                </div>

                {/* News Section */}
                <div className="w-full max-w-4xl mx-auto px-4 py-16 pb-24">
                    <h3 className="text-brand-accent font-bold mb-8 text-xl text-center md:text-left tracking-wide uppercase">
                        Recent Updates
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {NEWS_ITEMS.map((item, i) => (
                            <div
                                key={i}
                                className="bg-brand-surface/60 backdrop-blur-md p-6 rounded-2xl border border-brand-primary/30 hover:border-brand-primary/60 transition-colors"
                            >
                                <span className="text-xs text-brand-accent font-bold uppercase tracking-wider block mb-2">{item.date}</span>
                                <h4 className="text-brand-text font-bold text-lg mb-2">{item.title}</h4>
                                <p className="text-sm text-brand-text-muted leading-relaxed">{item.content}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <footer className="w-full bg-black/80 backdrop-blur-lg border-t border-white/5 py-8 mt-auto">
                    <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-brand-text-muted text-xs font-medium">
                            &copy; {new Date().getFullYear()} Heroic AI RPG. All rights reserved.
                        </div>
                        <div className="flex gap-6 text-xs font-medium">
                            <Link href="#" className="text-brand-text-muted hover:text-brand-accent transition-colors">
                                Privacy Policy
                            </Link>
                            <Link href="#" className="text-brand-text-muted hover:text-brand-accent transition-colors">
                                Terms of Service
                            </Link>
                            <Link href="#" className="text-brand-text-muted hover:text-brand-accent transition-colors">
                                Contact
                            </Link>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
