import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(bodyParser.json());
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Utilidades simples de normalización/validación
const norm = s => (s ?? "").toString().trim().replace(/\s+/g, " ");
const up = s => norm(s).toUpperCase();

function extractFallbacks(text = "") {
  const t = text.toUpperCase();

  // VIN (17 chars, sin I,O,Q)
  const vinMatch = t.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  const vin = vinMatch ? vinMatch[1] : "";

  // Placa COL (aprox): ABC123, o variaciones 3L + 2-3N
  const placaMatch = t.match(/\b([A-Z]{3}\s?-?\s?[0-9]{2,3})\b/);
  const placa = placaMatch ? placaMatch[1].replace(/\s|-/g, "") : "";

  // Número de motor: secuencia 6+ (relajado)
  const motorMatch = t.match(/\b([A-Z0-9]{6,})\b/);
  const motor = motorMatch ? motorMatch[1] : "";

  return { vin, placa, motor };
}

function finalizeRecord(raw) {
  // Normaliza claves y limpia valores
  const rec = {
    placa: up(raw.placa),
    marca: up(raw.marca),
    línea: up(raw["línea"] ?? raw.linea),
    modelo: norm(raw.modelo),
    color: up(raw.color),
    clase: up(raw.clase ?? raw["clase_de_vehículo"] ?? raw["clase_de_vehiculo"]),
    carrocería: up(raw["carrocería"] ?? raw["tipo_carrocería"] ?? raw["tipo_carroceria"]),
    combustible: up(raw.combustible),
    número_de_chasis: up(raw["número_de_chasis"] ?? raw.vin),
    número_de_motor: up(raw["número_de_motor"] ?? raw.motor),
    propietario: up(raw.propietario),
  };

  // Campos obligatorios a vigilar
  const required = [
    "placa","marca","línea","modelo","color",
    "clase","carrocería","combustible",
    "número_de_chasis","número_de_motor","propietario"
  ];

  const missing = required.filter(k => !rec[k] || rec[k] === "");
  return { rec, missing, missing_count: missing.length, pending_fields: missing.join(", ") };
}

app.post("/analyze", async (req, res) => {
  try {
    const imageUrl = req.body.image_url;
    const userPrompt = req.body.prompt; // opcional
    if (!imageUrl) return res.status(400).json({ ok:false, error: "Falta 'image_url'" });

    const systemPrompt =
      "Eres un lector de documentos colombiano. Lee la imagen y devuelve EXCLUSIVAMENTE un JSON válido (sin texto extra) con estas claves en minúsculas: placa, marca, línea, modelo, color, clase, carrocería, combustible, número_de_chasis, número_de_motor, propietario. Valores tal cual aparecen (sin adornos).";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: systemPrompt + (userPrompt ? "\n\nNota: " + userPrompt : "") },
              { type: "input_image", image_url: imageUrl }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ ok:false, error: data });
    }

    // 1) Intenta leer como texto
    const text =
      data.output_text ||
      (data.output && data.output[0]?.content[0]?.text) ||
      "";

    // 2) Intenta parsear JSON
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    // 3) Si no hay JSON, intenta rescate por regex
    if (!parsed || typeof parsed !== "object") {
      const fb = extractFallbacks(text);
      parsed = {
        placa: fb.placa,
        marca: "",
        línea: "",
        modelo: "",
        color: "",
        clase: "",
        carrocería: "",
        combustible: "",
        número_de_chasis: fb.vin,
        número_de_motor: fb.motor,
        propietario: ""
      };
    }

    // 4) Normaliza + calcula faltantes
    const { rec, missing, missing_count, pending_fields } = finalizeRecord(parsed);

    // 5) Confianza simple (heurística)
    const confidence =
      rec["número_de_chasis"] && rec.placa ? "high" :
      rec["número_de_chasis"] || rec.placa ? "medium" : "low";

    return res.json({
      ok: true,
      data: rec,
      missing,
      missing_count,
      pending_fields,
      confidence,
      raw_text: text // útil para debug si algo falla
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error: "Error analizando la imagen" });
  }
});

app.get("/", (_req, res) => res.send("Servidor activo. Endpoint: /analyze"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
