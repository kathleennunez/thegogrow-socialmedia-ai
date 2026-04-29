"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AppUser = {
  id: string;
  name: string;
};

type UserContextValue = {
  user: AppUser | null;
  isReady: boolean;
  setUserName: (name: string) => void;
  switchUser: (id: string, name?: string) => void;
};

const LOCAL_USER: AppUser = {
  id: "local-user",
  name: "Local Workspace",
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(LOCAL_USER);
  const [isReady] = useState(true);

  const switchUser = useCallback(() => {
    setUser(LOCAL_USER);
  }, []);

  const setUserName = useCallback(() => {
    setUser(LOCAL_USER);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isReady,
      setUserName,
      switchUser,
    }),
    [isReady, setUserName, switchUser, user],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useAppUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useAppUser must be used within UserProvider.");
  }

  return context;
}
