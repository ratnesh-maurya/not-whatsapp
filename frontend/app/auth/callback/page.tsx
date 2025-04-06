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
                console.log('Storing token and fetching user data...');

                // Store token
                localStorage.setItem('token', token);
                setToken(token);

                // Fetch user data
                const response = await fetch(`${API_URL}/api/v1/users/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user data');
                }

                const user = await response.json();
                console.log('User data:', user);

                // Store user
                localStorage.setItem('user', JSON.stringify(user));
                setUser(user);

                console.log('Context updated, redirecting to chat...');

                // Redirect to chat page
                router.replace('/chat');
            } catch (err) {
                console.error('Authentication error:', err);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                router.push('/login?error=Authentication failed');
            }
        };

        handleCallback();
    }, [token, error, router, setUser, setToken]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p className="text-lg">Authenticating...</p>
        </div>
    );
} 