'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/config';

interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl: string;
    publicKey?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: () => void;
    logout: () => void;
    refreshToken: () => Promise<boolean>;
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                console.log('Initializing auth...');
                const storedUser = localStorage.getItem('user');
                const storedToken = localStorage.getItem('token');

                if (storedUser && storedToken) {
                    console.log('Found stored credentials, validating...');
                    try {
                        const response = await fetch(`${API_URL}/api/v1/users/me`, {
                            headers: {
                                'Authorization': `Bearer ${storedToken}`
                            }
                        });

                        if (response.ok) {
                            console.log('Token is valid');
                            const userData = await response.json();
                            setUser(userData);
                            setToken(storedToken);

                            // If we're on the login page, redirect to chat
                            if (window.location.pathname === '/login') {
                                console.log('Redirecting to chat from login page');
                                router.replace('/chat');
                            }
                        } else {
                            console.log('Token is invalid, clearing credentials');
                            localStorage.removeItem('user');
                            localStorage.removeItem('token');
                            setUser(null);
                            setToken(null);

                            // Only redirect to login if we're not already there and not on the home page
                            const allowedPaths = ['/login', '/auth/callback', '/'];
                            if (!allowedPaths.includes(window.location.pathname)) {
                                console.log('Redirecting to login due to invalid token');
                                router.replace('/login');
                            }
                        }
                    } catch (error) {
                        console.error('Error validating token:', error);
                        localStorage.removeItem('user');
                        localStorage.removeItem('token');
                        setUser(null);
                        setToken(null);
                        const allowedPaths = ['/login', '/auth/callback', '/'];
                        if (!allowedPaths.includes(window.location.pathname)) {
                            router.replace('/login');
                        }
                    }
                } else {
                    console.log('No stored credentials found');
                    setUser(null);
                    setToken(null);
                    const allowedPaths = ['/login', '/auth/callback', '/'];
                    if (!allowedPaths.includes(window.location.pathname)) {
                        console.log('Redirecting to login due to no credentials');
                        router.replace('/login');
                    }
                }
            } catch (error) {
                console.error('Error in auth initialization:', error);
            } finally {
                setIsInitialized(true);
            }
        };

        initializeAuth();
    }, [router]);

    useEffect(() => {
        if (user && token) {
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('token', token);
        }
    }, [user, token]);

    const login = () => {
        // Store current path for return after login
        if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            // Only store the path if it's the home page
            if (currentPath === '/') {
                localStorage.setItem('returnTo', currentPath);
            }
        }
        window.location.href = `${API_URL}/api/v1/auth/google/login`;
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
        router.replace('/login');
    };

    const refreshToken = async (): Promise<boolean> => {
        try {
            if (!token) return false;

            console.log('Refreshing user session...');
            const response = await fetch(`${API_URL}/api/v1/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                console.log('✅ Session refreshed successfully');
                const userData = await response.json();

                // Update user data if it's changed
                if (JSON.stringify(userData) !== JSON.stringify(user)) {
                    console.log('Updating user data with latest from server');
                    setUser(userData);
                }

                return true;
            } else {
                console.error('❌ Session refresh failed:', response.status);

                // Only clear credentials and redirect if response is 401 Unauthorized
                if (response.status === 401) {
                    console.log('Token expired, logging out');
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    setUser(null);
                    setToken(null);

                    // Only redirect if not already on login or home page
                    const allowedPaths = ['/login', '/auth/callback', '/'];
                    if (!allowedPaths.includes(window.location.pathname)) {
                        router.replace('/login');
                    }
                }

                return false;
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            return false;
        }
    };

    if (!isInitialized) {
        return <div>Loading...</div>;
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!user && !!token,
                login,
                logout,
                refreshToken,
                setUser,
                setToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 