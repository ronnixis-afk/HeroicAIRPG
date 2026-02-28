'use client';

import { SignIn } from '@clerk/nextjs';

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

export default function SignInPage() {
    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden">
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('/login-bg.png')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

            {/* Header */}
            <header className="relative z-10 px-6 py-5">
                <h2 className="font-merriweather text-brand-text tracking-tight mb-0">
                    Heroic AI <span className="text-brand-accent">RPG</span>
                </h2>
            </header>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 px-4 pb-8">
                {/* Sign-In Card */}
                <div className="w-full max-w-md">
                    <div className="text-center mb-6">
                        <h1 className="font-merriweather text-brand-text mb-2">Welcome Back</h1>
                        <p className="text-body-sm text-brand-text-muted font-medium">Sign in to start your adventure.</p>
                    </div>
                    <SignIn
                        appearance={{
                            elements: {
                                rootBox: 'w-full',
                                cardBox: 'w-full shadow-none',
                                card: 'bg-brand-surface/90 backdrop-blur-xl border border-brand-primary/50 rounded-2xl shadow-2xl p-6',
                                headerTitle: 'hidden',
                                headerSubtitle: 'hidden',
                                socialButtonsBlockButton: 'bg-brand-primary/80 border border-brand-primary hover:bg-brand-primary text-brand-text font-bold rounded-xl h-12 transition-all',
                                socialButtonsBlockButtonText: 'text-brand-text font-bold text-sm',
                                dividerLine: 'bg-brand-primary',
                                dividerText: 'text-brand-text-muted text-xs',
                                formFieldLabel: 'text-brand-text-muted text-xs font-bold',
                                formFieldInput: 'bg-brand-primary border-brand-surface text-brand-text rounded-xl h-12 focus:ring-brand-accent focus:border-brand-accent font-bold text-sm',
                                formButtonPrimary: 'bg-brand-accent hover:bg-brand-accent/80 text-black font-black rounded-xl h-12 text-sm shadow-lg shadow-brand-accent/20 transition-all',
                                footerAction: 'hidden',
                                footer: 'hidden',
                                identityPreview: 'bg-brand-primary/50 border-brand-primary rounded-xl',
                                identityPreviewText: 'text-brand-text text-sm font-bold',
                                identityPreviewEditButton: 'text-brand-accent hover:text-brand-accent/80',
                                formFieldAction: 'text-brand-accent hover:text-brand-accent/80 text-xs font-bold',
                                alternativeMethodsBlockButton: 'bg-brand-primary/80 border border-brand-primary hover:bg-brand-primary text-brand-text font-bold rounded-xl h-12',
                                otpCodeFieldInput: 'bg-brand-primary border-brand-surface text-brand-text rounded-lg',
                                formHeaderTitle: 'text-brand-text font-merriweather',
                                formHeaderSubtitle: 'text-brand-text-muted text-sm',
                                backLink: 'text-brand-accent hover:text-brand-accent/80',
                                alertText: 'text-brand-danger text-xs',
                            },
                            layout: {
                                socialButtonsPlacement: 'top',
                                socialButtonsVariant: 'blockButton',
                            },
                        }}
                        forceRedirectUrl="/"
                    />
                    <p className="text-[10px] text-brand-text-muted/60 text-center mt-4 font-medium">
                        Heroic AI RPG is in Open Beta. You may experience bugs and unexpected behaviors.
                    </p>
                </div>

                {/* News & Updates Section */}
                <div className="w-full max-w-sm lg:max-w-xs">
                    <h4 className="text-brand-accent font-bold mb-4 text-sm">Recent Updates</h4>
                    <div className="space-y-3">
                        {NEWS_ITEMS.map((item, i) => (
                            <div
                                key={i}
                                className="bg-brand-surface/60 backdrop-blur-md p-4 rounded-xl border border-brand-primary/30"
                            >
                                <span className="text-[9px] text-brand-accent font-bold uppercase tracking-wider">{item.date}</span>
                                <h5 className="text-brand-text font-bold text-sm mt-1 mb-1">{item.title}</h5>
                                <p className="text-[11px] text-brand-text-muted leading-relaxed">{item.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
