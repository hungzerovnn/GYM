"use client";

import axios from "axios";
import { getCurrentLocale, normalizeUtf8Payload } from "./i18n/runtime";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6273/api";

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
let tenantKey: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem("fitflow_access_token", token);
    } else {
      window.localStorage.removeItem("fitflow_access_token");
    }
  }
};

export const setTenantKey = (value: string | null) => {
  tenantKey = value;
  if (typeof window !== "undefined") {
    if (value) {
      window.localStorage.setItem("fitflow_tenant_key", value);
    } else {
      window.localStorage.removeItem("fitflow_tenant_key");
    }
  }
};

export const getTenantKey = () => {
  if (tenantKey) return tenantKey;
  if (typeof window !== "undefined") {
    tenantKey = window.localStorage.getItem("fitflow_tenant_key");
  }
  return tenantKey;
};

export const getAccessToken = () => {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = window.localStorage.getItem("fitflow_access_token");
  }
  return accessToken;
};

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  const selectedTenant = getTenantKey();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (selectedTenant) {
    config.headers["x-tenant-key"] = selectedTenant;
  }
  config.headers["Accept-Language"] = getCurrentLocale();
  return config;
});

api.interceptors.response.use(
  (response) => {
    response.data = normalizeUtf8Payload(response.data);
    return response;
  },
  async (error) => {
    if (error.config?.url?.includes("/auth/refresh")) {
      setAccessToken(null);
      throw error;
    }

    if (error.response?.status !== 401 || error.config?._retry) {
      throw error;
    }

    if (!refreshPromise) {
      refreshPromise = api
        .post("/auth/refresh")
        .then((response) => {
          setAccessToken(response.data.accessToken);
          return response.data.accessToken as string;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const token = await refreshPromise;
    error.config._retry = true;
    error.config.headers.Authorization = `Bearer ${token}`;
    return api.request(error.config);
  },
);

export interface ListResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}
