"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useModuleAuth } from "@/lib/auth/moduleAuthContext";
import { InstitutionalLogo } from "@/components/layout/InstitutionalLogo";
import { Lock, KeyRound, ShieldAlert, ArrowRight, Eye, EyeOff } from "lucide-react";

export const ModuleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, login, canAccessPath } = useModuleAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasAccess = canAccessPath(pathname);

  if (hasAccess) {
    return <>{children}</>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setSubmitting(true);

    const res = login(pin);
    setSubmitting(false);

    if (res.success && res.role) {
      setPin("");
      // Redirigir al inicio del módulo correspondiente si la ruta actual no le pertenece
      if (res.role === "hoja_ruta") {
        router.push("/hoja-ruta");
      } else if (res.role === "adquisiciones") {
        if (pathname.startsWith("/hoja-ruta") || pathname.startsWith("/hoja_ruta")) {
          router.push("/");
        }
      }
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 p-4 select-none">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-8 flex flex-col items-center text-center">
        {/* Logo Institucional */}
        <div className="mb-4">
          <InstitutionalLogo size="lg" showText={false} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-mono font-semibold mb-3">
          <Lock className="w-3.5 h-3.5" />
          <span>MÓDULO RESTRINGIDO</span>
        </div>

        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
          ENDE Deoruro S.A.
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 mb-6">
          Ingrese su código de autorización para acceder a este sistema
        </p>

        {/* Alerta de Error - Sin Pistas */}
        {error && (
          <div className="w-full mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
            <span>Código no autorizado. Acceso denegado.</span>
          </div>
        )}

        {/* Formulario de Código */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative flex items-center">
            <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3.5" />
            <input
              type={showPin ? "text" : "password"}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Código de autorización"
              autoFocus
              className="w-full pl-10 pr-10 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-center text-base tracking-widest font-mono font-bold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#d9531e] focus:border-transparent outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              tabIndex={-1}
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={!pin.trim() || submitting}
            className="w-full py-3 bg-[#d9531e] hover:bg-[#b84214] text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
          >
            <span>Verificar y Entrar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800 w-full text-[11px] text-neutral-400 font-mono flex items-center justify-center">
          <span>Sistema de Seguridad y Segregación de Módulos</span>
        </div>
      </div>
    </div>
  );
};
