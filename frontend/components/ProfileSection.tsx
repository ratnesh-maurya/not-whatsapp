'use client';
import React, { useState } from 'react';
import {
    Box, Avatar, Typography, IconButton, Menu, MenuItem,
    Divider, Badge, Tooltip, Paper, Switch, Dialog,
    DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    PersonOutline as PersonIcon,
    Nightlight as DarkModeIcon,
    Lock as LockIcon,
    Edit as EditIcon,
    NotificationsActive as NotificationIcon,
    VpnKey as KeyIcon,
    MoreVert as MoreIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '@mui/material/styles';

interface ProfileSectionProps {
    onDarkModeToggle?: (isDark: boolean) => void;
    darkMode?: boolean;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
    onDarkModeToggle,
    darkMode = false
}) => {
    const { user, logout } = useAuth();
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [nameInput, setNameInput] = useState(user?.name || '');
    const [statusInput, setStatusInput] = useState('Online');

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleDarkModeToggle = () => {
        if (onDarkModeToggle) {
            onDarkModeToggle(!darkMode);
        }
        handleMenuClose();
    };

    const handleLogout = () => {
        handleMenuClose();
        logout();
    };

    const handleProfileDialogOpen = () => {
        handleMenuClose();
        setProfileDialogOpen(true);
    };

    const handleProfileDialogClose = () => {
        setProfileDialogOpen(false);
    };

    const handleProfileUpdate = () => {
        // TODO: Implement actual profile update
        console.log('Profile updated:', { name: nameInput, status: statusInput });
        setProfileDialogOpen(false);
    };

    if (!user) return null;

    return (
        <>
            <Paper
                elevation={2}
                sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 2,
                    background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(to right, #1a2035, #1E1E2E)'
                        : 'linear-gradient(to right, #f5f7fa, #e4e8f0)',
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.palette.divider}`,
                    mb: 2,
                }}
            >
                <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: '#4caf50',
                                border: '2px solid white',
                            }}
                        />
                    }
                >
                    <Avatar
                        src={user.avatarUrl}
                        alt={user.name}
                        sx={{
                            width: 50,
                            height: 50,
                            border: '2px solid',
                            borderColor: 'primary.main',
                            boxShadow: '0 0 10px rgba(66, 153, 225, 0.5)',
                        }}
                    />
                </Badge>

                <Box sx={{ ml: 2, flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        {user.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Online
                    </Typography>
                </Box>

                <Tooltip title="Profile options">
                    <IconButton
                        onClick={handleMenuOpen}
                        size="small"
                        sx={{
                            background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                            borderRadius: '50%',
                            transition: 'all 0.2s',
                            '&:hover': {
                                background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                            }
                        }}
                    >
                        <MoreIcon />
                    </IconButton>
                </Tooltip>
            </Paper>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                sx={{
                    '& .MuiPaper-root': {
                        borderRadius: 2,
                        minWidth: 200,
                        boxShadow: theme.palette.mode === 'dark'
                            ? '0 8px 16px rgba(0,0,0,0.5)'
                            : '0 8px 16px rgba(0,0,0,0.1)',
                        border: `1px solid ${theme.palette.divider}`,
                        backdropFilter: 'blur(10px)',
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem onClick={handleProfileDialogOpen}>
                    <PersonIcon fontSize="small" sx={{ mr: 2 }} />
                    Edit Profile
                </MenuItem>

                <MenuItem onClick={handleDarkModeToggle}>
                    <DarkModeIcon fontSize="small" sx={{ mr: 2 }} />
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                    <Switch
                        size="small"
                        checked={darkMode}
                        sx={{ ml: 1 }}
                        onClick={(e) => e.stopPropagation()}
                        onChange={handleDarkModeToggle}
                    />
                </MenuItem>

                <Divider />

                <MenuItem>
                    <KeyIcon fontSize="small" sx={{ mr: 2 }} />
                    Encryption Keys
                </MenuItem>

                <MenuItem>
                    <NotificationIcon fontSize="small" sx={{ mr: 2 }} />
                    Notifications
                </MenuItem>

                <MenuItem>
                    <LockIcon fontSize="small" sx={{ mr: 2 }} />
                    Privacy
                </MenuItem>

                <MenuItem>
                    <SettingsIcon fontSize="small" sx={{ mr: 2 }} />
                    Settings
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                    <LogoutIcon fontSize="small" sx={{ mr: 2 }} />
                    Logout
                </MenuItem>
            </Menu>

            <Dialog
                open={profileDialogOpen}
                onClose={handleProfileDialogClose}
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        maxWidth: 400,
                        width: '100%',
                    }
                }}
            >
                <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                    Edit Profile
                </DialogTitle>

                <DialogContent sx={{ pt: 1 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                        <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            badgeContent={
                                <IconButton
                                    size="small"
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'white',
                                        '&:hover': {
                                            bgcolor: 'primary.dark',
                                        },
                                        width: 22,
                                        height: 22,
                                    }}
                                >
                                    <EditIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                            }
                        >
                            <Avatar
                                src={user.avatarUrl}
                                alt={user.name}
                                sx={{ width: 80, height: 80 }}
                            />
                        </Badge>
                    </Box>

                    <TextField
                        fullWidth
                        label="Display Name"
                        variant="outlined"
                        margin="normal"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                    />

                    <TextField
                        fullWidth
                        label="Status"
                        variant="outlined"
                        margin="normal"
                        value={statusInput}
                        onChange={(e) => setStatusInput(e.target.value)}
                        select
                        SelectProps={{ native: true }}
                    >
                        <option value="Online">Online</option>
                        <option value="Away">Away</option>
                        <option value="Do Not Disturb">Do Not Disturb</option>
                        <option value="Invisible">Invisible</option>
                    </TextField>

                    <TextField
                        fullWidth
                        label="Email"
                        variant="outlined"
                        margin="normal"
                        value={user.email}
                        disabled
                    />
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={handleProfileDialogClose} variant="outlined">
                        Cancel
                    </Button>
                    <Button onClick={handleProfileUpdate} variant="contained">
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default ProfileSection; 