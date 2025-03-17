import { GoogleGenerativeAI } from "@google/generative-ai";
import { writeFileSync } from 'fs';

// Inicializar el cliente de Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: `Actúa como un vendedor persuasivo que cambia las palabras por sinónimos cada vez que se envíe el texto.
        Además, agrega emoticones en lugares naturales en el texto, como para expresar emociones o enfatizar ciertos puntos.
        Utiliza una variedad de emoticones de manera aleatoria para cada mensaje.`,
});

const generationConfig = {
    temperature: 0.1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

/**
 * esta funcion debe ser llamada cunado se ejecute el flujo de la palabra clave!
 */
export async function toAskGeminy(message: string, history: { role: string, parts: { text: string }[] }[]) {
    const chatSession = model.startChat({
        generationConfig,
        history,
    });

    const result = await chatSession.sendMessage(message);
    const italian = result.response.text()
    console.log(`>>>>>>>>>> ${italian}`);
    return italian
}