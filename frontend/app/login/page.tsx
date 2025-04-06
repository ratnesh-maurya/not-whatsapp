'use client';

import React, { useEffect } from 'react';
import { Container, Typography, Box, Alert } from '@mui/material';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
    const { isAuthenticated, user, token, login } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const error = searchParams.get('error');

    useEffect(() => {
        if (isAuthenticated && user && token) {
            router.push('/chat');
        }
    }, [isAuthenticated, user, token, router]);

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Typography component="h1" variant="h4" sx={{ mb: 4 }}>
                    Welcome to NotWhatsApp
                </Typography>
                <Typography variant="body1" sx={{ mb: 4, textAlign: 'center' }}>
                    A sarcastically named, on-premises WhatsApp clone with end-to-end encryption.
                </Typography>
                {error && (
                    <Alert severity="error" sx={{ mb: 4, width: '100%' }}>
                        Login failed: {error}
                    </Alert>
                )}
                <GoogleLoginButton onClick={login} />
            </Box>
        </Container>
    );
} 