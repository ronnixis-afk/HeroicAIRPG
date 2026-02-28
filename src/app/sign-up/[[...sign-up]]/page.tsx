'use client';

import { SignUp } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function SignUpPage() {
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
            <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8">
                <div className="w-full max-w-md">
                    <div className="text-center mb-6">
                        <h1 className="font-merriweather text-brand-text mb-2">Create Account</h1>
                        <p className="text-body-sm text-brand-text-muted font-medium">Begin your heroic journey.</p>
                    </div>
                    <SignUp
                        appearance={{
                            baseTheme: dark,
                            variables: {
                                colorPrimary: '#3ecf8e',
                                colorBackground: '#1e1e1e',
                                colorInputBackground: '#333333',
                                colorInputText: '#f8f9fa',
                                colorText: '#f8f9fa',
                                colorTextSecondary: '#a1a1a1',
                                colorDanger: '#ef4444',
                                borderRadius: '0.75rem',
                                fontFamily: 'var(--font-inter), sans-serif',
                            },
                            elements: {
                                rootBox: 'w-full',
                                cardBox: 'w-full shadow-none',
                                card: 'backdrop-blur-xl border border-brand-primary/50 rounded-2xl shadow-2xl !bg-brand-surface/90',
                                headerTitle: 'hidden',
                                headerSubtitle: 'hidden',
                                socialButtonsBlockButton: '!bg-brand-primary/80 border border-brand-primary hover:!bg-brand-primary text-brand-text font-bold rounded-xl h-12 transition-all',
                                socialButtonsBlockButtonText: 'text-brand-text font-bold text-sm',
                                dividerLine: 'bg-brand-primary',
                                dividerText: 'text-brand-text-muted text-xs',
                                formFieldLabel: 'text-brand-text-muted text-xs font-bold',
                                formFieldInput: '!bg-brand-primary border-brand-surface text-brand-text rounded-xl h-12 font-bold text-sm',
                                formButtonPrimary: '!bg-brand-accent hover:!bg-brand-accent/80 !text-black font-black rounded-xl h-12 text-sm shadow-lg shadow-brand-accent/20 transition-all',
                                footerAction: 'hidden',
                                footer: 'hidden',
                                identityPreview: '!bg-brand-primary/50 border-brand-primary rounded-xl',
                                identityPreviewText: 'text-brand-text text-sm font-bold',
                                identityPreviewEditButton: 'text-brand-accent hover:text-brand-accent/80',
                                formFieldAction: 'text-brand-accent hover:text-brand-accent/80 text-xs font-bold',
                                alternativeMethodsBlockButton: '!bg-brand-primary/80 border border-brand-primary hover:!bg-brand-primary text-brand-text font-bold rounded-xl h-12',
                                otpCodeFieldInput: '!bg-brand-primary border-brand-surface text-brand-text rounded-lg',
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
                </div>
            </main>
        </div>
    );
}
