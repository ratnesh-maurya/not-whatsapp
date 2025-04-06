import React, { useState } from 'react';
import { Box, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface ChatInputProps {
    onSendMessage: (content: string) => void;
    disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
    const [message, setMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                display: 'flex',
                gap: 1,
                p: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
            }}
        >
            <TextField
                fullWidth
                variant="outlined"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={disabled}
                size="small"
                sx={{
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                    },
                }}
            />
            <IconButton
                type="submit"
                color="primary"
                disabled={disabled || !message.trim()}
                sx={{
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                        backgroundColor: 'primary.dark',
                    },
                    '&:disabled': {
                        backgroundColor: 'action.disabledBackground',
                        color: 'action.disabled',
                    },
                }}
            >
                <SendIcon />
            </IconButton>
        </Box>
    );
};

export default ChatInput; 