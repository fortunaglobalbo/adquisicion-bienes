#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "Instalando Motor Documental e IA para ENDE DEORURO S.A."
echo "=========================================================="

# 1. Instalar dependencias del sistema
sudo apt-get update && sudo apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    python3-pip \
    python3-venv \
    docker.io \
    docker-compose

# 2. Levantar con Docker Compose
echo "Levantando contenedor Docker en puerto 8080..."
docker-compose down || true
docker-compose up -d --build

echo "=========================================================="
echo "✅ Motor Documental e IA desplegado exitosamente!"
echo "Verificar estado en: http://localhost:8080/health"
echo "=========================================================="
