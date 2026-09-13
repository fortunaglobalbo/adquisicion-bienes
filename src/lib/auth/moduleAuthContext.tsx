"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export type ModuleRole = "adquisiciones" | "hoja_ruta" | null;

// Claves institucionales definidas por la administración
const PIN_ADQUISICIONES = "7526197";
const PIN_HOJA_RUTA = "5202";
const STORAGE_KEY = "ende_module_auth_role";

interface ModuleAuthContextType {
  role: ModuleRole;
  login: (pin: string) => { success: boolean; role?: ModuleRole };
  logout: () => void;
  canAccessPath: (path: string) => boolean;
}

const ModuleAuthContext = createContext<ModuleAuthContextType>({
  role: null,
  login: () => ({ success: false }),
  logout: () => {},
  canAccessPath: () => false,
});

export const ModuleAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [role, setRole] = useState<ModuleRole>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ModuleRole;
      if (saved === "adquisiciones" || saved === "hoja_ruta") {
        setRole(saved);
      }
    } catch {
      // Ignorar fallos de localStorage
    } finally {
      setMounted(true);
    }
  }, []);

  const login = (pin: string) => {
    const trimmed = pin.trim();
    if (trimmed === PIN_ADQUISICIONES) {
      setRole("adquisiciones");
      try {
        localStorage.setItem(STORAGE_KEY, "adquisiciones");
      } catch {}
      return { success: true, role: "adquisiciones" as const };
    }

    if (trimmed === PIN_HOJA_RUTA) {
      setRole("hoja_ruta");
      try {
        localStorage.setItem(STORAGE_KEY, "hoja_ruta");
      } catch {}
      return { success: true, role: "hoja_ruta" as const };
    }

    return { success: false };
  };

  const logout = () => {
    setRole(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const isHojaRutaPath = (path: string) => {
    return path.startsWith("/hoja-ruta") || path.startsWith("/hoja_ruta");
  };

  const canAccessPath = (path: string): boolean => {
    if (!role) return false;
    if (role === "hoja_ruta") {
      // Hoja de ruta solo puede ver su módulo
      return isHojaRutaPath(path);
    }
    if (role === "adquisiciones") {
      // Adquisiciones puede ver todo EXCEPTO hoja de ruta
      return !isHojaRutaPath(path);
    }
    return false;
  };

  if (!mounted) {
    return null;
  }

  return (
    <ModuleAuthContext.Provider
      value={{
        role,
        login,
        logout,
        canAccessPath,
      }}
    >
      {children}
    </ModuleAuthContext.Provider>
  );
};

export const useModuleAuth = () => useContext(ModuleAuthContext);
