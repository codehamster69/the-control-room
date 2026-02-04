import NextAuth from "next-auth";
import { SupabaseAdapter } from "@next-auth/supabase-adapter";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions = {
  providers: [
    // Email/Password authentication via Supabase
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // We'll use Supabase client-side for auth, so this is just a placeholder
        // The actual auth happens in the client
        return { id: credentials.email, email: credentials.email };
      },
    }),
    // You can add other providers here
  ],
  callbacks: {
    async jwt({ token, user, account }: { token: any; user: any; account: any }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },

    async session({ session, token }: { session: any; token: any }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id;
      }
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  session: {
    strategy: "jwt" as const,
  },
  pages: {
    signIn: "/", // Use our custom login page
  },
  // You can add more NextAuth options here
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
