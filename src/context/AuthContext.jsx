import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUserAndProfile() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setUser(session.user);

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("role, status, full_name")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("AuthContext: failed to fetch profile", error);
      setProfile(null);
    } else {
      setProfile(profileData);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadUserAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      loadUserAndProfile();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile: loadUserAndProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}