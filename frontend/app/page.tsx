import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/auth-options';
import LandingPage from '../components/LandingPage';
import ChatContainer from '../components/ChatContainer';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <LandingPage />;
  }

  return <ChatContainer />;
}
