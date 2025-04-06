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
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Check for stored user and token
                const storedUser = localStorage.getItem('user');
                const storedToken = localStorage.getItem('token');

                if (storedUser && storedToken) {
                    // Validate the token by making a request to the backend
                    const response = await fetch(`${API_URL}/api/v1/users/me`, {
                        headers: {
                            'Authorization': `Bearer ${storedToken}`
                        }
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                        setToken(storedToken);
                        // If we're on the login page, redirect to chat
                        if (window.location.pathname === '/login') {
                            router.push('/chat');
                        }
                    } else {
                        // Token is invalid or expired
                        localStorage.removeItem('user');
                        localStorage.removeItem('token');
                        setUser(null);
                        setToken(null);
                        // Only redirect to login if we're not already there
                        if (window.location.pathname !== '/login') {
                            router.push('/login');
                        }
                    }
                } else {
                    // No stored credentials
                    setUser(null);
                    setToken(null);
                    // Only redirect to login if we're not already there and not on the callback page
                    if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
                        router.push('/login');
                    }
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
                setToken(null);
                // Only redirect to login if we're not already there and not on the callback page
                if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
                    router.push('/login');
                }
            }
        };

        initializeAuth();
    }, [router]);

    // Update localStorage when user or token changes
    useEffect(() => {
        if (user && token) {
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('token', token);
        }
    }, [user, token]);

    const login = () => {
        window.location.href = `${API_URL}/api/v1/auth/google/login`;
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!user && !!token,
                login,
                logout,
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