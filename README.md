# ManyChat + OpenAI Image Analyzer

Servidor ligero en Node.js que conecta ManyChat con la API de OpenAI (modelos GPT-4o o GPT-4o-mini) para analizar imágenes y extraer datos.

## 🚀 Endpoint principal
`POST /analyze`

### Body JSON de ejemplo
```json
{
  "image_url": "https://ejemplo.com/imagen.jpg",
  "prompt": "Extrae el nombre del producto y el precio."
}
