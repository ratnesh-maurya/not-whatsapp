import React, { useEffect, useState, useRef } from 'react';
import { Box, Paper, Typography, TextField, IconButton, Tabs, Tab } from '@mui/material';
import { Send as SendIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import ConversationList from './ConversationList';
import UserList from './UserList';

interface Message {
    id: string;
    content: string;
    sender: {
        id: string;
        name: string;
        avatarUrl: string;
    };
    created_at: string;
}

interface Participant {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
}

interface Conversation {
    id: string;
    name: string;
    created_at: string;
    last_message: Message | null;
    participants: Participant[];
}

const ChatContainer: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [activeTab, setActiveTab] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { token, user } = useAuth();

    useEffect(() => {
        if (token && user) {
            const wsUrl = `${API_URL.replace('http', 'ws')}/ws?token=${token}`;
            console.log('Connecting to WebSocket:', wsUrl);
            const websocket = new WebSocket(wsUrl);

            websocket.onopen = () => {
                console.log('WebSocket connected');
                setWs(websocket);
            };

            websocket.onmessage = (event) => {
                console.log('Received WebSocket message:', event.data);
                const message = JSON.parse(event.data);
                if (message.type === 'pong') return;

                if (message.id && message.content && message.sender && message.sender.id) {
                    const timestamp = message.created_at instanceof Date
                        ? message.created_at.toISOString()
                        : message.created_at;

                    if (message.sender.id !== user.id) {
                        setMessages(prev => Array.isArray(prev) ? [...prev, {
                            ...message,
                            created_at: timestamp
                        }] : [{
                            ...message,
                            created_at: timestamp
                        }]);
                    }
                }
            };

            websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            websocket.onclose = () => {
                console.log('WebSocket disconnected');
                setWs(null);
            };

            return () => {
                websocket.close();
            };
        }
    }, [token, user]);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
        }
    }, [selectedConversation]);

    const fetchMessages = async (conversationId: string) => {
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/api/v1/conversations/${conversationId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }

            const data = await response.json();
            setMessages(data);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!ws || !selectedConversation || !newMessage.trim()) return;

        // Show message immediately in UI
        const immediateMessage = {
            id: Date.now().toString(),
            content: newMessage,
            sender: {
                id: user?.id || '',
                name: user?.name || '',
                avatarUrl: user?.avatarUrl || ''
            },
            created_at: new Date().toISOString()
        };

        // Ensure we're working with an array
        setMessages(prev => Array.isArray(prev) ? [...prev, immediateMessage] : [immediateMessage]);

        // Send message via WebSocket
        const message = {
            type: 'message',
            content: newMessage,
            conversation_id: selectedConversation.id,
            recipient_id: selectedConversation.participants.find(p => p.id !== user?.id)?.id
        };

        ws.send(JSON.stringify(message));
        setNewMessage('');
    };

    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedConversation(conversation);
        setMessages([]);
    };

    const handleSelectUser = async (selectedUser: any) => {
        if (!token || !user) return;

        try {
            // Create a new conversation
            const response = await fetch(`${API_URL}/api/v1/conversations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participant_ids: [selectedUser.id]
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create conversation');
            }

            const conversation = await response.json();
            setSelectedConversation(conversation);
            setMessages([]);
            setActiveTab(0); // Switch to conversations tab
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <Box sx={{ display: 'flex', height: '100vh', p: 2, gap: 2 }}>
            <Box sx={{ width: '33%', height: '100%' }}>
                <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Tabs
                        value={activeTab}
                        onChange={(_, newValue) => setActiveTab(newValue)}
                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                    >
                        <Tab label="Conversations" />
                        <Tab label="Users" />
                    </Tabs>
                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                        {activeTab === 0 ? (
                            <ConversationList
                                onSelectConversation={handleSelectConversation}
                                selectedConversationId={selectedConversation?.id || null}
                            />
                        ) : (
                            <UserList
                                onSelectUser={handleSelectUser}
                                selectedUserId={selectedConversation?.participants.find(p => p.id !== user?.id)?.id}
                            />
                        )}
                    </Box>
                </Paper>
            </Box>
            <Box sx={{ flex: 1, height: '100%' }}>
                <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {selectedConversation ? (
                        <>
                            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                                <Typography variant="h6">
                                    {selectedConversation.participants.find(p => p.id !== user?.id)?.name || 'Chat'}
                                </Typography>
                            </Box>
                            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                                {messages?.map((message) => (
                                    <Box
                                        key={message.id}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: message.sender.id === user?.id ? 'flex-end' : 'flex-start',
                                            mb: 2
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                maxWidth: '70%',
                                                bgcolor: message.sender.id === user?.id ? 'primary.main' : 'grey.100',
                                                color: message.sender.id === user?.id ? 'white' : 'text.primary',
                                                p: 2,
                                                borderRadius: 2
                                            }}
                                        >
                                            <Typography>{message.content}</Typography>
                                            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                                                {new Date(message.created_at).toLocaleString()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                                <div ref={messagesEndRef} />
                            </Box>
                            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                    <IconButton
                                        color="primary"
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim()}
                                    >
                                        <SendIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                        </>
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Typography color="text.secondary">
                                {activeTab === 0
                                    ? 'Select a conversation to start chatting'
                                    : 'Select a user to start a new conversation'}
                            </Typography>
                        </Box>
                    )}
                </Paper>
            </Box>
        </Box>
    );
};

export default ChatContainer; 