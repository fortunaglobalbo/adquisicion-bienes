import React from "react";

interface InstitutionalLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

export const InstitutionalLogo: React.FC<InstitutionalLogoProps> = ({
  className = "",
  size = "md",
  showText = false,
}) => {
  const pixelSizes = {
    sm: { height: 28, maxW: 100 },
    md: { height: 42, maxW: 150 },
    lg: { height: 64, maxW: 220 },
    xl: { height: 80, maxW: 280 },
  };

  const current = pixelSizes[size] || pixelSizes.md;

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-ende-deoruro.png"
        alt="ENDE DEORURO S.A."
        style={{
          height: `${current.height}px`,
          maxHeight: `${current.height}px`,
          maxWidth: `${current.maxW}px`,
          width: "auto",
        }}
        className="object-contain drop-shadow-sm"
      />
      {showText && (
        <div className="hidden xl:flex flex-col">
          <span className="font-headline-md text-xs font-bold text-primary tracking-wider uppercase leading-none">
            ENDE Deoruro S.A.
          </span>
          <span className="font-mono text-[10px] text-on-surface-variant leading-tight">
            Distribuidora de Electricidad
          </span>
        </div>
      )}
    </div>
  );
};
