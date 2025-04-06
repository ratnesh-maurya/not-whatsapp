'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Typography, Box } from '@mui/material';

export default function AuthErrorPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const error = searchParams.get('error') || 'Authentication failed';

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                p: 2,
            }}
        >
            <Typography variant="h4" component="h1" gutterBottom>
                Authentication Error
            </Typography>
            <Typography variant="body1" color="error" gutterBottom>
                {error}
            </Typography>
            <Button
                variant="contained"
                onClick={() => router.push('/login')}
            >
                Back to Login
            </Button>
        </Box>
    );
} 