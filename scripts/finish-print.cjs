const fs=require('fs');const file='src/components/expediente/TdrDocumentViewer.tsx';let s=fs.readFileSync(file,'utf8');
s='import { flushSync } from "react-dom";\n'+s; // This component is already in the client graph.
s=s.replace('  const totalPages = 7;', '  const totalPages = 5;');
s=s.replace('  const [viewMode, setViewMode] = useState<"paginado" | "continuo">("continuo");',`  const [viewMode, setViewMode] = useState<"paginado" | "continuo">("continuo");
  React.useEffect(() => {
    const prepare = () => flushSync(() => setViewMode("continuo"));
    window.addEventListener("ende-before-print", prepare);
    return () => window.removeEventListener("ende-before-print", prepare);
  }, []);`);
s=s.replace(/className="w-full max-w-full lg:max-w-\[1050px\] bg-white border border-outline-variant shadow-xl/g,m=>m.replace('className="','className="print-document '));
s=s.replace('import { flushSync } from "react-dom";\n"use client";', '"use client";\nimport { flushSync } from "react-dom";');fs.writeFileSync(file,s);
