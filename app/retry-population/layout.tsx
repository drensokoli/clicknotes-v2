import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../api/auth/[...nextauth]/route';

export default async function RetryPopulationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  
  // Server-side protection - only allow drensokoli@gmail.com
  if (!session?.user?.email || session.user.email !== 'drensokoli@gmail.com') {
    redirect('/');
  }

  return <>{children}</>;
}
