"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  ArrowLeft,
  Calendar,
  Building2,
  DollarSign,
  Layers,
  FileCheck2,
  Sparkles,
  ShieldAlert,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { FolderProgressBar } from "@/components/expediente/FolderProgressBar";
import { FolderSidebar } from "@/components/expediente/FolderSidebar";
import { FolderViewAi } from "@/components/expediente/FolderViewAi";
import { FolderViewManual } from "@/components/expediente/FolderViewManual";
import { FolderManagerModal } from "@/components/expediente/FolderManagerModal";
import { Modal } from "@/components/ui/Modal";
import { DataStore } from "@/lib/store/dataStore";
import { createInitialFolders } from "@/lib/store/initialData";
import {
  Adquisicion,
  Carpeta,
  Documento,
  CampoExtraido,
  Firma,
  EstadoAdquisicion,
} from "@/types";
import { formatCurrencyBs, formatDateBO } from "@/lib/docx/formatters";

export default function ExpedienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [adquisicion, setAdquisicion] = useState<Adquisicion | null>(null);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [activeFolderNum, setActiveFolderNum] = useState<number>(1);
  const [camposExtraidos, setCamposExtraidos] = useState<CampoExtraido[]>([]);
  const [firmas, setFirmas] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const [dbError, setDbError] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    setDbError(null);

    let adq = DataStore.getAdquisicionById(id);
    if (!adq) {
      const syncRes = await DataStore.syncWithSupabase();
      if (!syncRes.success) {
        setDbError(syncRes.error || "Error al conectar con la base de datos Supabase");
      }
      adq = DataStore.getAdquisicionById(id);
    }

    if (!adq) {
      setLoading(false);
      return;
    }

    setAdquisicion(adq);
    const folders = DataStore.getCarpetasByAdquisicion(adq.id);
    const safeFolders = Array.isArray(folders) && folders.length > 0 ? folders : createInitialFolders(adq.id);
    setCarpetas(safeFolders);
    const fields = DataStore.getCamposExtraidos(adq.id);
    setCamposExtraidos(Array.isArray(fields) ? fields : []);
    const sigs = DataStore.getFirmas(adq.id);
    setFirmas(Array.isArray(sigs) ? sigs : []);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-xs text-on-surface-variant">
        Cargando expediente institucional...
      </div>
    );
  }

  if (!adquisicion) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h3 className="font-headline-md text-lg font-bold text-error">Expediente no encontrado</h3>
        <p className="text-xs text-on-surface-variant mt-1 mb-4">
          El proceso solicitado no existe o fue eliminado.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-primary text-on-primary rounded font-mono text-xs"
        >
          Volver al Dashboard
        </Link>
      </div>
    );
  }

  const safeCarpetas = carpetas.length > 0 ? carpetas : createInitialFolders(adquisicion.id);
  const activeFolder = safeCarpetas.find((c) => c.numero === activeFolderNum) || safeCarpetas[0];

  const handleDocumentAdded = (newDoc: Documento, newCampos?: CampoExtraido[]) => {
    if (activeFolder?.id) {
      DataStore.addDocumentToCarpeta(activeFolder.id, newDoc);
    }
    if (newCampos && newCampos.length > 0) {
      DataStore.saveCamposExtraidos(adquisicion.id, newCampos);
    }
    // Check if state should transition to Generación IA or Revisión
    if (activeFolderNum >= 5 && adquisicion.estado === "Iniciado") {
      DataStore.updateAdquisicion(adquisicion.id, { estado: "Generación IA" });
    }
    loadData(true);
  };


  const handleSign = (firmaId: string) => {
    DataStore.signFirma(firmaId, "Usuario Autenticado");
    loadData();
  };

  const handleStatusChange = (newStatus: EstadoAdquisicion) => {
    DataStore.updateAdquisicion(adquisicion.id, { estado: newStatus });
    loadData();
  };

  const handleDeleteExpediente = () => {
    setIsDeleting(true);
    setTimeout(() => {
      DataStore.deleteAdquisicion(adquisicion.id);
      router.push("/");
    }, 400);
  };

  return (
    <>
      <Topbar title={`Expediente: ${adquisicion.codigo}`} />

      <main className="flex-1 overflow-y-auto p-3 md:p-6 w-full">
        <div className="w-full space-y-6">
          {/* Breadcrumb & Process Header */}
          <div className="border-b border-outline-variant pb-5">
            <div className="flex items-center gap-2 text-on-surface-variant font-mono text-xs">
              <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-primary font-bold bg-surface-container-high px-2 py-0.5 rounded">
                {adquisicion.codigo}
              </span>
              <span className="text-outline">• {adquisicion.categoria}</span>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mt-3 gap-3">
              <div>
                <h2 className="font-headline-lg text-xl md:text-2xl font-bold text-on-surface">
                  {adquisicion.titulo_proceso}
                </h2>
                <div className="flex flex-wrap items-center gap-4 mt-1 font-mono text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    {adquisicion.unidad_solicitante}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-primary font-bold">
                    <DollarSign className="w-3.5 h-3.5" />
                    {formatCurrencyBs(adquisicion.prevision_presupuesto)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Inicio: {formatDateBO(adquisicion.fecha_inicio)}
                  </span>
                </div>
              </div>

              {/* Status Switcher & Delete Action */}
              <div className="flex items-center gap-2">
                <select
                  value={adquisicion.estado}
                  onChange={(e) => handleStatusChange(e.target.value as EstadoAdquisicion)}
                  className="font-mono text-xs py-1.5 px-3 rounded border border-outline-variant bg-surface text-primary font-bold focus:border-primary focus:ring-0"
                >
                  <option value="Iniciado">Estado: Iniciado</option>
                  <option value="Generación IA">Estado: Generación IA</option>
                  <option value="Revisión y Firmas">Estado: Revisión y Firmas</option>
                  <option value="Concluido">Estado: Concluido</option>
                  <option value="Cancelado">Estado: Cancelado</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-error border border-red-200 rounded font-mono text-xs font-bold transition-colors"
                  title="Eliminar este expediente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          </div>

          {/* 8-Stage Progress Tracker */}
          <FolderProgressBar
            carpetas={carpetas}
            activeNumero={activeFolderNum}
            onSelectNumero={setActiveFolderNum}
          />

          {/* Dual Column Workflow (Folders Left, Canvas Right) */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left 3 Columns: Dynamic Folders Selector */}
            <div className="col-span-12 lg:col-span-3">
              <FolderSidebar
                carpetas={carpetas}
                activeNumero={activeFolderNum}
                onSelectNumero={setActiveFolderNum}
                onOpenManager={() => setIsManagerOpen(true)}
              />
            </div>

            {/* Right 9 Columns: Active Folder Canvas */}
            <div className="col-span-12 lg:col-span-9 bg-surface-container-lowest border border-outline-variant rounded-lg p-6 md:p-8 min-h-[550px] shadow-institutional flex flex-col">
              {activeFolder && (activeFolder.tipo_generacion === "IA" || !activeFolder.tipo_generacion) ? (
                <FolderViewAi
                  adquisicion={adquisicion}
                  carpeta={activeFolder}
                  todasCarpetas={carpetas}
                  onDocumentGenerated={(doc) => handleDocumentAdded(doc)}
                  onAdquisicionUpdated={(updated) => {
                    setAdquisicion(updated);
                    const folders = DataStore.getCarpetasByAdquisicion(updated.id);
                    if (folders && folders.length > 0) {
                      setCarpetas(folders);
                    }
                  }}
                />
              ) : (
                <FolderViewManual
                  adquisicion={adquisicion}
                  carpeta={activeFolder}
                  camposExtraidos={camposExtraidos}
                  onDocumentUploaded={(doc, campos) => handleDocumentAdded(doc, campos)}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Folder Manager Modal (Crear, Reordenar, Asignar Plantillas) */}
      <FolderManagerModal
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        adquisicion={adquisicion}
        carpetas={carpetas}
        onCarpetasUpdated={(updated) => {
          setCarpetas(updated);
          // Si la carpeta activa fue eliminada, seleccionar la primera disponible
          if (!updated.some((c) => c.numero === activeFolderNum) && updated.length > 0) {
            setActiveFolderNum(updated[0].numero);
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title="¿Eliminar Expediente de Adquisición?"
        subtitle="Esta acción es irreversible y eliminará el expediente completo con sus 8 carpetas y documentos generados."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs font-sans">
          <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-3 text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">
                {adquisicion.codigo}: {adquisicion.titulo_proceso}
              </p>
              <p className="text-[11px] text-red-700 mt-1">
                Presupuesto: {formatCurrencyBs(adquisicion.prevision_presupuesto)} • Unidad: {adquisicion.unidad_solicitante}
              </p>
            </div>
          </div>

          <p className="text-on-surface-variant">
            ¿Confirmas que deseas eliminar definitivamente este expediente del sistema?
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border border-outline-variant rounded font-mono text-xs text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDeleteExpediente}
              className="flex items-center gap-1.5 px-4 py-2 bg-error hover:bg-red-700 text-white rounded font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? "Eliminando..." : "Sí, Eliminar Expediente"}</span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
