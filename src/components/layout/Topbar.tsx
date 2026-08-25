"use client";

import React, { useState } from "react";
import { Search, Database } from "lucide-react";

interface TopbarProps {
  onSearch?: (term: string) => void;
  title?: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  onSearch,
  title = "Plan de Adquisiciones",
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <header className="bg-surface dark:bg-surface-dim border-b border-outline-variant dark:border-outline flex justify-between items-center w-full px-6 h-16 sticky top-0 z-30">
      {/* Title / Breadcrumb */}
      <div className="flex items-center gap-3">
        <h2 className="font-headline-md text-xl font-bold text-primary tracking-tight">
          {title}
        </h2>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-surface-container-high text-on-surface-variant border border-outline-variant">
          <Database className="w-3 h-3 text-primary" />
          ENDE Deoruro - Oruro
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative w-64 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Buscar por código, objeto..."
            className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant rounded font-sans text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:border-b-2 transition-all"
          />
        </div>

        {/* User profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-outline-variant">
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
            ED
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-bold text-on-surface leading-tight">Admin Contrataciones</span>
            <span className="text-[10px] text-on-surface-variant font-mono">admin@ende-deoruro.bo</span>
          </div>
        </div>
      </div>
    </header>
  );
};
