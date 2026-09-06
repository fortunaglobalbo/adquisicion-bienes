const fs=require('fs');
const edit=(file,fn)=>fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')));
edit('src/app/api/ai/generate-tdr/route.ts',s=>{
 s='import { extractText } from "@/lib/server/extractText";\n'+s;
 const start=s.indexOf('    let extractedText'); const end=s.indexOf('    // 1. Procesar',start);
 s=s.slice(0,start)+`    if (!adquisicion?.codigo || !adquisicion?.titulo_proceso) return NextResponse.json({ error: "Adquisición requerida" }, { status: 400 });
    let extractedText = documentText || insumoTexto || "";
    let finalImageBase64 = imageBase64;
    if (imageBase64 && !imageBase64.startsWith("data:image")) {
      const buffer = Buffer.from(imageBase64.split(",").pop() || "", "base64");
      if (buffer.length > 20 * 1024 * 1024) return NextResponse.json({ error: "Archivo demasiado grande (máximo 20 MB)." }, { status: 400 });
      try { extractedText = [await extractText(buffer, nombreArchivo || ""), extractedText].filter(Boolean).join("\\n\\n"); } catch { /* The engine can apply OCR. */ }
    }

`+s.slice(end); return s;
});
edit('src/components/expediente/FolderViewAi.tsx',s=>{
 const start=s.indexOf('  const handleDownloadPdf ='); const end=s.indexOf('  const handleGenerateAi =',start);
 s=s.slice(0,start)+`  // Print the actual edited document for every folder; never generate a TDR
  // and mislabel it as a payment memo or conformity report.
  const handleDownloadPdf = async () => { window.print(); };

`+s.slice(end); return s;
});
edit('src/app/plantillas/page.tsx',s=>s.replace('    const list = DataStore.getPlantillas();','    void DataStore.syncWithSupabase().then(() => { const loaded = DataStore.getPlantillas(); setPlantillas(loaded); setActiveEditorPlantilla(loaded[0] || null); });\n    const list = DataStore.getPlantillas();').replace('const handleSavePlantilla = (updated: Plantilla) => {\n    DataStore.updatePlantilla(updated.id, updated);','const handleSavePlantilla = async (updated: Plantilla) => {\n    const result = await DataStore.updatePlantilla(updated.id, updated);\n    if (!result.success) { alert("Guardado en este navegador; pendiente de sincronización: " + result.error); return; }'));
edit('src/components/plantillas/TemplateTranspilerModal.tsx',s=>s.replace('const handleSaveAsDefaultTemplate = () => {','const handleSaveAsDefaultTemplate = async () => {').replace('      DataStore.updatePlantilla(tpl.id, tpl);','      const result = await DataStore.updatePlantilla(tpl.id, tpl);\n      if (!result.success) throw new Error("Cambios guardados localmente; sincronización pendiente: " + result.error);'));
edit('src/lib/store/initialData.ts',s=>s.replace('estado: tmpl.numero === 1 ? "Completado" : "Pendiente",','estado: "Pendiente",'));
