# Servidor de imágenes · Qwen-Image 2.1

La app genera imágenes llamando a este servidor, que corre en un PC con GPU NVIDIA y se expone a internet con un túnel.
Render no tiene GPU, así que el modelo **no puede correr allá**.

## Requisitos (PC de Santiago: RTX 4070 SUPER 12 GB, 32 GB RAM)
- Modelo cuantizado a 4 bits (NF4): ~10 GB de VRAM, cabe en 12 GB.
- **Primera carga:** necesita ~20 GB de RAM libre (cuantiza el modelo y guarda una copia en `~/matchia-qwen/qwen-image-2.1-nf4`).
  Cierra el navegador y otros programas pesados, o sube la memoria virtual de Windows a 32 GB o más.
- Cargas siguientes: usan la copia cuantizada, más rápido y con mucha menos RAM.
- Licencia: *Qwen Research License* (uso de investigación / no comercial). Sirve para el prototipo; para un producto hay que pedir licencia a Alibaba.

## Instalación (ya hecha en este PC)
```powershell
python -m venv $env:USERPROFILE\matchia-qwen\.venv
$py = "$env:USERPROFILE\matchia-qwen\.venv\Scripts\python.exe"
& $py -m pip install torch --index-url https://download.pytorch.org/whl/cu128
& $py -m pip install -r tools\qwen-image-server\requirements.txt
& "$env:USERPROFILE\matchia-qwen\.venv\Scripts\hf.exe" download Qwen/Qwen-Image-2.1   # ~33 GB
```

## Usarlo con la app
1. Inicia el servidor (deja la ventana abierta):
   ```powershell
   .\tools\qwen-image-server\start.ps1 -Token "una-clave-larga"
   ```
   Espera a ver `Uvicorn running on http://127.0.0.1:8000`. Prueba: `curl http://127.0.0.1:8000/health`.
2. Exponlo a internet con [ngrok](https://ngrok.com) (la cuenta gratis trae un dominio fijo):
   ```powershell
   ngrok http 8000 --url=TU-DOMINIO.ngrok-free.app
   ```
3. En Render (y en tu `.env` local):
   ```
   QWEN_IMAGE_URL=https://TU-DOMINIO.ngrok-free.app
   QWEN_IMAGE_TOKEN=una-clave-larga
   ```
Mientras el PC esté apagado o el servidor cerrado, la app muestra "Hay mucha demanda en este momento" al pedir imágenes.

## Alternativa en la nube (sin tu PC)
ModelScope ofrece Qwen-Image 2.1 gratis con cupo diario. Necesita una cuenta de ModelScope vinculada a Alibaba Cloud
(con verificación de identidad) y un token. En Render: `MODELSCOPE_TOKEN=...` (y no pongas `QWEN_IMAGE_URL`).
Esta opción no está probada todavía.
