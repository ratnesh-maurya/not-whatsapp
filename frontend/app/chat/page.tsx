'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ChatContainer from '@/components/ChatContainer';

export default function ChatPage() {
    const { isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, router]);

    if (!isAuthenticated) {
        return null;
    }

    return <ChatContainer />;
} 