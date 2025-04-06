'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';
import { useEffect, useState } from 'react';

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <ThemeProvider theme={theme}>
            {mounted && <CssBaseline />}
            {children}
        </ThemeProvider>
    );
} 