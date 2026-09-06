import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { SmartDocxUploader } from "@/components/plantillas/SmartDocxUploader";

export default function PlantillasPage() {
  return <><Topbar title="Preparar documento" /><main className="flex-1 overflow-y-auto p-4 md:p-8"><SmartDocxUploader /><div className="mx-auto mt-6 max-w-4xl text-sm text-slate-600"><Link href="/configuracion/plantillas" className="underline">Configuración de modelos</Link></div></main></>;
}
