import React, { useEffect, useState } from 'react';
import { List, ListItem, ListItemAvatar, ListItemText, Avatar, Typography, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';

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

interface ConversationListProps {
    onSelectConversation: (conversation: Conversation) => void;
    selectedConversationId: string | null;
}

const ConversationList: React.FC<ConversationListProps> = ({ onSelectConversation, selectedConversationId }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { token } = useAuth();

    useEffect(() => {
        const fetchConversations = async () => {
            if (!token) {
                setError('Not authenticated');
                return;
            }

            console.log('Fetching conversations...');
            try {
                const response = await fetch(`${API_URL}/api/v1/conversations`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                console.log('Conversations response:', response.status);
                if (!response.ok) {
                    if (response.status === 401) {
                        setError('Session expired. Please login again.');
                        return;
                    }
                    throw new Error('Failed to fetch conversations');
                }

                const data = await response.json();
                console.log('Conversations data:', data);
                setConversations(data);
                setError(null);
            } catch (err) {
                console.error('Error fetching conversations:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [token]);

    if (loading) {
        return <Typography>Loading conversations...</Typography>;
    }

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <List>
            {conversations.map((conversation) => {
                const otherParticipant = conversation.participants.find(p => p.id !== conversation.last_message?.sender.id);
                return (
                    <ListItem
                        key={conversation.id}
                        onClick={() => onSelectConversation(conversation)}
                        component="div"
                        sx={{
                            cursor: 'pointer',
                            backgroundColor: conversation.id === selectedConversationId ? 'primary.light' : 'inherit',
                            '&:hover': {
                                backgroundColor: 'action.hover',
                            },
                        }}
                    >
                        <ListItemAvatar>
                            <Avatar src={otherParticipant?.avatarUrl}>
                                {otherParticipant?.name.charAt(0)}
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary={otherParticipant?.name || 'Unknown User'}
                            secondary={
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography
                                        component="span"
                                        variant="body2"
                                        color="text.secondary"
                                        noWrap
                                        sx={{ flex: 1 }}
                                    >
                                        {conversation.last_message?.content || 'No messages yet'}
                                    </Typography>
                                    <Typography
                                        component="span"
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {conversation.last_message?.created_at
                                            ? new Date(conversation.last_message.created_at).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })
                                            : ''}
                                    </Typography>
                                </Box>
                            }
                        />
                    </ListItem>
                );
            })}
        </List>
    );
};

export default ConversationList; 