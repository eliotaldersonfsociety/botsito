import "dotenv/config"
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { toAskGemini } from "./ai/gemini"  // Esta función debe interactuar con Gemini.
import { join } from "path"
import { fromAudioToText } from "./ai/groq"  // Esta función debe transcribir el audio.
import ffmpeg from 'fluent-ffmpeg'
import path from 'path';  // Importa el módulo path
import fs from 'fs';
import { createClient } from "@libsql/client";
import { toAskGeminy } from "./ai/gemini2"  // Esta función debe interactuar con Gemini.
import { writeFileSync, unlinkSync } from 'fs';



const PORT = process.env.PORT ?? 3015

/** ¿Cuál es la funcionalidad de este flujo? 
 *  El bot escucha mensajes de voz, los transcribe y genera una respuesta de texto usando Gemini.
 *  También maneja mensajes de texto y genera respuestas con Gemini.
 */

const waitT = () => {
    const randomTime = Math.floor(Math.random() * 5) + 1; // Genera un número aleatorio entre 1 y 5
    console.log(`Esperando por ${randomTime} segundos...`);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(randomTime * 1000); // Convierte a milisegundos (1-5 segundos)
        }, randomTime * 1000); // Tiempo aleatorio entre 1 y 5 segundos
    });
};

// Crear un cliente de conexión a Turso
const pool = createClient({
    url: 'libsql://botdewhatsapp-xbladeyx.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MzAyNjgxNjIsImlkIjoiZGZkYjNkZTQtODMyNi00OTNjLWFiNTEtNzQ3Y2MwODcxOTBkIn0.rJpSFWsjzyXcT4XAWXC9djLl-EyU7wTnEc7p2ECPzRk3VwIaFa18apK7uTKzdO3j0XZsbb3EdfxLbq7PZ6pOCQ' // Reemplaza esto con tu token de acceso
});

//================================================================================================

// Función para obtener números de teléfono desde Turso
async function obtenerNumerosDeTelefonoDesdeDB() {
    const query = 'SELECT telefono FROM usuarios';
    try {
        const results = await pool.execute(query);
        const telefonos = results.rows.map(result => result.telefono); // Acceso correcto a los datos
        console.log('Números de teléfono obtenidos desde Turso:', telefonos);
        return telefonos;
    } catch (error) {
        console.error('Error al obtener números de teléfono desde Turso:', error);
        throw error;
    }
}

// Función para enviar mensajes con reintentos
async function enviarMensajeConReintentos(provider, remoteJid, message, intentos = 3) {
    try {
        console.log(`Intentando enviar mensaje a ${remoteJid}: ${message}`);
        await provider.sendMessage(remoteJid, { text: message });
        console.log(`Mensaje enviado exitosamente a ${remoteJid}: ${message}`);
        const delay = Math.floor(Math.random() * (120000 - 10000 + 1)) + 10000;
        await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
        console.error(`Error al enviar el mensaje a ${remoteJid}:`, error);
        if (intentos > 0) {
            console.log(`Reintentando (${intentos} intentos restantes)...`);
            await enviarMensajeConReintentos(provider, remoteJid, message, intentos - 1);
        } else {
            console.error('No se pudo enviar el mensaje después de varios intentos.');
            throw error;
        }
    }
}

// Función para generar varias variaciones de un mensaje en una sola consulta
async function generarVariacionesConGemini(mensaje: string, cantidad: number = 10) {
    const variaciones = [];

    // Modificamos el mensaje que se le pasa a Gemini para generar variaciones
    const mensajeConInstruccion = `${mensaje}\n\nPor favor, genera ${cantidad} variaciones de este mensaje, utilizando sinónimos y emoticones de forma natural y no me las enumere.`;

    // Realizamos una sola llamada a Gemini para generar las variaciones
    const respuestaGemini = await toAskGeminy(mensajeConInstruccion, []);
    
    // Aquí asumimos que la respuesta de Gemini es una lista de variaciones separadas por saltos de línea
    const variacionesGeneradas = respuestaGemini.split('\n\n');

    // Limitamos la cantidad de variaciones a la solicitada (en caso de que la respuesta sea más extensa)
    for (let i = 0; i < cantidad; i++) {
        variaciones.push(variacionesGeneradas[i] || `Variación ${i + 1} no generada.`);
    }

    // Escribir las variaciones en un archivo .txt
    const filePath = './variaciones.txt';
    const variacionesTexto = variaciones.join('\n\n'); // Unir las variaciones con saltos de línea
    writeFileSync(filePath, variacionesTexto, 'utf8');
    console.log(`Las ${cantidad} variaciones han sido guardadas en el archivo ${filePath}.`);

    return variaciones;
}

// Flujo de envío de mensajes con 10 variaciones
const flowBroadcast = addKeyword(['renny'])
    .addAnswer('📲 ¿Qué mensaje deseas enviar a tus clientes?', { capture: true }, async (ctx, { flowDynamic, provider }) => {
        try {
            const mensajeCapturado = ctx.body;
            console.log('Mensaje capturado:', mensajeCapturado);

            // Obtener una lista de números de teléfono
            const telefonos = await obtenerNumerosDeTelefonoDesdeDB();
            console.log('Números de teléfono obtenidos:', telefonos);

            const baileysProvider = await provider.getInstance();

            // Generar 10 variaciones del mensaje en una sola consulta
            const variaciones = await generarVariacionesConGemini(mensajeCapturado, 10);

            // Enviar las variaciones a los usuarios una por una
            for (let i = 0; i < telefonos.length; i++) {
                const telefono = telefonos[i];
                const fullPhoneNumber = `${telefono}@s.whatsapp.net`;

                // Seleccionar una variación aleatoria del mensaje
                const mensajeConVariacion = variaciones[Math.floor(Math.random() * variaciones.length)];

                // Enviar el mensaje a este usuario con su variación única
                await enviarMensajeConReintentos(baileysProvider, fullPhoneNumber, mensajeConVariacion);
            }

            // Eliminar el archivo de variaciones.txt después de enviar todos los mensajes
            const filePath = './variaciones.txt';
            unlinkSync(filePath);  // Borra el archivo

            console.log('Flujo de mensajes completado.');
            await flowDynamic(`Mensaje enviado a ${telefonos.length} clientes.`);
        } catch (error) {
            console.error('Error en el flujo de envío de mensajes:', error);
        }
    });


const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
        .addAction(async (ctx, { flowDynamic, provider }) => {
            try {
                const messageText = ctx.body  // Obtener el mensaje de texto
                await provider.vendor.sendPresenceUpdate('composing', ctx.key.remoteJid);
                await waitT(); // Espera 3 segundo
                // Verificar si el usuario pide una foto de los tenis
                if (messageText.includes('foto') || messageText.includes('imagen') || messageText.includes('zapatos nike') || messageText.includes('ver los')) {
                    // Actualizar presencia a "composing"
                    await provider.vendor.sendPresenceUpdate('composing', ctx.key.remoteJid);
                    await waitT(); // Espera 1 segundo
    
                    // Enviar la imagen de los tenis
                    await provider.sendImage(ctx.key.remoteJid, `${path.resolve()}/src/sendImage/1.png`, 'Zapatos Nike');
                    return;  // Terminar el flujo después de enviar la imagen
                }
    
                // Si no es una solicitud de imagen, generar respuesta con Gemini
                const geminiResponse = await toAskGemini(messageText, [])  // Usar el texto para generar una respuesta con Gemini
                console.log(geminiResponse)
    
                // Responder con el texto generado por Gemini
                const botResponse = geminiResponse || 'Lo siento, no pude generar una respuesta adecuada.'
                await flowDynamic(botResponse)  // Enviar respuesta de texto al usuario
    
            } catch (error) {
                console.error('Error en el procesamiento del mensaje de texto:', error)
                await flowDynamic([{ body: 'Lo siento, hubo un error procesando tu mensaje.' }])
            }
        })
    

        const voiceFlow = addKeyword<Provider, Database>(EVENTS.VOICE_NOTE)
        .addAction(async (ctx, { flowDynamic, provider }) => {
            try {
                const storagePath = join(process.cwd(), 'storage')
                await provider.vendor.sendPresenceUpdate('composing', ctx.key.remoteJid);
                await waitT(); // Espera 3 segundos
    
                // Guardar archivo de voz
                const ogaFilePath = await provider.saveFile(ctx, {
                    path: storagePath
                })
    
                // Crear el nombre del archivo WAV
                const wavFilePath = ogaFilePath.replace('.oga', '.wav')
    
                // Convertir OGA a WAV usando ffmpeg
                await new Promise((resolve, reject) => {
                    ffmpeg(ogaFilePath)
                        .toFormat('wav')
                        .on('end', () => {
                            console.log('Conversión completada')
                            resolve(true)
                        })
                        .on('error', (err: Error) => {
                            console.error('Error en la conversión:', err)
                            reject(err)
                        })
                        .save(wavFilePath)
                })
    
                console.log('Archivo convertido exitosamente:', wavFilePath)
    
                // Procesar el audio: convertir a texto
                const transcription = await fromAudioToText(wavFilePath)

                if (transcription.includes('foto') || transcription.includes('imagen') || transcription.includes('zapatos nike') || transcription.includes('ver los')) {
                    // Actualizar presencia a "composing"
                    await provider.vendor.sendPresenceUpdate('composing', ctx.key.remoteJid);
                    await waitT(); // Espera 1 segundo
    
                    // Enviar la imagen de los tenis
                    await provider.sendImage(ctx.key.remoteJid, `${path.resolve()}/src/sendImage/1.png`, 'Zapatos Nike');
                    return;  // Terminar el flujo después de enviar la imagen
                }
    
                // Generar la respuesta utilizando Gemini con la transcripción
                const geminiResponse = await toAskGemini(transcription, [])  // Usar la transcripción para generar una respuesta con Gemini
                console.log(geminiResponse)
    
                // Responder con el texto generado por Gemini
                const botResponse = geminiResponse || 'Lo siento, no pude generar una respuesta adecuada.'
                await flowDynamic(botResponse)  // Enviar respuesta de texto al usuario
    
                // Eliminar los archivos después de procesarlos
                fs.unlink(ogaFilePath, (err) => {
                    if (err) {
                        console.error('Error al eliminar el archivo OGA:', err);
                    } else {
                        console.log('Archivo OGA eliminado');
                    }
                });
    
                fs.unlink(wavFilePath, (err) => {
                    if (err) {
                        console.error('Error al eliminar el archivo WAV:', err);
                    } else {
                        console.log('Archivo WAV eliminado');
                    }
                });
    
            } catch (error) {
                console.error('Error en el procesamiento de audio:', error)
                await flowDynamic([{ body: 'Lo siento, hubo un error procesando el audio.' }])
            }
        })
    

/**
 * La función principal que arranca el bot
 */
const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, voiceFlow, flowBroadcast])  // Agregar el flujo de texto
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    // API endpoint para manejar mensajes
    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    // Iniciar el servidor en el puerto
    httpServer(+PORT)
}

main()
