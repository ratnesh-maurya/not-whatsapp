'use client';

import React, { useEffect } from 'react';
import { Container, Typography, Box } from '@mui/material';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const { isAuthenticated, login } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

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
                <GoogleLoginButton onClick={login} />
            </Box>
        </Container>
    );
} 