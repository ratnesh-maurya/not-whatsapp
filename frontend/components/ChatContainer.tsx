"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Paper, Typography, TextField, IconButton, Tabs, Tab, CircularProgress } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
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
    // State variables
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [activeTab, setActiveTab] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(true);
    const connectingRef = useRef(false);

    // Constants
    const MAX_RECONNECT_ATTEMPTS = 5;

    // Auth context
    const { token, user } = useAuth();

    // Connect to WebSocket
    const connectWebSocket = useCallback(() => {
        // Don't connect if already connecting
        if (connectingRef.current) {
            console.log('WebSocket connection already in progress');
            return;
        }

        // Don't connect if no auth
        if (!token || !user) {
            console.log('Missing authentication data');
            return;
        }

        // Check if max reconnect attempts reached
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
            return;
        }

        // Update state and attempt count
        setConnectionStatus('connecting');
        connectingRef.current = true;
        reconnectAttemptsRef.current++;
        console.log(`Starting connection attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);

        // Close existing connection if any
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch (err) {
                console.error('Error closing existing connection:', err);
            }
            wsRef.current = null;
        }

        // Create WebSocket URL
        let wsUrl = API_URL;
        if (wsUrl.startsWith('https://')) {
            wsUrl = wsUrl.replace('https://', 'wss://');
        } else if (wsUrl.startsWith('http://')) {
            wsUrl = wsUrl.replace('http://', 'ws://');
        }

        // Ensure WebSocket path
        if (!wsUrl.endsWith('/ws')) {
            wsUrl = `${wsUrl}/ws`;
        }

        // Add token
        wsUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;

        console.log('Connecting to WebSocket:', wsUrl);

        try {
            // Create WebSocket without specific protocol
            console.log('Creating basic WebSocket connection');
            const socket = new WebSocket(wsUrl);
            wsRef.current = socket;

            // Set binary type to arraybuffer
            socket.binaryType = 'arraybuffer';

            console.log('Created WebSocket object with URL:', wsUrl);
            console.log('Initial readyState:', socket.readyState);

            // Track readyState changes for debugging
            let oldReadyState = socket.readyState;
            const readyStateInterval = setInterval(() => {
                if (!wsRef.current) {
                    clearInterval(readyStateInterval);
                    return;
                }

                if (wsRef.current.readyState !== oldReadyState) {
                    console.log(`WebSocket readyState changed: ${oldReadyState} -> ${wsRef.current.readyState}`);
                    oldReadyState = wsRef.current.readyState;
                }
            }, 500);

            // Connection timeout
            const connectionTimeout = setTimeout(() => {
                if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
                    console.error('WebSocket connection timeout after 10 seconds');
                    connectingRef.current = false;
                    clearInterval(readyStateInterval);
                    socket.close();
                    setConnectionStatus('disconnected');
                }
            }, 10000);

            // Event handlers
            socket.onopen = () => {
                if (!isMountedRef.current) return;

                clearTimeout(connectionTimeout);
                console.log('WebSocket connected successfully!');
                console.log('Connection details:', {
                    readyState: socket.readyState,
                    protocol: socket.protocol || 'none',
                    extensions: socket.extensions || 'none',
                    url: socket.url
                });

                setConnectionStatus('connected');
                connectingRef.current = false;
                reconnectAttemptsRef.current = 0;

                // Set up ping interval to keep connection alive
                const pingInterval = setInterval(() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        try {
                            wsRef.current.send(JSON.stringify({
                                type: 'ping',
                                timestamp: new Date().toISOString()
                            }));
                            console.log('Ping sent to keep connection alive');
                        } catch (err) {
                            console.error('Error sending ping:', err);
                        }
                    } else {
                        clearInterval(pingInterval);
                    }
                }, 30000); // Send ping every 30 seconds

                // Send initial ping to verify connection
                try {
                    socket.send(JSON.stringify({
                        type: 'ping',
                        timestamp: new Date().toISOString()
                    }));
                    console.log('Initial ping sent successfully');
                } catch (err) {
                    console.error('Error sending initial ping:', err);
                }

                // Clear interval on unmount
                return () => {
                    clearInterval(pingInterval);
                };
            };

            socket.onclose = (event) => {
                if (!isMountedRef.current) return;

                clearTimeout(connectionTimeout);
                clearInterval(readyStateInterval);

                console.log(`WebSocket closed: ${event.code} ${event.reason || ''}`);
                console.log('Close event details:', {
                    wasClean: event.wasClean,
                    code: event.code,
                    reason: event.reason || 'No reason provided'
                });

                // Log detailed information about close codes
                if (event.code === 1000) {
                    console.log("Normal closure");
                } else if (event.code === 1001) {
                    console.log("Endpoint going away - browser tab closed or refreshed");
                } else if (event.code === 1002) {
                    console.log("Protocol error");
                } else if (event.code === 1003) {
                    console.log("Unsupported data");
                } else if (event.code === 1005) {
                    console.log("No status code");
                } else if (event.code === 1006) {
                    console.log("Abnormal closure - likely server unavailable or network issue");
                } else if (event.code === 1007) {
                    console.log("Invalid frame payload data");
                } else if (event.code === 1008) {
                    console.log("Policy violation");
                } else if (event.code === 1009) {
                    console.log("Message too big");
                } else if (event.code === 1010) {
                    console.log("Missing extension");
                } else if (event.code === 1011) {
                    console.log("Internal server error");
                } else if (event.code === 1015) {
                    console.log("TLS handshake failure");
                }

                setConnectionStatus('disconnected');
                connectingRef.current = false;

                // Don't attempt reconnect if this was a clean close with code 1000 or 1001
                if (event.wasClean || event.code === 1000 || event.code === 1001) {
                    console.log('Not reconnecting after clean close');
                    return;
                }

                // Clear any pending reconnect
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }

                // Attempt reconnect if not max attempts
                if (isMountedRef.current && token && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 15000);
                    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (isMountedRef.current) {
                            connectWebSocket();
                        }
                    }, delay);
                }
            };

            socket.onerror = (error) => {
                if (!isMountedRef.current) return;

                console.error('WebSocket error:', error);
                console.log('WebSocket readyState:', socket.readyState);
                console.log('Navigator online status:', navigator.onLine);

                // Attempt to get more error info
                if (error instanceof Event && error.target) {
                    const target = error.target as WebSocket;
                    console.log('WebSocket target info:', {
                        readyState: target.readyState,
                        protocol: target.protocol,
                        url: target.url
                    });
                }

                connectingRef.current = false;
                // No need to close - onclose will handle it
            };

            socket.onmessage = (event) => {
                if (!isMountedRef.current) return;

                try {
                    console.log('Raw message received:', event.data);

                    // Parse message data
                    let data;
                    try {
                        data = typeof event.data === 'string'
                            ? JSON.parse(event.data)
                            : JSON.parse(new TextDecoder().decode(event.data));

                        console.log('Parsed message:', data);
                    } catch (parseError) {
                        console.error('Error parsing message:', parseError);
                        console.log('Raw message content:', event.data);
                        return;
                    }

                    // Check if we have a valid message with a type
                    if (!data || typeof data !== 'object') {
                        console.warn('Received message is not an object:', data);
                        return;
                    }

                    if (!data.type) {
                        console.warn('Message has no type field:', data);
                        return;
                    }

                    // Handle message types
                    switch (data.type) {
                        case 'connected':
                            console.log('Connection confirmed by server:', data);

                            // Refresh messages for selected conversation
                            if (selectedConversation?.id) {
                                fetchMessages(selectedConversation.id);
                            }
                            break;

                        case 'message':
                            console.log('Received message from server:', data);
                            handleIncomingMessage(data);
                            break;

                        case 'pong':
                            console.log('Received pong from server');
                            break;

                        default:
                            console.warn('Unknown message type:', data.type);
                    }
                } catch (err) {
                    console.error('Error processing message:', err);
                    console.error('Original message:', event.data);
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            setConnectionStatus('disconnected');
            connectingRef.current = false;

            // Try to reconnect if not max attempts
            if (isMountedRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 15000);
                console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

                reconnectTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        connectWebSocket();
                    }
                }, delay);
            }
        }
    }, [token, user, API_URL]);

    // Handle incoming message
    const handleIncomingMessage = useCallback((message: any) => {
        console.log('Processing incoming message:', message);

        // Skip if no message ID
        if (!message.id) {
            console.warn('Invalid message - missing ID:', message);
            return;
        }

        // Extract sender info from message
        if (!message.sender) {
            console.warn('Invalid message - missing sender information:', message);
            return;
        }

        // Determine if the message is for the current user (sent or received)
        const isMessageForCurrentUser =
            (message.sender.id === user?.id) || // User is the sender
            (message.recipient_id === user?.id); // User is the recipient

        if (!isMessageForCurrentUser) {
            console.log('Message not relevant to current user, ignoring');
            return;
        }

        // Check if the message belongs to the currently selected conversation
        let isForCurrentConversation = false;

        if (selectedConversation) {
            if (message.conversation_id && message.conversation_id === selectedConversation.id) {
                // Direct match on conversation ID
                isForCurrentConversation = true;
            } else if (!message.conversation_id) {
                // Fallback to matching on participants for older messages
                const otherParticipant = selectedConversation.participants.find(p => p.id !== user?.id);
                if (otherParticipant &&
                    ((message.sender.id === user?.id && message.recipient_id === otherParticipant.id) ||
                        (message.recipient_id === user?.id && message.sender.id === otherParticipant.id))) {
                    isForCurrentConversation = true;
                }
            }
        }

        console.log('Is message for current conversation?', isForCurrentConversation);
        console.log('Current conversation ID:', selectedConversation?.id);
        console.log('Message conversation ID:', message.conversation_id);

        if (isForCurrentConversation) {
            // Add message to the current conversation
            setMessages(prev => {
                // Ensure prev is an array
                const currentMessages = Array.isArray(prev) ? [...prev] : [];

                // Remove temp message if this is a confirmed one
                const filtered = message.temp_id
                    ? currentMessages.filter(m => m.id !== message.temp_id)
                    : currentMessages;

                // Check for duplicates
                if (filtered.some(m => m.id === message.id)) {
                    console.log('Duplicate message, not adding:', message.id);
                    return filtered;
                }

                // Format new message for UI
                const newMessage: Message = {
                    id: message.id,
                    content: message.content,
                    sender: {
                        id: message.sender.id,
                        name: message.sender.name || 'Unknown User',
                        avatarUrl: message.sender.avatarUrl || ''
                    },
                    created_at: message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString()
                };

                console.log('Adding new message to UI:', newMessage);
                return [...filtered, newMessage];
            });
        } else if (message.conversation_id) {
            // This is a message for a different conversation
            console.log('Message is for another conversation, could show notification');
            // TODO: Implement notifications for messages in other conversations
        }
    }, [user, selectedConversation]);

    // Initialize WebSocket on mount
    useEffect(() => {
        isMountedRef.current = true;
        reconnectAttemptsRef.current = 0;
        connectingRef.current = false;

        // Test backend server connectivity first
        const testBackendConnectivity = async () => {
            try {
                console.log("Testing basic backend HTTP connectivity...");

                // First, test basic HTTP connectivity
                const httpEndpoint = `${API_URL}/api/v1/auth/google/login`;
                console.log(`Testing HTTP endpoint: ${httpEndpoint}`);

                const httpResponse = await fetch(httpEndpoint, {
                    method: 'HEAD'
                });

                console.log(`HTTP endpoint responded with status: ${httpResponse.status}`);

                // Next, test the authenticated endpoint
                console.log(`Testing authenticated endpoint: ${API_URL}/api/v1/users/me`);
                const response = await fetch(`${API_URL}/api/v1/users/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    console.log("Backend authenticated endpoint is reachable!");
                    const userData = await response.json();
                    console.log("User data retrieved:", userData);

                    // Now attempt WebSocket connection
                    if (token && user) {
                        console.log("Attempting WebSocket connection...");
                        connectWebSocket();
                    }
                } else {
                    console.error(`Backend authenticated endpoint responded with status: ${response.status}`);
                    if (response.status === 401) {
                        console.error("Authentication error - token might be invalid");
                    }
                }
            } catch (error) {
                console.error("Backend connectivity test failed:", error);
                console.log("Backend might be down or unreachable. Please check if the server is running.");
            }
        };

        if (token) {
            testBackendConnectivity();
        } else {
            // Skip connection during hot reloads if development
            const isHotReload = process.env.NODE_ENV === 'development' && performance.navigation.type === 0;

            // Connect if authenticated and not a hot reload
            if (token && user && !isHotReload) {
                connectWebSocket();
            }
        }

        // Cleanup on unmount
        return () => {
            isMountedRef.current = false;

            // Clear any reconnect timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }

            // Close WebSocket
            if (wsRef.current) {
                try {
                    wsRef.current.close(1000, 'Component unmounted');
                } catch (err) {
                    console.error('Error closing WebSocket:', err);
                }
                wsRef.current = null;
            }
        };
    }, [token, user, connectWebSocket, API_URL]);

    // Reset connection attempts when the token changes
    useEffect(() => {
        if (token && user) {
            // Reset connection attempts
            reconnectAttemptsRef.current = 0;
            console.log("Token or user changed, resetting connection attempts");

            // Only connect if we're not already connected
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                console.log("Need to establish a new connection");
                connectWebSocket();
            } else {
                console.log("Already connected, no need to reconnect");
            }
        } else {
            console.log("No token or user available, can't connect to WebSocket");
        }
    }, [token, user, connectWebSocket]);

    // Reset reconnection attempts counter when component mounts or remounts
    useEffect(() => {
        const resetConnectionAttempts = () => {
            reconnectAttemptsRef.current = 0;
        };

        window.addEventListener('online', resetConnectionAttempts);

        return () => {
            window.removeEventListener('online', resetConnectionAttempts);
        };
    }, []);

    // Fetch messages when conversation changes
    useEffect(() => {
        if (selectedConversation?.id) {
            console.log(`Selected conversation: ${selectedConversation.id}`);
            setMessages([]);
            fetchMessages(selectedConversation.id);
        }
    }, [selectedConversation]);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Fetch messages for a conversation
    const fetchMessages = async (conversationId: string) => {
        if (!token) return;

        try {
            console.log(`Fetching messages for conversation ${conversationId}`);
            const response = await fetch(`${API_URL}/api/v1/conversations/${conversationId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Received ${Array.isArray(data) ? data.length : 0} messages`);

            // Ensure data is array
            setMessages(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            setMessages([]);
        }
    };

    // Test function to check server connectivity - can be called from console with testServerConnectivity()
    (window as any).testServerConnectivity = async () => {
        console.log("Testing server connectivity...");

        // 1. Test public HTTP endpoint
        try {
            console.log(`Testing HTTP endpoint: ${API_URL}/api/v1/auth/google/login`);
            const httpResponse = await fetch(`${API_URL}/api/v1/auth/google/login`, {
                method: 'HEAD'
            });
            console.log(`Public endpoint responded with status: ${httpResponse.status}`);
        } catch (error) {
            console.error("Public endpoint test failed:", error);
        }

        // 2. Test WebSocket URL with plain HTTP
        try {
            let wsTestUrl = API_URL + "/ws";
            console.log(`Testing WebSocket URL as HTTP endpoint: ${wsTestUrl}`);
            const wsHttpResponse = await fetch(wsTestUrl, {
                method: 'HEAD'
            });
            console.log(`WebSocket URL HTTP test responded with status: ${wsHttpResponse.status}`);
        } catch (error) {
            console.error("WebSocket URL HTTP test failed:", error);
        }

        // 3. Check network status
        console.log("Network online status:", navigator.onLine);
    };

    // Send a message
    const handleSendMessage = () => {
        if (!wsRef.current || connectionStatus !== 'connected' || !selectedConversation || !newMessage.trim()) {
            console.log('Cannot send message:', {
                wsOpen: !!wsRef.current,
                connectionStatus,
                hasConversation: !!selectedConversation,
                messageLength: newMessage.trim().length
            });
            return;
        }

        try {
            // Create temp ID for optimistic update
            const tempId = `temp-${Date.now()}`;

            // Find recipient
            const recipientId = selectedConversation.participants.find(p => p.id !== user?.id)?.id;

            // Add temp message to UI immediately
            const tempMessage: Message = {
                id: tempId,
                content: newMessage,
                sender: {
                    id: user?.id || '',
                    name: user?.name || '',
                    avatarUrl: user?.avatarUrl || ''
                },
                created_at: new Date().toISOString()
            };

            // Optimistic update - add message to UI before server confirms
            setMessages(prev => [...(Array.isArray(prev) ? prev : []), tempMessage]);
            setNewMessage('');

            // Prepare message for server
            const messageObj = {
                type: 'message',
                content: newMessage,
                conversation_id: selectedConversation.id,
                recipient_id: recipientId,
                temp_id: tempId,
                timestamp: new Date().toISOString()
            };

            console.log('Sending message to server:', messageObj);

            // Send to server
            const messageJSON = JSON.stringify(messageObj);
            wsRef.current.send(messageJSON);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Select a conversation
    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedConversation(conversation);
    };

    // Start a new conversation with a user
    const handleSelectUser = async (selectedUser: any) => {
        if (!token || !user) return;

        try {
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
                throw new Error(`Failed to create conversation: ${response.status}`);
            }

            const conversation = await response.json();
            setSelectedConversation(conversation);
            setMessages([]);
            setActiveTab(0); // Switch to conversations tab
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    // Simple WebSocket test function - can be called from console with testWebSocketConnectivity()
    (window as any).testWebSocketConnectivity = () => {
        console.log("Testing WebSocket connectivity...");

        // 1. Check browser support
        if (!window.WebSocket) {
            console.error("Your browser doesn't support WebSockets!");
            return;
        }
        console.log("Browser supports WebSockets ✓");

        // 2. Create WebSocket URL
        let wsUrl = API_URL;
        if (wsUrl.startsWith('https://')) {
            wsUrl = wsUrl.replace('https://', 'wss://');
        } else if (wsUrl.startsWith('http://')) {
            wsUrl = wsUrl.replace('http://', 'ws://');
        }

        // Ensure WebSocket path
        if (!wsUrl.endsWith('/ws')) {
            wsUrl = `${wsUrl}/ws`;
        }

        // Add token
        wsUrl = `${wsUrl}?token=${encodeURIComponent(token || '')}`;

        console.log(`Connecting to: ${wsUrl}`);

        // 3. Create a minimal WebSocket connection
        try {
            const ws = new WebSocket(wsUrl);

            // Setup event listeners
            ws.onopen = () => {
                console.log("✅ WebSocket connection OPENED successfully!");
                console.log("ReadyState:", ws.readyState);

                // Send a ping message
                try {
                    ws.send(JSON.stringify({
                        type: "ping",
                        timestamp: new Date().toISOString()
                    }));
                    console.log("Ping message sent ✓");
                } catch (sendError) {
                    console.error("Error sending ping:", sendError);
                }
            };

            ws.onmessage = (evt) => {
                console.log("✅ Message received from server!");
                console.log("Raw data:", evt.data);

                try {
                    const data = JSON.parse(evt.data);
                    console.log("Parsed message:", data);
                    if (data.type === "pong") {
                        console.log("Received pong response - connection fully working! ✓");
                    }
                } catch (e) {
                    console.log("Couldn't parse message as JSON");
                }
            };

            ws.onerror = (evt) => {
                console.error("❌ WebSocket error:", evt);
            };

            ws.onclose = (evt) => {
                console.log(`WebSocket connection closed: Code ${evt.code}`);
                if (evt.code === 1006) {
                    console.error("❌ Abnormal closure - likely server unreachable or network issue");
                } else if (evt.wasClean) {
                    console.log("✓ Clean closure");
                }
            };

            // Close the test connection after 5 seconds
            setTimeout(() => {
                console.log("Test complete - closing connection");
                ws.close(1000, "Test complete");
            }, 5000);

        } catch (error) {
            console.error("❌ Error creating WebSocket:", error);
        }
    };

    return (
        <Box sx={{ display: 'flex', height: '100vh', p: 2, gap: 2 }}>
            {/* Sidebar */}
            <Box sx={{ width: '33%', height: '100%' }}>
                <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Connection status indicator */}
                    <Box sx={{
                        p: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: connectionStatus === 'connected' ? 'success.light' :
                            connectionStatus === 'connecting' ? 'warning.light' : 'error.light',
                        color: 'white',
                        fontSize: '0.75rem'
                    }}>
                        {connectionStatus === 'connecting' && <CircularProgress size={16} color="inherit" />}
                        {connectionStatus === 'connected' ? 'Connected' :
                            connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </Box>

                    {/* Tabs */}
                    <Tabs
                        value={activeTab}
                        onChange={(_, newValue) => setActiveTab(newValue)}
                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                    >
                        <Tab label="Conversations" />
                        <Tab label="Users" />
                    </Tabs>

                    {/* List content */}
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

            {/* Chat area */}
            <Box sx={{ flex: 1, height: '100%' }}>
                <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {selectedConversation ? (
                        <>
                            {/* Header */}
                            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                                <Typography variant="h6">
                                    {selectedConversation.participants.find(p => p.id !== user?.id)?.name || 'Chat'}
                                </Typography>
                            </Box>

                            {/* Messages */}
                            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                                {messages.map((message) => (
                                    <Box
                                        key={message.id}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: message.sender.id === user?.id ? 'flex-end' : 'flex-start',
                                            mb: 2
                                        }}
                                    >
                                        <Paper
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
                                                {message.created_at ? new Date(message.created_at).toLocaleString() : 'Just now'}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                ))}
                                <div ref={messagesEndRef} />
                            </Box>

                            {/* Message input */}
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
                                        disabled={connectionStatus !== 'connected'}
                                    />
                                    <IconButton
                                        color="primary"
                                        onClick={handleSendMessage}
                                        disabled={connectionStatus !== 'connected' || !newMessage.trim()}
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