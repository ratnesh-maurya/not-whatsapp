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

                            // Only redirect to login if we're not already there
                            if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
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
                        if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
                            router.replace('/login');
                        }
                    }
                } else {
                    console.log('No stored credentials found');
                    setUser(null);
                    setToken(null);
                    if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
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
        window.location.href = `${API_URL}/api/v1/auth/google/login`;
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
        router.replace('/login');
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