"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Institutional Sidebar with dynamic toggle */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 transition-all duration-200 ease-in-out ${
          sidebarOpen ? "w-64 translate-x-0" : "-translate-x-full w-0"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main Content Viewport */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-200 ease-in-out ${
          sidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        {/* Quick Float Toggle for Sidebar (specially useful in Split Screen) */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`fixed top-3 z-50 p-1.5 bg-primary text-white rounded-md shadow-md hover:bg-primary-container transition-all ${
            sidebarOpen ? "left-[262px]" : "left-3"
          }`}
          title={sidebarOpen ? "Ocultar menú para pantalla completa" : "Mostrar menú"}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        {children}
      </div>
    </div>
  );
};
