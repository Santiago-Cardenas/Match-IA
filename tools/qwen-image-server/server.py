"""
Servidor local de Qwen-Image 2.1 para Matchia.

POST /generate  {"prompt": "..."}  ->  {"image": "<base64>", "mime": "image/jpeg", "seconds": 12.3}
GET  /health                         ->  {"ok": true, ...}

Variables de entorno (todas opcionales salvo el token si lo expones a internet):
  QWEN_IMAGE_TOKEN  clave compartida con la app (cabecera Authorization: Bearer <token>)
  QWEN_MODEL        repo o carpeta del modelo (por defecto Qwen/Qwen-Image-2.1, desde la caché de Hugging Face)
  QWEN_QUANT        nf4 (por defecto, cabe en GPUs de 12 GB) | none (bf16, requiere ~32 GB de VRAM)
  QWEN_STEPS        pasos de inferencia (por defecto 24; más = más calidad y más lento)
  QWEN_SIZE         lado de la imagen en px (por defecto 1024)
  QWEN_OFFLOAD      1 (por defecto) mueve cada parte a la GPU solo cuando se usa; 0 todo en GPU
  QWEN_NF4_DIR      carpeta donde se guarda el modelo ya cuantizado (~10 GB). La primera carga cuantiza y lo guarda
                    ahí (necesita ~20 GB de RAM libre); las siguientes cargan directo desde esa carpeta, rápido y con poca RAM.
"""

import base64
import io
import os
import threading
import time

import torch
from diffusers import PipelineQuantizationConfig, QwenImage21Pipeline
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

MODEL = os.getenv("QWEN_MODEL", "Qwen/Qwen-Image-2.1")
TOKEN = os.getenv("QWEN_IMAGE_TOKEN", "")
QUANT = os.getenv("QWEN_QUANT", "nf4")
STEPS = int(os.getenv("QWEN_STEPS", "24"))
SIZE = int(os.getenv("QWEN_SIZE", "1024"))
OFFLOAD = os.getenv("QWEN_OFFLOAD", "1") == "1"
NF4_DIR = os.getenv("QWEN_NF4_DIR", os.path.join(os.path.expanduser("~"), "matchia-qwen", "qwen-image-2.1-nf4"))

quant = None
if QUANT == "nf4":
    quant = PipelineQuantizationConfig(
        quant_backend="bitsandbytes_4bit",
        quant_kwargs={"load_in_4bit": True, "bnb_4bit_quant_type": "nf4", "bnb_4bit_compute_dtype": torch.bfloat16},
        components_to_quantize=["transformer", "text_encoder"],
    )

t0 = time.time()
if quant and os.path.isfile(os.path.join(NF4_DIR, "model_index.json")):
    print(f"Cargando modelo cuantizado desde {NF4_DIR}...", flush=True)
    pipe = QwenImage21Pipeline.from_pretrained(NF4_DIR, dtype=torch.bfloat16)
else:
    print(f"Cargando {MODEL} (quant={QUANT}, offload={OFFLOAD})... la primera vez tarda varios minutos", flush=True)
    pipe = QwenImage21Pipeline.from_pretrained(MODEL, dtype=torch.bfloat16, quantization_config=quant)
    if quant:
        try:
            pipe.save_pretrained(NF4_DIR)
            print(f"Modelo cuantizado guardado en {NF4_DIR} (las próximas cargas serán más rápidas)", flush=True)
        except Exception as e:  # no es grave: solo se pierde la carga rápida
            print(f"No se pudo guardar el modelo cuantizado: {e}", flush=True)
if OFFLOAD:
    pipe.enable_model_cpu_offload()
else:
    pipe.to("cuda")
print(f"Modelo listo en {time.time() - t0:.0f}s", flush=True)

lock = threading.Lock()  # una imagen a la vez en la GPU
app = FastAPI(title="Matchia · Qwen-Image 2.1")


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    width: int | None = Field(default=None, ge=256, le=2048)
    height: int | None = Field(default=None, ge=256, le=2048)
    steps: int | None = Field(default=None, ge=4, le=60)
    seed: int | None = None


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "quant": QUANT, "steps": STEPS, "size": SIZE, "gpu": torch.cuda.get_device_name(0)}


@app.post("/generate")
def generate(req: GenerateRequest, authorization: str | None = Header(default=None)):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Token inválido")
    start = time.time()
    seed = req.seed if req.seed is not None else int(time.time())
    with lock:
        image = pipe(
            prompt=req.prompt,
            width=req.width or SIZE,
            height=req.height or SIZE,
            num_inference_steps=req.steps or STEPS,
            generator=torch.Generator("cpu").manual_seed(seed),
        ).images[0]
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG", quality=90)
    seconds = round(time.time() - start, 1)
    print(f"Imagen generada en {seconds}s: {req.prompt[:60]!r}", flush=True)
    return {"image": base64.b64encode(buf.getvalue()).decode(), "mime": "image/jpeg", "seconds": seconds}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", "8000")))
