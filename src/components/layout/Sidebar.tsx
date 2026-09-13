"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileSpreadsheet,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { InstitutionalLogo } from "./InstitutionalLogo";
import { useModuleAuth } from "@/lib/auth/moduleAuthContext";

export const Sidebar: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const pathname = usePathname();
  const { role, logout } = useModuleAuth();

  const allNavItems = [
    {
      name: "Modelos Word",
      href: "/plantillas",
      icon: FolderKanban,
      active: pathname === "/plantillas",
      module: "adquisiciones",
    },
    {
      name: "Mis compras",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
      module: "adquisiciones",
    },
    {
      name: "Hoja de Ruta",
      href: "/hoja-ruta",
      icon: FileSpreadsheet,
      active: pathname.startsWith("/hoja-ruta") || pathname.startsWith("/hoja_ruta"),
      module: "hoja_ruta",
    },
    {
      name: "Biblioteca y revisión",
      href: "/configuracion/plantillas",
      icon: FolderKanban,
      active: pathname.startsWith("/configuracion"),
      module: "adquisiciones",
    },
  ];

  // Aislamiento estricto: solo mostrar las pestañas del módulo autorizado
  const navItems = allNavItems.filter((item) => item.module === role);

  return (
    <nav className="bg-surface-container-low dark:bg-tertiary-container text-primary dark:text-primary-fixed-dim w-64 border-r border-outline-variant dark:border-outline h-screen flex flex-col p-4 select-none">
      {/* Header with Institutional Branding */}
      <div className="mb-6 px-2 mt-2">
        <Link href={role === "hoja_ruta" ? "/hoja-ruta" : "/"} className="flex items-center gap-2">
          <InstitutionalLogo size="md" showText={false} />
        </Link>
        <div className="mt-2 pl-2">
          <h1 className="font-headline-md text-base font-bold text-primary tracking-tight">
            ENDE Deoruro S.A.
          </h1>
          <p className="font-mono text-xs text-on-surface-variant">
            {role === "hoja_ruta" ? "Control Hoja de Ruta" : "Portal de Adquisiciones"}
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <ul className="flex-1 space-y-1.5 font-mono text-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-150 ${
                  item.active
                    ? "bg-secondary-container text-on-secondary-container font-bold shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Icon className={`w-4 h-4 ${item.active ? "text-secondary-fixed-variant" : "text-outline"}`} />
                <span>{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer Info & Logout */}
      <div className="border-t border-outline-variant pt-3 text-xs text-on-surface-variant font-mono flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {role === "hoja_ruta" ? "Hoja de Ruta" : "Adquisiciones"}
          </span>
          <span className="text-[10px] text-outline">v1.0.0</span>
        </div>

        {/* Botón Salir / Bloquear Módulo */}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors text-xs"
          title="Cerrar sesión del módulo"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>

        <span className="text-[10px] text-outline">Reglamento SBC - Oruro, Bolivia</span>
      </div>
    </nav>
  );
};
