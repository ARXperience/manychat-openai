import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// 🔐 Clave de OpenAI (colócala en las variables de entorno de Render)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/analyze", async (req, res) => {
  try {
    const imageUrl = req.body.image_url;
    const userPrompt =
      req.body.prompt ||
      "Extrae todos los datos visibles del documento de tránsito colombiano. Devuelve exclusivamente un objeto JSON limpio con las siguientes claves exactas y en minúsculas: {placa, linea, modelo, clase, carroceria, numero_de_chasis, numero_de_motor, propietario, identificacion}. No incluyas texto adicional ni encabezados.";

    if (!imageUrl) {
      return res.status(400).json({ error: "Falta el parámetro 'image_url'" });
    }

    // 🔗 Llamada a la API de OpenAI
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: userPrompt },
              { type: "input_image", image_url: imageUrl },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error API OpenAI:", data);
      return res.status(500).json({ error: data });
    }

    // 🧠 Extraer texto principal
    let resultText =
      data.output_text ||
      (data.output && data.output[0]?.content[0]?.text) ||
      "No se pudo analizar la imagen.";

    // 🧹 Intentar convertir el texto en JSON válido
    let parsedResult = {};
    try {
      const jsonMatch = resultText.match(/{[\s\S]*}/);
      if (jsonMatch) {
        const fixedText = jsonMatch[0]
          .replace(/(\w+)\s+"([^"]+)"/g, '"$1": "$2"') // corrige claves sin ':'
          .replace(/[\n\r\t]/g, " "); // elimina saltos de línea
        parsedResult = JSON.parse(fixedText);
      }
    } catch (err) {
      console.error("⚠️ Error al parsear JSON:", err);
    }

    // 🧩 Estructura garantizada para ManyChat
    const cleanResult = {
      placa: parsedResult.placa || "",
      linea: parsedResult.linea || "",
      modelo: parsedResult.modelo || "",
      clase: parsedResult.clase || "",
      carroceria: parsedResult.carroceria || "",
      numero_de_chasis: parsedResult.numero_de_chasis || "",
      numero_de_motor: parsedResult.numero_de_motor || "",
      propietario: parsedResult.propietario || "",
      identificacion: parsedResult.identificacion || "",
      texto_crudo: resultText || "",
    };

    res.json({ result: cleanResult });
  } catch (error) {
    console.error("💥 Error interno del servidor:", error);
    res.status(500).json({ error: "Error analizando la imagen" });
  }
});

// 🔍 Ruta de prueba
app.get("/", (req, res) => {
  res.send("✅ Servidor activo. Endpoint disponible en /analyze");
});

// 🔊 Puerto automático asignado por Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor escuchando en puerto ${PORT}`));
