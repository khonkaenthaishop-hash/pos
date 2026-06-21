import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      role?: string;
      nameTh?: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    nameTh?: string;
    _token?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    _token?: string;
    role?: string;
    nameTh?: string;
  }
}
