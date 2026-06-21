import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          const { access_token, user } = data;
          if (!access_token) return null;
          // เก็บ token ใน User object ชั่วคราวเพื่อส่งต่อให้ JWT callback เท่านั้น
          return { ...user, _token: access_token };
        } catch (err) {
          console.error('[NextAuth] authorize error:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // เก็บ token ใน JWT (encrypted httpOnly cookie — ไม่เปิดเผยฝั่ง client)
        token._token = (user as Record<string, unknown>)._token as string;
        token.role = (user as Record<string, unknown>).role as string;
        token.nameTh = (user as Record<string, unknown>).nameTh as string;
      }
      return token;
    },
    async session({ session, token }) {
      // session ที่ client เห็นได้ — ไม่มี token
      if (session.user) {
        session.user.role = token.role as string;
        session.user.nameTh = token.nameTh as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  trustHost: true,
});
