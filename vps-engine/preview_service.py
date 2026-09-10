"""Authenticated DOCX -> PDF conversion service. No storage or AI calls."""
import os
import secrets
import subprocess
import tempfile
import threading
import zipfile
from pathlib import Path
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import Response

app = FastAPI()
slots = threading.BoundedSemaphore(1)

@app.post('/api/docx/preview')
def preview(file: UploadFile = File(...), authorization: str = Header(default='')):
    key = os.environ.get('DOCX_PREVIEW_KEY', '')
    if not key or not secrets.compare_digest(authorization, 'Bearer ' + key):
        raise HTTPException(401, 'No autorizado')
    content = file.file.read(3 * 1024 * 1024 + 1)
    if len(content) > 3 * 1024 * 1024:
        raise HTTPException(413, 'Documento demasiado grande')
    if not slots.acquire(blocking=False):
        raise HTTPException(503, 'El convertidor está ocupado; vuelve a intentar')
    try:
        with tempfile.TemporaryDirectory(prefix='ende-preview-') as work:
            folder = Path(work)
            source = folder / 'documento.docx'
            source.write_bytes(content)
            try:
                with zipfile.ZipFile(source) as z:
                    if 'word/document.xml' not in z.namelist() or sum(i.file_size for i in z.infolist()) > 25 * 1024 * 1024:
                        raise ValueError('DOCX inválido')
                    # Rendering never follows external document links or runs macros.
                    for name in z.namelist():
                        if name.endswith('.rels') and b'TargetMode="External"' in z.read(name):
                            raise ValueError('No se admiten vínculos externos para la vista previa')
                        if 'vbaProject' in name: raise ValueError('No se admiten macros')
            except (ValueError, zipfile.BadZipFile):
                raise HTTPException(400, 'Word no admitido para vista previa')
            subprocess.run(['libreoffice', '-env:UserInstallation=' + (folder/'profile').as_uri(), '--headless', '--convert-to', 'pdf', '--outdir', str(folder), str(source)], check=True, capture_output=True, timeout=18)
            pdf = folder/'documento.pdf'
            if not pdf.exists(): raise HTTPException(502, 'No se pudo convertir el Word')
            return Response(pdf.read_bytes(), media_type='application/pdf', headers={'Cache-Control':'no-store'})
    except (subprocess.SubprocessError, OSError):
        raise HTTPException(502, 'No se pudo convertir el Word')
    finally:
        slots.release()
