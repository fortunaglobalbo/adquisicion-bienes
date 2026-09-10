import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { FIXED_MODELS } from "@/lib/docx/fixedModels";

export default function PlantillasPage() {
  return <><Topbar title="Modelos Word institucionales" /><main className="flex-1 overflow-y-auto p-4 md:p-8"><div className="max-w-4xl mx-auto space-y-6"><h1 className="text-2xl font-bold text-primary">Tus documentos ya tienen un formato</h1><p>Abre una compra y elige su carpeta para completar el documento con IA, revisar la vista previa y descargar el Word.</p><Link href="/" className="inline-block rounded-lg bg-primary px-5 py-3 text-white font-semibold">Abrir mis compras</Link><div className="grid sm:grid-cols-2 gap-4">{FIXED_MODELS.map(m=><div key={m.number} className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-600">Carpeta {m.number}</p><h2 className="font-semibold text-lg mt-1">{m.title}</h2><p className="text-sm text-slate-600 mt-2">Modelo Word fijo · versión {m.version}</p></div>)}</div><p className="text-sm text-slate-600">La carpeta 8 conserva el modelo anterior de solicitud de pago. Falta incorporar su referencia institucional.</p></div></main></>;
}
