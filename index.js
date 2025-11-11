import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Clave de OpenAI (se recomienda ponerla en Render como variable de entorno)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/analyze", async (req, res) => {
  try {
    const imageUrl = req.body.image_url;
    const userPrompt = req.body.prompt || "Describe esta imagen en detalle.";

    if (!imageUrl) {
      return res.status(400).json({ error: "Falta el parámetro 'image_url'" });
    }

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

    // Captura de errores de la API
    if (!response.ok) {
      console.error("Error API:", data);
      return res.status(500).json({ error: data });
    }

let textResult =
  data.output_text ||
  (data.output && data.output[0]?.content[0]?.text) ||
  "No se pudo analizar la imagen.";

let parsedResult;

// Limpieza de bloques de texto tipo ```json
try {
  const cleanText = textResult
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  parsedResult = JSON.parse(cleanText);
} catch (e) {
  parsedResult = { raw_text: textResult };
}

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
