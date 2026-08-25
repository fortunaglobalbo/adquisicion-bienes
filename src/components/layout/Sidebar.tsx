"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
} from "lucide-react";
import { InstitutionalLogo } from "./InstitutionalLogo";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      name: "Expedientes",
      href: "/#expedientes",
      icon: FolderKanban,
      active: pathname.startsWith("/expediente"),
    },
    {
      name: "Plantillas Oficiales",
      href: "/plantillas",
      icon: FileText,
      active: pathname === "/plantillas",
    },
  ];

  return (
    <nav className="bg-surface-container-low dark:bg-tertiary-container text-primary dark:text-primary-fixed-dim w-64 border-r border-outline-variant dark:border-outline fixed left-0 top-0 h-screen flex flex-col p-4 z-40 select-none">
      {/* Header with Institutional Branding */}
      <div className="mb-6 px-2 mt-2">
        <Link href="/" className="flex items-center gap-2">
          <InstitutionalLogo size="md" showText={false} />
        </Link>
        <div className="mt-2 pl-2">
          <h1 className="font-headline-md text-base font-bold text-primary tracking-tight">
            ENDE Deoruro S.A.
          </h1>
          <p className="font-mono text-xs text-on-surface-variant">Portal de Adquisiciones</p>
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

      {/* Footer Info */}
      <div className="border-t border-outline-variant pt-3 text-xs text-on-surface-variant font-mono flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sistema Operativo
          </span>
          <span className="text-[10px] text-outline">v1.0.0</span>
        </div>
        <span className="text-[10px] text-outline">Reglamento SBC - Oruro, Bolivia</span>
      </div>
    </nav>
  );
};
