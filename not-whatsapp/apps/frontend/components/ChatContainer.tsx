import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { encryption } from '@/utils/encryption';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

interface Message {
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
}

const ChatContainer: React.FC = () => {
    const { user, token } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isEncrypted, setIsEncrypted] = useState(false);
    const [recipientPublicKey, setRecipientPublicKey] = useState<string>('');
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!token) return;

        // Initialize WebSocket connection
        const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080', {
            auth: {
                token,
            },
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('message', (message: Message) => {
            setMessages((prev) => [...prev, message]);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, [token]);

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (content: string) => {
        if (!socketRef.current || !user) return;

        let encryptedContent = content;
        if (isEncrypted && recipientPublicKey) {
            encryption.setPublicKey(recipientPublicKey);
            encryptedContent = encryption.encryptMessage(content);
        }

        const message: Omit<Message, 'id' | 'timestamp'> = {
            content: encryptedContent,
            sender: {
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl,
                publicKey: user.publicKey || '',
            },
            encrypted: isEncrypted,
        };

        socketRef.current.emit('message', message);
    };

    const toggleEncryption = () => {
        setIsEncrypted(!isEncrypted);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                backgroundColor: 'background.default',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                }}
            >
                <Typography variant="h6">Chat</Typography>
                <Tooltip title={isEncrypted ? 'Disable encryption' : 'Enable encryption'}>
                    <IconButton
                        onClick={toggleEncryption}
                        color={isEncrypted ? 'primary' : 'default'}
                    >
                        {isEncrypted ? <LockIcon /> : <LockOpenIcon />}
                    </IconButton>
                </Tooltip>
            </Box>
            <Box
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}
            >
                {messages.map((message) => (
                    <ChatMessage
                        key={message.id}
                        message={message}
                        isOwnMessage={message.sender.id === user?.id}
                    />
                ))}
                <div ref={messagesEndRef} />
            </Box>
            <ChatInput
                onSendMessage={handleSendMessage}
                disabled={!isConnected}
            />
        </Box>
    );
};

export default ChatContainer; 