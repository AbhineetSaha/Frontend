"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { type Session, type User as SupabaseUser } from "@supabase/supabase-js";
import supabase from "./supabase";

interface User {
  id: string;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toUser(u: SupabaseUser | null): User | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from current session
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        console.error("Supabase getSession error:", error.message);
      }
      const session = data.session;
      setUser(toUser(session?.user ?? null));
      setAccessToken(session?.access_token ?? null);
      setLoading(false);
    };

    // Subscribe to auth changes (sign-in, token refresh, sign-out)
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: any, session: Session | null) => {
        setUser(toUser(session?.user ?? null));
        setAccessToken(session?.access_token ?? null);
      }
    );

    void init();
    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error("Supabase signIn error:", error.message);
      return { error: error.message };
    }
    const session = data.session;
    setUser(toUser(session?.user ?? null));
    setAccessToken(session?.access_token ?? null);
    return {};
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error("Supabase signUp error:", error.message);
      return { error: error.message };
    }
    // Depending on your project settings, signUp may require email verification before a session exists.
    const session = data.session;
    setUser(toUser(session?.user ?? null));
    setAccessToken(session?.access_token ?? null);
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  };

  // Handy helper for API clients/interceptors
  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token !== accessToken) setAccessToken(token);
    return token;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        signIn,
        signUp,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
