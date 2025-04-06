import React from 'react';
import { Box, Typography, Avatar, Tooltip } from '@mui/material';
import { format } from 'date-fns';
import LockIcon from '@mui/icons-material/Lock';

interface ChatMessageProps {
    message: {
        id: string;
        content: string;
        sender: {
            id: string;
            name: string;
            avatarUrl: string;
            publicKey: string;
        };
        timestamp: string;
        encrypted: boolean;
    };
    isOwnMessage: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isOwnMessage }) => {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 1,
                mb: 2,
            }}
        >
            <Avatar
                src={message.sender.avatarUrl}
                alt={message.sender.name}
                sx={{ width: 32, height: 32 }}
            />
            <Box
                sx={{
                    maxWidth: '70%',
                    backgroundColor: isOwnMessage ? 'primary.main' : 'background.paper',
                    color: isOwnMessage ? 'white' : 'text.primary',
                    padding: 1.5,
                    borderRadius: 2,
                    boxShadow: 1,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2">
                        {message.content}
                    </Typography>
                    {message.encrypted && (
                        <Tooltip title="Encrypted message">
                            <LockIcon sx={{ fontSize: 16, color: isOwnMessage ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary' }} />
                        </Tooltip>
                    )}
                </Box>
                <Typography
                    variant="caption"
                    sx={{
                        color: isOwnMessage ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                        display: 'block',
                        textAlign: 'right',
                    }}
                >
                    {format(new Date(message.timestamp), 'HH:mm')}
                </Typography>
            </Box>
        </Box>
    );
};

export default ChatMessage; 