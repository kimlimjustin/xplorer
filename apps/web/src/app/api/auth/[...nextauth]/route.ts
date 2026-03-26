import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth';

let _handler: ReturnType<typeof NextAuth>;
function getHandler() {
  if (!_handler) _handler = NextAuth(getAuthOptions());
  return _handler;
}

async function handler(...args: any[]) {
  return (getHandler() as any)(...args);
}

export { handler as GET, handler as POST };
