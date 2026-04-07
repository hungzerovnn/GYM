"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api, setAccessToken, setTenantKey } from "./api";
import { translateText } from "./i18n/display";
import { AuthUser } from "@/types/portal";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  requestOtp: (identifier: string, password: string) => Promise<{
    challengeId: string;
    maskedTarget: string;
    expiresAt: string;
    resendCooldownSeconds: number;
  }>;
  login: (
    databaseKey: string,
    identifier: string,
    password: string,
    otpCode?: string,
    rememberMe?: boolean,
    otpChallengeId?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toReadableError = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && !error.response) {
    return new Error(translateText("Khong ket noi duoc API. Hay kiem tra backend dang chay o cong 6273."));
  }
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (typeof message === "string" && message.trim()) {
    return new Error(message);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallback);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refreshUser = async () => {
    try {
      const response = await api.get<AuthUser>("/auth/me");
      setUser(response.data);
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsReady(true);
    }
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isReady,
      requestOtp: async (identifier, password) => {
        try {
          const response = await api.post("/auth/request-otp", { identifier, password });
          return response.data;
        } catch (error) {
          throw toReadableError(error, translateText("Khong gui duoc OTP"));
        }
      },
      login: async (databaseKey, identifier, password, otpCode, _rememberMe, otpChallengeId) => {
        try {
          setTenantKey(databaseKey);
          const response = await api.post("/auth/login", { identifier, password, otpCode, otpChallengeId });
          setAccessToken(response.data.accessToken);
          setTenantKey(response.data.user?.tenantCode || databaseKey);
          setUser(response.data.user);
        } catch (error) {
          throw toReadableError(error, translateText("Dang nhap that bai"));
        }
      },
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
      refreshUser,
    }),
    [isReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
