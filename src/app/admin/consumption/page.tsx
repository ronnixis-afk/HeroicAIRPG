'use client';

import AdminConsumptionDashboard from '@/components/AdminConsumptionDashboard';
import { useUser } from '@clerk/nextjs';
import { resolveUserTier } from '@/lib/tierConfig';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

export default function AdminConsumptionPage() {
    const { user, isLoaded } = useUser();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        if (isLoaded) {
            if (!user) {
                setIsAuthorized(false);
                return;
            }
            
            // Fetch the authoritative tier from the server (which has access to SUPER_ADMIN_EMAILS)
            fetch('/api/user-tier')
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.tier) {
                        setIsAuthorized(data.tier === 'super_admin');
                    } else {
                        setIsAuthorized(false);
                    }
                })
                .catch(() => setIsAuthorized(false));
        }
    }, [isLoaded, user]);

    if (!isLoaded || isAuthorized === null) {
        return (
            <div className="min-h-screen bg-[#0c1114] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (isAuthorized === false) {
        return (
            <div className="min-h-screen bg-[#0c1114] flex flex-col items-center justify-center text-brand-text p-8 inter">
                <Icon name="status" className="w-16 h-16 text-red-500 mb-6 opacity-80" />
                <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
                <p className="text-brand-text-muted text-center max-w-md mb-8">
                    This scroll is restricted. Only High Archivists of the Order (Super Admins) may view the consumption logs.
                </p>
                <button 
                    onClick={() => window.location.href = '/'}
                    className="px-6 py-3 rounded-xl bg-brand-primary/10 border border-brand-primary/20 hover:bg-brand-primary/20 transition-all font-bold text-brand-accent tracking-wide"
                >
                    Return to the Outer Realms
                </button>
            </div>
        );
    }

    return <AdminConsumptionDashboard />;
}
