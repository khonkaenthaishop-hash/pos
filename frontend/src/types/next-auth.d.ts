import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      role?: string;
      nameTh?: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    nameTh?: string;
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    role?: string;
    nameTh?: string;
  }
}

