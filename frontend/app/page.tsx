'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Button, Container, Paper, Card, CardContent,
  CardMedia, Avatar, Chip, useTheme, useMediaQuery, IconButton,
  Tooltip, alpha, Grid
} from '@mui/material';
import {
  Chat as ChatIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Groups as GroupsIcon,
  EmojiObjects as InnovationIcon,
  ArrowForward as ArrowIcon,
  LockOutlined as EncryptionIcon,
  Diversity3 as CommunityIcon,
  Devices as DevicesIcon,
  GitHub as GitHubIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

// Mock testimonials
const testimonials = [
  {
    name: 'Alex Chen',
    role: 'Software Engineer',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    content: 'Not-WhatsApp has revolutionized how our team communicates. The secure messaging is exactly what we needed.',
  },
  {
    name: 'Sophia Rodriguez',
    role: 'Product Manager',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    content: 'I love the clean interface and how fast messages are delivered. It\'s become our go-to platform.',
  },
  {
    name: 'Michael Kim',
    role: 'UX Designer',
    avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    content: 'The attention to design details is impressive. This is how modern communication tools should be built.',
  },
];

// Features list
const features = [
  {
    icon: <ChatIcon fontSize="large" color="primary" />,
    title: 'Real-time Messaging',
    description: 'Instant message delivery with live typing indicators and read receipts.',
  },
  {
    icon: <EncryptionIcon fontSize="large" color="primary" />,
    title: 'End-to-End Encryption',
    description: 'Your conversations are secured with state-of-the-art encryption technology.',
  },
  {
    icon: <DevicesIcon fontSize="large" color="primary" />,
    title: 'Multi-device Support',
    description: 'Seamlessly sync your conversations across all your devices.',
  },
  {
    icon: <SpeedIcon fontSize="large" color="primary" />,
    title: 'Lightning Fast',
    description: 'Optimized for speed with minimal latency for a smooth experience.',
  },
  {
    icon: <GroupsIcon fontSize="large" color="primary" />,
    title: 'Group Conversations',
    description: 'Create groups for team projects, family, or friends with advanced controls.',
  },
  {
    icon: <CommunityIcon fontSize="large" color="primary" />,
    title: 'Open Source',
    description: 'Built with transparency and community contributions at its core.',
  },
];

export default function Home() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simple animation on load
    setIsLoaded(true);

    // Note: We've removed the automatic redirect that was here before
    // This allows users to see the landing page first
  }, []);

  // Function to handle login/redirect
  const handleStartChatting = () => {
    if (isAuthenticated) {
      router.push('/chat');
    } else {
      login();
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: theme.palette.mode === 'dark'
        ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)'
        : 'linear-gradient(135deg, #f9fafb 0%, #e2e8f0 100%)',
    }}>
      {/* Header/Nav */}
      <Container>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 3,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 'bold',
                background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChatIcon sx={{ mr: 1 }} />
              Not-WhatsApp
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => window.open('https://github.com/RatneshMaurya/not-whatsapp', '_blank')}
              startIcon={<GitHubIcon />}
              sx={{
                borderRadius: '10px',
                backdropFilter: 'blur(10px)',
                backgroundColor: alpha(theme.palette.background.paper, 0.1),
              }}
            >
              GitHub
            </Button>

            <Button
              variant="contained"
              color="primary"
              onClick={handleStartChatting}
              sx={{
                borderRadius: '10px',
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)',
              }}
            >
              Get Started
            </Button>
          </Box>
        </Box>
      </Container>

      {/* Hero Section */}
      <Container sx={{ mt: 6, mb: 10 }}>
        <Grid sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, alignItems: 'center' }}>
          <Grid sx={{
            gridColumn: { xs: 'span 12', md: 'span 6' },
            opacity: isLoaded ? 1 : 0,
            transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease-out',
          }}>
            <Typography
              variant="h2"
              component="h2"
              fontWeight="bold"
              sx={{
                mb: 2,
                background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: isMobile ? '2.5rem' : '3.5rem',
              }}
            >
              Secure, Fast, <br />Modern Chat App
            </Typography>

            <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: '90%' }}>
              Communicate freely with end-to-end encryption,
              real-time messaging, and a clean interface.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                color="primary"
                endIcon={<ArrowIcon />}
                onClick={handleStartChatting}
                sx={{
                  py: 1.5,
                  px: 3,
                  borderRadius: '10px',
                  boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)',
                  backgroundImage: 'linear-gradient(to right, #3b82f6, #6366f1)',
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px 0 rgba(59, 130, 246, 0.6)',
                  },
                  animation: 'pulse 2s infinite'
                }}
              >
                Start Chatting Now
              </Button>

              <Button
                variant="outlined"
                size="large"
                color="primary"
                onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })}
                sx={{
                  py: 1.5,
                  px: 3,
                  borderRadius: '10px',
                  backdropFilter: 'blur(10px)',
                  backgroundColor: alpha(theme.palette.background.paper, 0.1),
                }}
              >
                Learn More
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
              <Chip
                icon={<SecurityIcon />}
                label="Secure"
                variant="outlined"
                sx={{
                  borderRadius: '20px',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  borderColor: 'transparent',
                  px: 1
                }}
              />
              <Chip
                icon={<SpeedIcon />}
                label="Fast"
                variant="outlined"
                sx={{
                  borderRadius: '20px',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  borderColor: 'transparent',
                  px: 1
                }}
              />
              <Chip
                icon={<InnovationIcon />}
                label="Modern"
                variant="outlined"
                sx={{
                  borderRadius: '20px',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  borderColor: 'transparent',
                  px: 1
                }}
              />
            </Box>
          </Grid>

          <Grid sx={{
            gridColumn: { xs: 'span 12', md: 'span 6' },
            opacity: isLoaded ? 1 : 0,
            transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease-out',
            transitionDelay: '0.2s',
          }}>
            <Box sx={{
              position: 'relative',
              height: 500,
              display: { xs: 'none', md: 'block' }
            }}>
              {/* Chat UI Preview */}
              <Paper
                elevation={8}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '70%',
                  height: '80%',
                  borderRadius: 4,
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                  zIndex: 2,
                  animation: 'float 5s ease-in-out infinite'
                }}
              >
                <Box sx={{
                  p: 1,
                  bgcolor: 'primary.main',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}>
                  <Avatar src="https://randomuser.me/api/portraits/women/32.jpg" sx={{ width: 30, height: 30 }} />
                  <Typography variant="subtitle2">Emma Watson</Typography>
                </Box>
                <Box sx={{ p: 2, height: '100%', bgcolor: theme.palette.background.paper }}>
                  <Box sx={{
                    p: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    borderRadius: '0 15px 15px 15px',
                    maxWidth: '80%',
                    mb: 2
                  }}>
                    <Typography variant="body2">Hey! How's it going with the project?</Typography>
                  </Box>
                  <Box sx={{
                    p: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.6),
                    color: 'white',
                    borderRadius: '15px 0 15px 15px',
                    maxWidth: '80%',
                    ml: 'auto',
                    mb: 2
                  }}>
                    <Typography variant="body2">Almost done with the design phase! Will share updates soon.</Typography>
                  </Box>
                  <Box sx={{
                    p: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    borderRadius: '0 15px 15px 15px',
                    maxWidth: '80%',
                  }}>
                    <Typography variant="body2">Great! Looking forward to it 😊</Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Second Paper for Depth */}
              <Paper
                elevation={4}
                sx={{
                  position: 'absolute',
                  top: 60,
                  left: 60,
                  width: '70%',
                  height: '80%',
                  borderRadius: 4,
                  background: alpha(theme.palette.primary.light, 0.1),
                  zIndex: 1,
                  animation: 'float 5s ease-in-out infinite',
                  animationDelay: '0.2s'
                }}
              />

              {/* Third Paper for Depth */}
              <Paper
                elevation={2}
                sx={{
                  position: 'absolute',
                  top: 120,
                  left: 120,
                  width: '70%',
                  height: '80%',
                  borderRadius: 4,
                  background: alpha(theme.palette.primary.light, 0.05),
                  zIndex: 0,
                  animation: 'float 5s ease-in-out infinite',
                  animationDelay: '0.4s'
                }}
              />
            </Box>

            {/* Mobile-only image */}
            <Box
              component="img"
              src="/preview.png"
              alt="Chat App Preview"
              sx={{
                width: '100%',
                borderRadius: 4,
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                display: { xs: 'block', md: 'none' }
              }}
            />
          </Grid>
        </Grid>
      </Container>

      {/* Features Section */}
      <Container sx={{ py: 8 }} id="features-section">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="h3"
            component="h2"
            fontWeight="bold"
            sx={{
              mb: 2,
              background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}
          >
            Why Choose Not-WhatsApp?
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
            Built with modern technologies and designed for privacy and ease of use.
          </Typography>
        </Box>

        <Grid sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
          {features.map((feature, index) => (
            <Grid key={index} sx={{
              gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' },
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s ease-out',
              transitionDelay: `${0.1 * index}s`,
            }}>
              <Paper
                elevation={1}
                sx={{
                  p: 3,
                  height: '100%',
                  borderRadius: 4,
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                  },
                  backdropFilter: 'blur(10px)',
                  backgroundColor: alpha(theme.palette.background.paper, 0.7),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <Box sx={{
                  mb: 2,
                  p: 2,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.1)
                }}>
                  {feature.icon}
                </Box>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Testimonials */}
      <Container sx={{ py: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="h3"
            component="h2"
            fontWeight="bold"
            sx={{
              mb: 2,
              background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}
          >
            What People Say
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
            Join thousands of satisfied users experiencing better communication.
          </Typography>
        </Box>

        <Grid sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
          {testimonials.map((testimonial, index) => (
            <Grid key={index} sx={{
              gridColumn: { xs: 'span 12', md: 'span 4' },
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s ease-out',
              transitionDelay: `${0.1 * index}s`,
            }}>
              <Paper
                elevation={1}
                sx={{
                  p: 4,
                  height: '100%',
                  borderRadius: 4,
                  position: 'relative',
                  backdropFilter: 'blur(10px)',
                  backgroundColor: alpha(theme.palette.background.paper, 0.7),
                }}
              >
                <Typography
                  variant="h1"
                  sx={{
                    position: 'absolute',
                    top: 10,
                    left: 20,
                    opacity: 0.1,
                    fontSize: '120px',
                    color: theme.palette.primary.main
                  }}
                >
                  "
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, position: 'relative', zIndex: 1 }}>
                  "{testimonial.content}"
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar src={testimonial.avatar} sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {testimonial.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {testimonial.role}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA */}
      <Container sx={{ py: 10 }}>
        <Paper
          elevation={3}
          sx={{
            p: { xs: 4, md: 8 },
            borderRadius: 4,
            backgroundImage: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            color: 'white',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle at top right, rgba(255,255,255,0.1) 0%, transparent 70%)',
              zIndex: 0
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h3" fontWeight="bold" sx={{ mb: 2 }}>
              Ready to get started?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, maxWidth: 700, mx: 'auto' }}>
              Join thousands of users and experience the future of messaging today.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartChatting}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                py: 1.5,
                px: 4,
                borderRadius: '10px',
                boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.2)',
                '&:hover': {
                  bgcolor: 'white',
                  opacity: 0.9,
                  transform: 'translateY(-3px)'
                },
                transition: 'all 0.3s',
              }}
            >
              Get Started Now
            </Button>
          </Box>
        </Paper>
      </Container>

      {/* Footer */}
      <Box sx={{
        bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
        py: 4,
        borderTop: `1px solid ${theme.palette.divider}`
      }}>
        <Container>
          <Grid sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'bold',
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChatIcon sx={{ mr: 1 }} />
                Not-WhatsApp
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                A modern, secure messaging platform built with privacy in mind.
              </Typography>
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 8' } }}>
              <Grid sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
                <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 4' } }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    Product
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Features
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Security
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Pricing
                  </Typography>
                </Grid>

                <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 4' } }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    Resources
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Documentation
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    GitHub
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Community
                  </Typography>
                </Grid>

                <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 4' } }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    Company
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    About
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Terms of Service
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Privacy Policy
                  </Typography>
                </Grid>
              </Grid>
            </Grid>

            <Box sx={{
              mt: 4,
              pt: 2,
              borderTop: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2
            }}>
              <Typography variant="body2" color="text.secondary">
                © {new Date().getFullYear()} Not-WhatsApp. All rights reserved.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Tooltip title="GitHub">
                  <IconButton size="small" onClick={() => window.open('https://github.com/RatneshMaurya/not-whatsapp', '_blank')}>
                    <GitHubIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Grid>
        </Container>
      </Box>

      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </Box>
  );
}
