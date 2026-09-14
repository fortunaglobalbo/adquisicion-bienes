"use client";

import React, { useState, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Monitor } from "lucide-react";

export const ZoomController: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ende_ui_zoom");
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 70 && val <= 130) {
          setZoomLevel(val);
          applyZoom(val);
        }
      }
    } catch {
      // Ignorar errores en localStorage
    }
  }, []);

  const applyZoom = (level: number) => {
    if (typeof document !== "undefined") {
      const scale = level / 100;
      // style.zoom es soportado ampliamente en Chromium (Chrome, Edge, Opera, WebView)
      (document.documentElement.style as any).zoom = `${scale}`;
    }
  };

  const changeZoom = (delta: number) => {
    const next = Math.min(Math.max(zoomLevel + delta, 70), 125);
    setZoomLevel(next);
    applyZoom(next);
    try {
      localStorage.setItem("ende_ui_zoom", next.toString());
    } catch {}
  };

  const setExactZoom = (val: number) => {
    setZoomLevel(val);
    applyZoom(val);
    try {
      localStorage.setItem("ende_ui_zoom", val.toString());
    } catch {}
  };

  const resetZoom = () => {
    setZoomLevel(100);
    applyZoom(100);
    try {
      localStorage.removeItem("ende_ui_zoom");
    } catch {}
  };

  return (
    <div className={`relative z-40 print:hidden ${className}`}>
      {/* Botón flotante tipo Lupa para ajustar en laptops */}
      <div className="flex items-center bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg shadow-sm overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors font-medium font-mono"
          title="Ajustar tamaño de pantalla / Lupa para laptops"
        >
          <ZoomIn className="w-3.5 h-3.5 text-[#001e40] dark:text-[#feb316]" />
          <span>{zoomLevel}%</span>
        </button>

        {isOpen && (
          <div className="flex items-center border-l border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/90 px-1 py-0.5 gap-1">
            <button
              type="button"
              onClick={() => changeZoom(-5)}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-300"
              title="Reducir tamaño (-5%)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setExactZoom(85)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                zoomLevel === 85
                  ? "bg-[#001e40] text-white"
                  : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
              }`}
              title="Escala 85% ideal para laptops"
            >
              85%
            </button>

            <button
              type="button"
              onClick={() => setExactZoom(90)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                zoomLevel === 90
                  ? "bg-[#001e40] text-white"
                  : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
              }`}
              title="Escala 90% para laptops"
            >
              90%
            </button>

            <button
              type="button"
              onClick={() => changeZoom(5)}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-300"
              title="Aumentar tamaño (+5%)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {zoomLevel !== 100 && (
              <button
                type="button"
                onClick={resetZoom}
                className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                title="Restablecer a 100%"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
