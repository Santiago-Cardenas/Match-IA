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
& $py -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
& $py -m pip install -r tools\qwen-image-server\requirements.txt
& "$env:USERPROFILE\matchia-qwen\.venv\Scripts\hf.exe" download Qwen/Qwen-Image-2.1   # ~33 GB
```

## Usarlo con la app
1. Una sola vez: cuenta gratis en [ngrok](https://ngrok.com), `ngrok config add-authtoken TU_AUTHTOKEN`
   y copia tu dominio gratuito (Dashboard → Domains, termina en `.ngrok-free.dev` o `.ngrok-free.app`).
2. Cada vez, desde la carpeta del proyecto (deja la ventana abierta):
   ```powershell
   cd "C:\Users\santi\OneDrive\Documentos\Icesi\Semestre 10\Innovacion_3\Match-IA"
   .\tools\qwen-image-server\start.ps1 -Token "una-clave-larga" -Dominio "tu-dominio.ngrok-free.dev"
   ```
   Abre ngrok en otra ventana y arranca el servidor. Listo cuando ves `Uvicorn running on http://127.0.0.1:8000`.
   Prueba: abre `https://tu-dominio.ngrok-free.dev/health` en el navegador.
3. En Render (y en tu `.env` local):
   ```
   QWEN_IMAGE_URL=https://tu-dominio.ngrok-free.dev
   QWEN_IMAGE_TOKEN=una-clave-larga
   ```
Mientras el PC esté apagado o el servidor cerrado, la app muestra "Hay mucha demanda en este momento" al pedir imágenes.

## Alternativa en la nube (sin tu PC)
ModelScope ofrece Qwen-Image 2.1 gratis con cupo diario. Necesita una cuenta de ModelScope vinculada a Alibaba Cloud
(con verificación de identidad) y un token. En Render: `MODELSCOPE_TOKEN=...` (y no pongas `QWEN_IMAGE_URL`).
Esta opción no está probada todavía.
