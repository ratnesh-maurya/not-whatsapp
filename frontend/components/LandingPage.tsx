"use client";

import { Box, Typography, Button } from '@mui/material';
import { signIn } from 'next-auth/react';
import { BackgroundBeams } from './ui/background-beams';
import { TextGenerateEffect } from './ui/text-generate-effect';
import { SparklesCore } from './ui/sparkles';

export default function LandingPage() {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: 'linear-gradient(to bottom, #000000, #1a1a1a)',
            }}
        >
            <BackgroundBeams />
            <SparklesCore />

            <Box
                sx={{
                    position: 'relative',
                    zIndex: 1,
                    textAlign: 'center',
                    padding: '2rem',
                    maxWidth: '800px',
                }}
            >
                <TextGenerateEffect
                    words="Welcome to Not WhatsApp"
                    className="text-4xl font-bold text-white mb-4"
                />

                <Typography
                    variant="h6"
                    sx={{
                        color: 'rgba(255, 255, 255, 0.8)',
                        marginBottom: '2rem',
                    }}
                >
                    A modern messaging experience
                </Typography>

                <Button
                    variant="contained"
                    size="large"
                    onClick={() => signIn('google')}
                    sx={{
                        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        '&:hover': {
                            background: 'linear-gradient(45deg, #1976D2 30%, #1E88E5 90%)',
                        },
                    }}
                >
                    Get Started with Google
                </Button>
            </Box>
        </Box>
    );
}

