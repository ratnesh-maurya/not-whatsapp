"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Paper, Typography, TextField, IconButton, Tabs, Tab, CircularProgress } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import ConversationList from './ConversationList';
import UserList from './UserList';
import ProfileSection from './ProfileSection';
import { createTheme, ThemeProvider } from '@mui/material/styles';

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
    const [darkMode, setDarkMode] = useState<boolean>(false);

    // Theme settings
    const theme = createTheme({
        palette: {
            mode: darkMode ? 'dark' : 'light',
            primary: {
                main: '#3b82f6',
            },
            secondary: {
                main: '#8b5cf6',
            },
            background: {
                default: darkMode ? '#0f172a' : '#f8fafc',
                paper: darkMode ? '#1e293b' : '#ffffff',
            },
        },
        shape: {
            borderRadius: 16,
        },
        typography: {
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            h6: {
                fontWeight: 600,
            }
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: darkMode ?
                            'linear-gradient(to bottom right, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.8))' :
                            'linear-gradient(to bottom right, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.9))',
                        backdropFilter: 'blur(10px)',
                        boxShadow: darkMode ?
                            '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)' :
                            '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                        border: darkMode ?
                            '1px solid rgba(255, 255, 255, 0.1)' :
                            '1px solid rgba(0, 0, 0, 0.05)',
                    }
                }
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                    }
                }
            }
        }
    });

    // Toggle dark mode
    const handleDarkModeToggle = (isDark: boolean) => {
        setDarkMode(isDark);
    };

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(true);
    const connectingRef = useRef(false);
    const prevSelectedConversationRef = useRef<Conversation | null>(null);

    // Constants
    const MAX_RECONNECT_ATTEMPTS = 5;

    // Auth context
    const { token, user, refreshToken } = useAuth();

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

            // Reset connection attempts if we're explicitly trying to connect
            if (!reconnectTimeoutRef.current) {
                reconnectAttemptsRef.current = 0;
            }

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

                            // If we can't send a ping, the connection might be dead
                            // Try to reconnect
                            console.log('Connection appears to be dead, attempting to reconnect...');
                            if (wsRef.current) {
                                try {
                                    wsRef.current.close();
                                } catch (closeErr) {
                                    console.error('Error closing dead connection:', closeErr);
                                }
                                wsRef.current = null;
                            }

                            // Reset connection attempts to ensure we can reconnect
                            reconnectAttemptsRef.current = 0;
                            connectWebSocket();

                            // Stop this ping interval as we're creating a new one in the reconnect
                            clearInterval(pingInterval);
                        }
                    } else {
                        console.warn('Cannot send ping - WebSocket not open. Current state:', wsRef.current?.readyState);
                        clearInterval(pingInterval);

                        // If the socket is closed or closing, attempt to reconnect
                        if (wsRef.current?.readyState === WebSocket.CLOSED || wsRef.current?.readyState === WebSocket.CLOSING) {
                            console.log('WebSocket is closed, attempting to reconnect...');
                            reconnectAttemptsRef.current = 0;
                            connectWebSocket();
                        }
                    }
                }, 15000); // Send ping every 15 seconds instead of 30

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

                // Check if we should try to refresh the auth token
                if (navigator.onLine && token) {
                    console.log('🔄 WebSocket error occurred, attempting to refresh auth session...');

                    // Try to refresh the token which may help with auth issues
                    refreshToken().then(success => {
                        if (success) {
                            console.log('✅ Auth refreshed successfully, attempting to reconnect WebSocket');
                            // Schedule reconnection attempt with fresh token
                            setTimeout(() => {
                                reconnectAttemptsRef.current = 0; // Reset reconnect attempts
                                connectWebSocket();
                            }, 1000);
                        } else {
                            console.error('❌ Auth refresh failed after WebSocket error');
                        }
                    });
                }

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
                            console.log('🔴 RECEIVED MESSAGE:', data);
                            console.log('🟡 Current user:', user?.id);
                            console.log('🟢 Selected conversation:', selectedConversation?.id);

                            // Check if message belongs to current conversation
                            const isForCurrentConversation =
                                selectedConversation &&
                                data.conversation_id === selectedConversation.id;

                            // Check if message is for current user
                            const isForCurrentUser =
                                (data.sender.id === user?.id) || // User is sender
                                (data.recipient_id === user?.id); // User is recipient

                            console.log('Message routing:', {
                                isForCurrentConversation,
                                isForCurrentUser,
                                conversation: data.conversation_id,
                                selectedConversation: selectedConversation?.id,
                                prevConversationId: prevSelectedConversationRef.current?.id
                            });

                            // If we lost the selected conversation but this message is for our previous conversation,
                            // trigger the restoration immediately
                            if (!selectedConversation &&
                                prevSelectedConversationRef.current &&
                                data.conversation_id === prevSelectedConversationRef.current.id &&
                                isForCurrentUser) {
                                console.log('🔄 Received message for our lost conversation, restoring...');
                                const conversationId = prevSelectedConversationRef.current.id;
                                // Fetch the conversation
                                (async () => {
                                    try {
                                        const response = await fetch(`${API_URL}/api/v1/conversations/${conversationId}`, {
                                            headers: {
                                                'Authorization': `Bearer ${token}`
                                            }
                                        });

                                        if (response.ok) {
                                            let conversation = await response.json();
                                            console.log('✅ Restored conversation from message event:', conversation);

                                            // Ensure the conversation has valid participants
                                            if (!conversation.participants || !Array.isArray(conversation.participants) || conversation.participants.length === 0) {
                                                console.log('⚠️ Restored conversation missing participants, ensuring they exist');

                                                // Get reference participants from the previous conversation
                                                if (prevSelectedConversationRef.current?.participants) {
                                                    conversation.participants = [...prevSelectedConversationRef.current.participants];
                                                    console.log('✅ Added participants from previous conversation reference');
                                                } else if (user) {
                                                    // If we don't have participants, create at least one with the current user
                                                    conversation.participants = [{
                                                        id: user.id,
                                                        name: user.name,
                                                        email: user.email || '',
                                                        avatarUrl: user.avatarUrl || ''
                                                    }];
                                                    console.log('✅ Added current user as participant');
                                                }
                                            }

                                            // Sanity check the conversation object before setting
                                            if (!conversation.participants || !Array.isArray(conversation.participants)) {
                                                console.error('❌ Failed to ensure participants in conversation, creating minimal valid object');
                                                // Force a minimal valid conversation object
                                                conversation = {
                                                    ...conversation,
                                                    participants: user ? [{
                                                        id: user.id,
                                                        name: user.name,
                                                        email: user.email || '',
                                                        avatarUrl: user.avatarUrl || ''
                                                    }] : []
                                                };
                                            }

                                            setSelectedConversation(conversation);

                                            // We need to refetch messages after restoring the conversation
                                            setTimeout(() => {
                                                if (conversation.id) {
                                                    fetchMessages(conversation.id);
                                                }
                                            }, 100);
                                        }
                                    } catch (error) {
                                        console.error('Error restoring conversation:', error);
                                    }
                                })();

                                // Abort further message processing as we're now restoring
                                return;
                            }

                            // Only process messages for current user and conversation
                            if (isForCurrentUser && isForCurrentConversation) {
                                console.log('✅ Processing message for current conversation');
                                debugConversationData('BEFORE PROCESSING MESSAGE', selectedConversation);

                                // Verify selected conversation has participants
                                if (!selectedConversation?.participants || !Array.isArray(selectedConversation.participants)) {
                                    console.error('❌ Cannot add message - selected conversation has no valid participants');

                                    // Try to refresh the conversation data
                                    if (selectedConversation?.id && token) {
                                        console.log('🔄 Attempting to refresh conversation data...');
                                        fetch(`${API_URL}/api/v1/conversations/${selectedConversation.id}`, {
                                            headers: {
                                                'Authorization': `Bearer ${token}`
                                            }
                                        })
                                            .then(response => response.ok ? response.json() : null)
                                            .then(data => {
                                                if (data && data.participants && Array.isArray(data.participants)) {
                                                    console.log('✅ Refreshed conversation data with valid participants');
                                                    setSelectedConversation(data);
                                                }
                                            })
                                            .catch(err => console.error('❌ Error refreshing conversation:', err));
                                    }
                                    return;
                                }

                                setMessages(prevMessages => {
                                    // First check if we already have this message
                                    if (prevMessages.some(m => m.id === data.id)) {
                                        console.log('⚠️ Message already exists in state, not adding duplicate');
                                        return prevMessages;
                                    }

                                    // Remove temp message if this is a confirmed one
                                    const filtered = data.temp_id
                                        ? prevMessages.filter(m => m.id !== data.temp_id)
                                        : prevMessages;

                                    // Format new message for UI
                                    const newMessage: Message = {
                                        id: data.id,
                                        content: data.content,
                                        sender: {
                                            id: data.sender.id,
                                            name: data.sender.name || 'Unknown User',
                                            avatarUrl: data.sender.avatarUrl || ''
                                        },
                                        created_at: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString()
                                    };

                                    console.log('✅ Adding message to UI:', newMessage);
                                    return [...filtered, newMessage];
                                });

                                // Ensure we scroll to bottom after the update
                                setTimeout(() => {
                                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                            } else {
                                console.log('⚠️ Message is not for current conversation or user');

                                // Only refresh conversations if this message is for the current user
                                if (isForCurrentUser && activeTab === 0) {
                                    console.log('🔄 Refreshing conversation list due to message in another conversation');

                                    // If no conversation is selected, automatically select this one
                                    if (!selectedConversation && data.conversation_id) {
                                        console.log('🔀 No conversation selected, fetching this one: ' + data.conversation_id);

                                        // Fetch the conversation by ID
                                        (async () => {
                                            try {
                                                const response = await fetch(`${API_URL}/api/v1/conversations/${data.conversation_id}`, {
                                                    headers: {
                                                        'Authorization': `Bearer ${token}`
                                                    }
                                                });

                                                if (response.ok) {
                                                    const conversation = await response.json();
                                                    console.log('✅ Automatically selecting conversation:', conversation);
                                                    setSelectedConversation(conversation);

                                                    // Prevent any further changes to the selected conversation 
                                                    // while this is being processed
                                                    return;
                                                }
                                            } catch (error) {
                                                console.error('❌ Error fetching conversation:', error);
                                            }
                                        })();
                                    }

                                    // Use a small delay to avoid excessive refreshes
                                    setTimeout(() => {
                                        // This will trigger the ConversationList component to refresh
                                        const event = new CustomEvent('refreshConversations');
                                        window.dispatchEvent(event);
                                    }, 500);
                                }
                            }

                            // Play notification sound if user is recipient
                            if (data.recipient_id === user?.id && data.sender?.id !== user?.id) {
                                console.log('🔔 New message notification for:', data.sender?.name);

                                // If browser supports notifications and we have permission
                                if (Notification && Notification.permission === "granted" && document.hidden) {
                                    new Notification(`Message from ${data.sender?.name}`, {
                                        body: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''),
                                        icon: data.sender?.avatarUrl || '/logo.png'
                                    });
                                }
                            }
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

    // Initialize
    useEffect(() => {
        // Request notification permission
        if (Notification && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }

        isMountedRef.current = true;
        reconnectAttemptsRef.current = 0;
        connectingRef.current = false;

        // Set up network status monitoring for reconnection
        const handleNetworkChange = () => {
            console.log('🌐 Network status changed. Online:', navigator.onLine);
            if (navigator.onLine) {
                console.log('🔄 Network is back online, attempting reconnection...');
                reconnectAttemptsRef.current = 0; // Reset reconnect attempts
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                    connectWebSocket();
                }
            }
        };

        window.addEventListener('online', handleNetworkChange);

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

            // Clean up event listeners
            window.removeEventListener('online', handleNetworkChange);

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
            console.log(`🔍 Selected conversation changed to: ${selectedConversation.id}`);
            console.log('Conversation details:', selectedConversation);
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
            console.log(`📥 Fetching messages for conversation ${conversationId}`);
            const response = await fetch(`${API_URL}/api/v1/conversations/${conversationId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }

            const data = await response.json();
            console.log(`📬 Received ${Array.isArray(data) ? data.length : 0} messages from API`);

            if (Array.isArray(data)) {
                console.log('Message preview:', data.slice(0, 2));
            }

            // Only replace messages if this is the first load, otherwise merge
            setMessages(prevMessages => {
                // If no previous messages, or we're changing conversations, use the new data
                if (prevMessages.length === 0) {
                    return Array.isArray(data) ? data : [];
                }

                // Otherwise, merge new messages with existing ones
                const existingIds = new Set(prevMessages.map(m => m.id));
                const newMessages = (Array.isArray(data) ? data : []).filter(
                    message => !existingIds.has(message.id)
                );

                if (newMessages.length > 0) {
                    console.log(`📩 Adding ${newMessages.length} new messages to the UI`);
                    return [...prevMessages, ...newMessages];
                }

                // No new messages found
                return prevMessages;
            });

            // Scroll to bottom after loading messages
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 200);
        } catch (error) {
            console.error('Error fetching messages:', error);
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

    // Ensure the conversation data is preserved after sending messages
    const preserveConversationData = (conversationId: string) => {
        if (!token || !conversationId) return;

        console.log('🔄 Preserving conversation data for:', conversationId);

        // First check if current conversation has valid participants
        if (selectedConversation?.participants && Array.isArray(selectedConversation.participants) && selectedConversation.participants.length > 0) {
            console.log('✅ Current conversation has valid participants, making backup before refresh');
            // Make a backup of the current participants
            const backupParticipants = [...selectedConversation.participants];

            fetch(`${API_URL}/api/v1/conversations/${conversationId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch conversation: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && selectedConversation?.id === conversationId) {
                        console.log('✅ Refreshing conversation data to preserve participant info');

                        // Check if the response has valid participants, if not use backup
                        if (!data.participants || !Array.isArray(data.participants) || data.participants.length === 0) {
                            console.log('⚠️ Server returned conversation without valid participants, using backup');
                            data.participants = backupParticipants;
                        }

                        debugConversationData('BEFORE UPDATE', selectedConversation);
                        debugConversationData('NEW DATA', data);

                        // Update conversation data while preserving important information
                        setSelectedConversation(prevConversation => {
                            if (!prevConversation) return data;
                            return {
                                ...data
                            };
                        });
                    }
                })
                .catch(err => {
                    console.error('❌ Error preserving conversation data:', err);
                });
        } else {
            // If we don't have valid participants, we need to get them from the server
            console.log('⚠️ Current conversation missing participants, fetching full data');
            fetch(`${API_URL}/api/v1/conversations/${conversationId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch conversation: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && selectedConversation?.id === conversationId) {
                        // If server response doesn't have participants, try to construct them
                        if (!data.participants || !Array.isArray(data.participants) || data.participants.length === 0) {
                            console.log('⚠️ Server returned conversation without participants, attempting to reconstruct');

                            // Create a basic participant entry for the current user
                            if (user) {
                                data.participants = [
                                    {
                                        id: user.id,
                                        name: user.name,
                                        email: user.email,
                                        avatarUrl: user.avatarUrl
                                    }
                                ];
                            }
                        }

                        console.log('✅ Setting conversation with complete data');
                        setSelectedConversation(data);
                    }
                })
                .catch(err => {
                    console.error('❌ Error fetching complete conversation data:', err);
                });
        }
    };

    // Send a message
    const handleSendMessage = () => {
        // Check connection status and WebSocket readiness
        if (!wsRef.current) {
            console.error('❌ WebSocket connection not established');
            // Attempt to reconnect
            connectWebSocket();
            return;
        }

        if (wsRef.current.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket not connected! Current state:', wsRef.current.readyState);

            // If closed or closing, attempt to reconnect
            if (wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING) {
                console.log('Attempting to reconnect WebSocket...');
                connectWebSocket();
            }
            return;
        }

        if (!selectedConversation) {
            console.error('❌ No conversation selected!');
            return;
        }

        // Add defensive check for undefined participants
        if (!selectedConversation.participants) {
            console.error('❌ Conversation has no participants (undefined)');
            // Attempt to refresh the conversation data
            if (token) {
                console.log('🔄 Attempting to refresh conversation data...');
                fetch(`${API_URL}/api/v1/conversations/${selectedConversation.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                    .then(response => {
                        if (response.ok) return response.json();
                        throw new Error(`Failed to refresh conversation: ${response.status}`);
                    })
                    .then(data => {
                        console.log('✅ Refreshed conversation data:', data);
                        setSelectedConversation(data);
                    })
                    .catch(err => {
                        console.error('❌ Error refreshing conversation:', err);
                    });
            }
            return;
        }

        if (!Array.isArray(selectedConversation.participants) || selectedConversation.participants.length < 1) {
            console.error('❌ Conversation has invalid participants array:', selectedConversation.participants);
            return;
        }

        // Find recipient - either the other participant or self if solo conversation
        const recipientId = selectedConversation.participants.length > 1
            ? selectedConversation.participants.find(p => p.id !== user?.id)?.id
            : selectedConversation.participants[0]?.id;

        if (!recipientId) {
            console.error('❌ Cannot find recipient in conversation participants:', selectedConversation.participants);
            return;
        }

        if (!newMessage.trim()) {
            console.log('❌ Cannot send empty message');
            return;
        }

        console.log('💬 Sending message:', {
            conversation: selectedConversation.id,
            wsOpen: wsRef.current?.readyState === WebSocket.OPEN,
            connectionStatus,
            messageLength: newMessage.trim().length
        });

        try {
            // Create temp ID for optimistic update
            const tempId = `temp-${Date.now()}`;

            console.log(`📤 Sending message to recipient: ${recipientId}`);

            // Add temp message to UI immediately (optimistic update)
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

            // Update UI with optimistic message
            setMessages(prev => [...(Array.isArray(prev) ? prev : []), tempMessage]);
            setNewMessage(''); // Clear input field

            // Ensure we scroll to bottom after adding message
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);

            // Prepare message for server
            const messageObj = {
                type: 'message',
                content: newMessage,
                conversation_id: selectedConversation.id,
                recipient_id: recipientId,
                temp_id: tempId,
                timestamp: new Date().toISOString()
            };

            console.log('📤 Sending message to server:', messageObj);

            // Send to server
            const messageJSON = JSON.stringify(messageObj);
            wsRef.current.send(messageJSON);

            console.log('✅ Message sent successfully');

            // Preserve conversation data after sending to prevent UI issues
            preserveConversationData(selectedConversation.id);
        } catch (error) {
            console.error('❌ Error sending message:', error);
            // Provide visual feedback that sending failed
            // You could add a UI toast notification here
        }
    };

    // Debug function to help identify participant data issues
    const debugConversationData = (label: string, conversation: any) => {
        if (!conversation) {
            console.log(`🔍 DEBUG ${label}: No conversation data available`);
            return;
        }

        console.log(`🔍 DEBUG ${label}:`, {
            id: conversation.id,
            name: conversation.name,
            participantsArray: Array.isArray(conversation.participants),
            participantsLength: conversation.participants ? conversation.participants.length : 0,
            participants: conversation.participants,
            currentUser: user?.id,
            otherParticipant: conversation.participants?.find((p: Participant) => p.id !== user?.id),
        });
    };

    // Select a conversation
    const handleSelectConversation = (conversation: Conversation) => {
        console.log('🔄 Selecting conversation:', conversation.id);
        debugConversationData('BEFORE SELECTION', conversation);

        // Validate conversation has participants before setting
        if (!conversation.participants || !Array.isArray(conversation.participants)) {
            console.error('⚠️ Conversation has invalid participants data, attempting to fetch complete data...');

            // Fetch full conversation data to ensure we have participants
            if (token) {
                fetch(`${API_URL}/api/v1/conversations/${conversation.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                    .then(response => {
                        if (response.ok) return response.json();
                        throw new Error(`Failed to fetch complete conversation: ${response.status}`);
                    })
                    .then(data => {
                        if (!data.participants || !Array.isArray(data.participants)) {
                            console.error('❌ Server returned conversation without valid participants:', data);
                            return;
                        }
                        console.log('✅ Fetched complete conversation data:', data);
                        setMessages([]);
                        setSelectedConversation(data);
                    })
                    .catch(err => {
                        console.error('❌ Error fetching complete conversation:', err);
                    });
            }
            return;
        }

        console.log('Conversation participants:', conversation.participants);

        // Clear messages before loading new ones
        setMessages([]);
        setSelectedConversation(conversation);
    };

    // Start a new conversation with a user
    const handleSelectUser = async (selectedUser: any) => {
        if (!token || !user) return;

        try {
            console.log('Creating conversation with user:', selectedUser);

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
            console.log('📱 Created conversation:', conversation);

            // Validate the conversation has participants before setting it
            if (!conversation.participants || !Array.isArray(conversation.participants)) {
                console.error('❌ Server returned conversation without participants, adding them manually');

                // Create a complete conversation object with participants
                const completeConversation = {
                    ...conversation,
                    participants: [
                        // Add current user as participant
                        {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            avatarUrl: user.avatarUrl
                        },
                        // Add selected user as participant
                        {
                            id: selectedUser.id,
                            name: selectedUser.name,
                            email: selectedUser.email,
                            avatarUrl: selectedUser.avatarUrl
                        }
                    ]
                };

                console.log('📱 Using complete conversation data:', completeConversation);
                setSelectedConversation(completeConversation);
            } else {
                console.log('📱 Conversation has valid participants');
                setSelectedConversation(conversation);
            }

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

    // Add a periodic message refresh for when WebSocket fails to deliver
    useEffect(() => {
        if (!selectedConversation?.id || !token) return;

        // Set up a timer to periodically check for new messages
        const interval = setInterval(() => {
            if (connectionStatus === 'connected') {
                console.log('🔄 Periodically checking for new messages in conversation:', selectedConversation.id);
                fetchMessages(selectedConversation.id);
            }
        }, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [selectedConversation?.id, token, connectionStatus]);

    // Keep auth session alive
    useEffect(() => {
        if (!token) return;

        // Set up a timer to periodically refresh auth session
        const interval = setInterval(async () => {
            console.log('🔄 Refreshing authentication session...');

            // Use the refreshToken method from AuthContext
            const refreshSuccess = await refreshToken();

            if (refreshSuccess) {
                console.log('✅ Session refresh successful');

                // Check WebSocket connection
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                    console.log('⚠️ WebSocket not connected during session refresh, reconnecting...');
                    reconnectAttemptsRef.current = 0; // Reset reconnect attempts
                    connectWebSocket();
                }
            } else {
                console.error('❌ Session refresh failed');
            }
        }, 60000); // Refresh every 60 seconds

        return () => clearInterval(interval);
    }, [token, refreshToken, connectWebSocket]);

    // After getting a conversation from the server, add the debug call
    useEffect(() => {
        if (selectedConversation) {
            debugConversationData('AFTER SET SELECTED CONVERSATION', selectedConversation);
        }
    }, [selectedConversation]);

    // Restore selected conversation if lost
    useEffect(() => {
        // If we suddenly lose our selected conversation, try to restore it
        const handleRestoreSelectedConversation = async () => {
            if (!selectedConversation && prevSelectedConversationRef.current && token) {
                console.log('🚨 Selected conversation was lost! Attempting to restore:', prevSelectedConversationRef.current.id);

                try {
                    // Fetch conversation data from server
                    const response = await fetch(`${API_URL}/api/v1/conversations/${prevSelectedConversationRef.current.id}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        let data = await response.json();
                        console.log('✅ Successfully restored selected conversation data:', data);

                        // Ensure the conversation has valid participants
                        if (!data.participants || !Array.isArray(data.participants) || data.participants.length === 0) {
                            console.log('⚠️ Restored conversation missing participants, ensuring they exist');

                            // Get reference participants from the previous conversation
                            if (prevSelectedConversationRef.current?.participants) {
                                data.participants = [...prevSelectedConversationRef.current.participants];
                                console.log('✅ Added participants from previous conversation reference');
                            } else if (user) {
                                // If we don't have participants, create at least one with the current user
                                data.participants = [{
                                    id: user.id,
                                    name: user.name,
                                    email: user.email || '',
                                    avatarUrl: user.avatarUrl || ''
                                }];
                                console.log('✅ Added current user as participant');
                            }
                        }

                        // Final sanity check before setting
                        if (!data.participants || !Array.isArray(data.participants)) {
                            console.error('❌ Failed to ensure participants in conversation, creating minimal valid object');
                            // Force a minimal valid conversation object
                            data = {
                                ...data,
                                participants: user ? [{
                                    id: user.id,
                                    name: user.name,
                                    email: user.email || '',
                                    avatarUrl: user.avatarUrl || ''
                                }] : []
                            };
                        }

                        setSelectedConversation(data);
                    }
                } catch (error) {
                    console.error('❌ Failed to restore conversation:', error);
                }
            }
        };

        handleRestoreSelectedConversation();
    }, [selectedConversation, token, API_URL]);

    useEffect(() => {
        if (selectedConversation) {
            // Store reference to current conversation
            prevSelectedConversationRef.current = selectedConversation;
        }
    }, [selectedConversation]);

    return (
        <ThemeProvider theme={theme}>
            <Box sx={{
                display: 'flex',
                height: '100vh',
                p: 2,
                gap: 2,
                background: darkMode ?
                    'radial-gradient(circle at top right, #1e40af, #0f172a)' :
                    'radial-gradient(circle at top right, #dbeafe, #f8fafc)',
                transition: 'background 0.5s ease',
            }}>
                {/* Sidebar */}
                <Box sx={{
                    width: '33%',
                    height: '100%',
                    transition: 'all 0.3s ease',
                }}>
                    <Paper sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '5px',
                            background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                            zIndex: 1,
                        },
                    }}>
                        {/* Profile section at the top of sidebar */}
                        <ProfileSection onDarkModeToggle={handleDarkModeToggle} darkMode={darkMode} />

                        {/* Connection status indicator */}
                        <Box sx={{
                            p: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            background: connectionStatus === 'connected' ?
                                'linear-gradient(90deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.2) 100%)' :
                                connectionStatus === 'connecting' ?
                                    'linear-gradient(90deg, rgba(234,179,8,0.1) 0%, rgba(234,179,8,0.2) 100%)' :
                                    'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.2) 100%)',
                            color: connectionStatus === 'connected' ?
                                '#22c55e' :
                                connectionStatus === 'connecting' ?
                                    '#eab308' :
                                    '#ef4444',
                            fontSize: '0.75rem',
                            transition: 'all 0.3s ease',
                            borderBottom: '1px solid rgba(100, 116, 139, 0.1)',
                        }}>
                            {connectionStatus === 'connecting' && (
                                <Box sx={{
                                    display: 'inline-block',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    bgcolor: '#eab308',
                                    animation: 'pulse 1.5s infinite',
                                    mr: 1
                                }} />
                            )}
                            {connectionStatus === 'connected' && (
                                <Box sx={{
                                    display: 'inline-block',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    bgcolor: '#22c55e',
                                    mr: 1
                                }} />
                            )}
                            {connectionStatus === 'disconnected' && (
                                <Box sx={{
                                    display: 'inline-block',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    bgcolor: '#ef4444',
                                    mr: 1
                                }} />
                            )}
                            {connectionStatus === 'connected' ? 'Connected' :
                                connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                        </Box>

                        {/* Tabs */}
                        <Tabs
                            value={activeTab}
                            onChange={(_, newValue) => setActiveTab(newValue)}
                            sx={{
                                borderBottom: '1px solid rgba(100, 116, 139, 0.1)',
                                '& .MuiTabs-indicator': {
                                    background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                                    height: '3px',
                                }
                            }}
                            TabIndicatorProps={{
                                children: <span className="MuiTabs-indicatorSpan" />
                            }}
                        >
                            <Tab label="Conversations" sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                transition: 'all 0.2s ease',
                                opacity: activeTab === 0 ? 1 : 0.7,
                            }} />
                            <Tab label="Users" sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                transition: 'all 0.2s ease',
                                opacity: activeTab === 1 ? 1 : 0.7,
                            }} />
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
                                    selectedUserId={selectedConversation?.participants?.find(p => p.id !== user?.id)?.id}
                                />
                            )}
                        </Box>
                    </Paper>
                </Box>

                {/* Chat area */}
                <Box sx={{
                    flex: 1,
                    height: '100%',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                }}>
                    <Paper sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '5px',
                            background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                            zIndex: 1,
                        },
                    }}>
                        {selectedConversation ? (
                            <>
                                {/* Header */}
                                <Box sx={{
                                    p: 2,
                                    borderBottom: '1px solid rgba(100, 116, 139, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                }}>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '1.2rem',
                                        position: 'relative',
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            bgcolor: '#22c55e',
                                            bottom: 0,
                                            right: 0,
                                            border: '2px solid white',
                                        }
                                    }}>
                                        {(() => {
                                            // Get data about the current conversation
                                            const participants = selectedConversation?.participants || [];
                                            const isSelfConversation = participants.length === 1 && participants[0]?.id === user?.id;
                                            const recipient = participants.find((p: Participant) => p.id !== user?.id);

                                            console.log('🔍 AVATAR DISPLAY DEBUG:', {
                                                participants,
                                                participantsCount: participants.length,
                                                recipient,
                                                isSelfConversation,
                                                selfId: user?.id
                                            });

                                            // For self-conversations, show "Me"
                                            if (isSelfConversation) return 'M';

                                            // For conversations with a recipient, show their initial
                                            if (recipient?.name) return recipient.name.charAt(0).toUpperCase();
                                            if (recipient?.email) return recipient.email.charAt(0).toUpperCase();

                                            // For group conversations, show the conversation name initial
                                            if (selectedConversation?.name) return selectedConversation.name.charAt(0).toUpperCase();

                                            // Last fallback
                                            return 'C';
                                        })()}
                                    </Box>
                                    <Box>
                                        <Typography variant="h6" component="div">
                                            {(() => {
                                                // Get data about the current conversation
                                                const participants = selectedConversation?.participants || [];
                                                const isSelfConversation = participants.length === 1 && participants[0]?.id === user?.id;
                                                const recipient = participants.find((p: Participant) => p.id !== user?.id);

                                                // For self-conversations, show "Me (Notes)"
                                                if (isSelfConversation) return 'Me (Notes)';

                                                // For conversations with a recipient, show their name
                                                if (recipient?.name) return recipient.name;
                                                if (recipient?.email) return recipient.email;

                                                // For group conversations, show the conversation name
                                                if (selectedConversation?.name) return selectedConversation.name;

                                                // Last fallback
                                                return 'Chat';
                                            })()}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            Online now
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Messages */}
                                <Box sx={{
                                    flex: 1,
                                    overflow: 'auto',
                                    p: 2,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                }}>
                                    {messages.map((message, index) => (
                                        <Box
                                            key={message.id}
                                            sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: message.sender.id === user?.id ? 'flex-end' : 'flex-start',
                                                alignSelf: message.sender.id === user?.id ? 'flex-end' : 'flex-start',
                                                maxWidth: '70%',
                                                position: 'relative',
                                                animation: 'fadeIn 0.3s ease-out',
                                                '@keyframes fadeIn': {
                                                    '0%': {
                                                        opacity: 0,
                                                        transform: 'translateY(10px)'
                                                    },
                                                    '100%': {
                                                        opacity: 1,
                                                        transform: 'translateY(0)'
                                                    }
                                                }
                                            }}
                                        >
                                            <Paper
                                                sx={{
                                                    p: 2,
                                                    borderRadius: message.sender.id === user?.id
                                                        ? '16px 16px 4px 16px'
                                                        : '16px 16px 16px 4px',
                                                    background: message.sender.id === user?.id
                                                        ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                                                        : darkMode
                                                            ? 'rgba(30, 41, 59, 0.8)'
                                                            : 'rgba(255, 255, 255, 0.8)',
                                                    color: message.sender.id === user?.id ? 'white' : 'inherit',
                                                    boxShadow: message.sender.id === user?.id
                                                        ? '0 4px 12px rgba(59, 130, 246, 0.25)'
                                                        : 'none',
                                                    backdropFilter: 'blur(10px)',
                                                    border: message.sender.id === user?.id
                                                        ? 'none'
                                                        : darkMode
                                                            ? '1px solid rgba(255, 255, 255, 0.1)'
                                                            : '1px solid rgba(0, 0, 0, 0.05)',
                                                }}
                                            >
                                                <Typography sx={{ wordBreak: 'break-word' }}>{message.content}</Typography>
                                            </Paper>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    mt: 0.5,
                                                    color: darkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                                                    fontSize: '0.65rem',
                                                }}
                                            >
                                                {message.created_at ? new Date(message.created_at).toLocaleString(undefined, {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: true
                                                }) : 'Just now'}
                                            </Typography>
                                        </Box>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </Box>

                                {/* Message input */}
                                <Box sx={{
                                    p: 2,
                                    borderTop: '1px solid rgba(100, 116, 139, 0.1)',
                                    background: darkMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(248, 250, 252, 0.7)',
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        gap: 2,
                                        position: 'relative',
                                    }}>
                                        <TextField
                                            fullWidth
                                            variant="outlined"
                                            placeholder="Type a message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();

                                                    // Verify we have a valid conversation and message before sending
                                                    if (!selectedConversation) {
                                                        console.error('❌ No conversation selected! Cannot send message.');
                                                        return;
                                                    }

                                                    // Check for participants and fix if missing
                                                    if (!selectedConversation.participants || !Array.isArray(selectedConversation.participants) || selectedConversation.participants.length === 0) {
                                                        console.log('⚠️ Fixing missing participants before sending message');

                                                        // Create a new conversation object with valid participants
                                                        const fixedConversation = {
                                                            ...selectedConversation,
                                                            participants: prevSelectedConversationRef.current?.participants ||
                                                                (user ? [{
                                                                    id: user.id,
                                                                    name: user.name,
                                                                    email: user.email || '',
                                                                    avatarUrl: user.avatarUrl || ''
                                                                }] : [])
                                                        };

                                                        // Update the conversation with fixed data
                                                        setSelectedConversation(fixedConversation);

                                                        // Allow a small time for state to update
                                                        setTimeout(() => {
                                                            if (!newMessage.trim()) return;
                                                            handleSendMessage();
                                                        }, 50);

                                                        return;
                                                    }

                                                    if (!newMessage.trim()) {
                                                        console.log('❌ Cannot send empty message');
                                                        return;
                                                    }

                                                    handleSendMessage();
                                                }
                                            }}
                                            disabled={connectionStatus !== 'connected'}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '24px',
                                                    transition: 'all 0.2s ease',
                                                    background: darkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                                                    backdropFilter: 'blur(10px)',
                                                    '&.Mui-focused': {
                                                        boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
                                                    },
                                                    '& fieldset': {
                                                        borderColor: 'transparent',
                                                        transition: 'all 0.2s ease',
                                                    },
                                                    '&:hover fieldset': {
                                                        borderColor: 'rgba(59, 130, 246, 0.3)',
                                                    },
                                                    '&.Mui-focused fieldset': {
                                                        borderColor: 'rgba(59, 130, 246, 0.6) !important',
                                                        borderWidth: '1px',
                                                    },
                                                },
                                            }}
                                            InputProps={{
                                                sx: {
                                                    pr: 1,
                                                }
                                            }}
                                        />
                                        <IconButton
                                            color="primary"
                                            onClick={handleSendMessage}
                                            disabled={connectionStatus !== 'connected' || !newMessage.trim()}
                                            sx={{
                                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                                color: 'white',
                                                width: 48,
                                                height: 48,
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                                                },
                                                '&:active': {
                                                    transform: 'translateY(0)',
                                                },
                                                '&.Mui-disabled': {
                                                    background: 'linear-gradient(135deg, #94a3b8, #cbd5e1)',
                                                    color: 'rgba(255, 255, 255, 0.8)',
                                                }
                                            }}
                                        >
                                            <SendIcon />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </>
                        ) : (
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                p: 4,
                                textAlign: 'center'
                            }}>
                                <Box sx={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 2,
                                }}>
                                    <SendIcon
                                        sx={{
                                            fontSize: 36,
                                            color: 'primary.main',
                                            transform: 'rotate(-30deg)',
                                        }}
                                    />
                                </Box>
                                <Typography variant="h6" gutterBottom>
                                    {activeTab === 0
                                        ? 'Select a conversation to start chatting'
                                        : 'Select a user to start a new conversation'}
                                </Typography>
                                <Typography color="text.secondary" sx={{ maxWidth: 400, mb: 3 }}>
                                    {activeTab === 0
                                        ? 'Choose a conversation from the list to continue chatting'
                                        : 'Browse the user list and select someone to start a new conversation'}
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Box>
            </Box>
            <style jsx global>{`
                @keyframes pulse {
                    0% { opacity: 0.6; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.1); }
                    100% { opacity: 0.6; transform: scale(1); }
                }
            `}</style>
        </ThemeProvider>
    );
};

export default ChatContainer; 