import React, { useEffect, useState } from 'react';
import { Box, List, ListItem, ListItemAvatar, ListItemText, Avatar, Typography, Divider, Button } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config';

interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    public_key: string;
}

interface UserListProps {
    onSelectUser: (user: User) => void;
    selectedUserId?: string;
}

const UserList: React.FC<UserListProps> = ({ onSelectUser, selectedUserId }) => {
    const { token, login } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = async () => {
        if (!token) {
            setError('No authentication token available');
            setLoading(false);
            return;
        }

        console.log('Fetching users...');
        try {
            const response = await fetch(`${API_URL}/api/v1/users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Users response:', response.status);
            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setError('Session expired. Please login again.');
                    return;
                }
                throw new Error(`Failed to fetch users: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Users data:', data);
            setUsers(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [token]);

    if (loading) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>Loading users...</Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={login}
                    fullWidth
                >
                    Login Again
                </Button>
            </Box>
        );
    }

    return (
        <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
            {users.map((user) => (
                <React.Fragment key={user.id}>
                    <ListItem
                        component="div"
                        onClick={() => onSelectUser(user)}
                        sx={{
                            backgroundColor: user.id === selectedUserId ? 'primary.light' : 'inherit',
                            '&:hover': {
                                backgroundColor: 'action.hover',
                                cursor: 'pointer',
                            },
                        }}
                    >
                        <ListItemAvatar>
                            <Avatar src={user.avatarUrl} alt={user.name} />
                        </ListItemAvatar>
                        <ListItemText
                            primary={user.name}
                            secondary={user.email}
                        />
                    </ListItem>
                    <Divider variant="inset" component="li" />
                </React.Fragment>
            ))}
        </List>
    );
};

export default UserList; 