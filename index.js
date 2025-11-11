import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Clave de OpenAI (usa variable de entorno en Render)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🧠 Función para limpiar y normalizar nombres de claves
function normalizeKeys(obj) {
  const newObj = {};
  for (const key in obj) {
    const normalizedKey = key
      .normalize("NFD") // separa acentos
      .replace(/[\u0300-\u036f]/g, "") // elimina tildes
      .replace(/[^a-zA-Z0-9_]/g, "_") // reemplaza símbolos raros
      .toLowerCase();
    newObj[normalizedKey] = obj[key];
  }
  return newObj;
}

app.post("/analyze", async (req, res) => {
  try {
    const imageUrl = req.body.image_url;
    const userPrompt = req.body.prompt || "Describe esta imagen en detalle.";

    if (!imageUrl) {
      return res.status(400).json({ error: "Falta el parámetro 'image_url'" });
    }

    // 📸 Llamada a la API de OpenAI
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: userPrompt },
              { type: "input_image", image_url: imageUrl }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    // ⚠️ Si hay error en la API
    if (!response.ok) {
      console.error("Error API:", data);
      return res.status(500).json({ error: data });
    }

    // 🧩 Limpieza del texto devuelto por OpenAI
    let textResult =
      data.output_text ||
      (data.output && data.output[0]?.content[0]?.text) ||
      "No se pudo analizar la imagen.";

    let parsedResult;

    try {
      // Limpieza de posibles formatos de bloque de código
      const cleanText = textResult
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/El número de chasis.*?es/i, "")
        .replace(/VIN.*?es/i, "")
        .replace(/[\*\:]/g, "")
        .trim();

      // Intenta convertir a JSON
      parsedResult = JSON.parse(cleanText);
   } catch (e) {
  console.warn("⚠️ No se pudo parsear JSON, devolviendo texto limpio...");
  const cleanFallback = textResult
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/El número de chasis.*?es/i, "")
    .replace(/VIN.*?es/i, "")
    .replace(/[\*\:]/g, "")
    .trim();

  parsedResult = { texto_crudo: cleanFallback };
}


    // 🧹 Normaliza los nombres de las claves (quita tildes, ñ, etc.)
    parsedResult = normalizeKeys(parsedResult);

    // 📤 Devuelve el JSON final
    res.json({ result: parsedResult });

  } catch (error) {
    console.error("Error interno:", error);
    res.status(500).json({ error: "Error analizando la imagen" });
  }
});

app.get("/", (req, res) => {
  res.send("Servidor activo. Endpoint: /analyze");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
