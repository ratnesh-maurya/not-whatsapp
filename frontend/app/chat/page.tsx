'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ChatContainer from '@/components/ChatContainer';

export default function ChatPage() {
    const { isAuthenticated, user, token } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated || !user || !token) {
            router.push('/login');
        }
    }, [isAuthenticated, user, token, router]);

    if (!isAuthenticated || !user || !token) {
        return null;
    }

    return <ChatContainer />;
} 