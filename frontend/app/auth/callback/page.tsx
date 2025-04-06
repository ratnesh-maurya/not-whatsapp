'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config';

export default function AuthCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setUser, setToken } = useAuth();
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    useEffect(() => {
        const handleCallback = async () => {
            console.log('Starting callback handling...');

            if (error) {
                console.error('Error in callback:', error);
                router.push(`/login?error=${error}`);
                return;
            }

            if (!token) {
                console.error('No token provided');
                router.push('/login?error=No token provided');
                return;
            }

            try {
                console.log('Storing token and user data...');

                // Store token
                localStorage.setItem('token', token);

                // Get user info from token
                const user = {
                    id: searchParams.get('id') || '',
                    email: searchParams.get('email') || '',
                    name: searchParams.get('name') || '',
                    avatarUrl: searchParams.get('avatarUrl') || '',
                };

                console.log('User data:', user);

                // Store user
                localStorage.setItem('user', JSON.stringify(user));

                // Update context
                setUser(user);
                setToken(token);

                console.log('Context updated, redirecting to chat...');

                // Redirect to chat page
                router.replace('/chat');
            } catch (err) {
                console.error('Authentication error:', err);
                router.push('/login?error=Authentication failed');
            }
        };

        handleCallback();
    }, [token, error, router, setUser, setToken, searchParams]);

    return (
        <div>
            <p>Authenticating...</p>
        </div>
    );
} 