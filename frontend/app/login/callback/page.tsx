'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setUser, setToken } = useAuth();

    useEffect(() => {
        console.log('Login callback page mounted');
        console.log('Search params:', Object.fromEntries(searchParams.entries()));

        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
            console.error('Login error:', error);
            router.push('/login?error=' + error);
            return;
        }

        if (token) {
            console.log('Token found in URL parameters');
            const user = {
                id: searchParams.get('id') || '',
                email: searchParams.get('email') || '',
                name: searchParams.get('name') || '',
                avatarUrl: searchParams.get('avatarUrl') || '',
            };
            console.log('User data from URL:', user);

            // Store user and token
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('token', token);
            console.log('Stored user and token in localStorage');

            // Update context
            setUser(user);
            setToken(token);
            console.log('Updated auth context');

            // Redirect to chat page
            console.log('Redirecting to chat page...');
            router.push('/chat');
        } else {
            console.log('No token found, redirecting to login with error');
            router.push('/login?error=missing_token');
        }
    }, [router, searchParams, setUser, setToken]);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh'
        }}>
            <h2>Logging you in...</h2>
        </div>
    );
} 