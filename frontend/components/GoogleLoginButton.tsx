import React from 'react';
import { Button } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

interface GoogleLoginButtonProps {
    onClick: () => void;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onClick }) => {
    return (
        <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={onClick}
            sx={{
                backgroundColor: '#4285F4',
                color: 'white',
                '&:hover': {
                    backgroundColor: '#357ABD',
                },
                width: '100%',
                maxWidth: '300px',
                margin: '1rem 0',
            }}
        >
            Sign in with Google
        </Button>
    );
};

export default GoogleLoginButton; 