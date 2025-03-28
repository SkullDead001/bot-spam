const { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason 
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const imagePath = 'imagen/img1.png';
const banner = `TEXTO DEL BANNER AQUÍ`;

let envioProgramadoIniciado = false;

async function startBot() {
  try {
    console.log("Obteniendo la versión más reciente de Baileys...");
    const { version } = await fetchLatestBaileysVersion();

    console.log("Cargando credenciales...");
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    console.log("Iniciando el cliente de WhatsApp...");
    const client = makeWASocket({
      auth: state,
      version
    });

    client.ev.on('creds.update', saveCreds);

    // Mostrar el QR en la terminal cuando se genere
    client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("Escanea este código QR para conectar:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode || 0;
        if (reason === DisconnectReason.loggedOut) {
          console.log('Usuario desconectado. Cerrando...');
          process.exit(0);
        }
        console.log('Conexión cerrada. Intentando reconectar en 5 segundos...');
        setTimeout(startBot, 5000);
      } else if (connection === 'open') {
        console.log('El bot está listo');
        iniciarEnvioProgramado(client);
      }
    });

    async function obtenerGrupos() {
      try {
        const grupos = await client.groupFetchAllParticipating();
        return Object.keys(grupos);
      } catch (error) {
        console.error('Error al obtener los grupos:', error);
        return [];
      }
    }

    async function enviarMensajesGrupos() {
      try {
        const groupChats = await obtenerGrupos();
        let media = null;

        try {
          media = await fs.promises.readFile(imagePath);
          console.log("Imagen encontrada y lista para enviar.");
        } catch {
          console.log("No se encontró la imagen, solo se enviará texto.");
        }

        for (const chatId of groupChats) {
          console.log(`Enviando mensaje al grupo: ${chatId}`);
          try {
            if (media) {
              await client.sendMessage(chatId, { 
                image: media, 
                caption: banner,
                footer: 'Selecciona una opción:',
                buttons: [
                  { buttonId: 'opcion1', buttonText: { displayText: 'Opción 1' }, type: 1 },
                  { buttonId: 'opcion2', buttonText: { displayText: 'Opción 2' }, type: 1 },
                  { buttonId: 'opcion3', buttonText: { displayText: 'Opción 3' }, type: 1 }
                ],
                headerType: 1
              });
            } else {
              await client.sendMessage(chatId, { 
                text: banner,
                footer: 'Selecciona una opción:',
                buttons: [
                  { buttonId: 'opcion1', buttonText: { displayText: 'Opción 1' }, type: 1 },
                  { buttonId: 'opcion2', buttonText: { displayText: 'Opción 2' }, type: 1 },
                  { buttonId: 'opcion3', buttonText: { displayText: 'Opción 3' }, type: 1 }
                ],
                headerType: 1
              });
            }
          } catch (error) {
            console.error(`Error al enviar mensaje al grupo ${chatId}:`, error);
          }
        }

        console.log("Se enviaron los mensajes a todos los grupos.");
      } catch (error) {
        console.error('Error al enviar mensajes a los grupos:', error);
      }
    }

    function iniciarEnvioProgramado() {
      if (envioProgramadoIniciado) return;
      envioProgramadoIniciado = true;
      console.log("Iniciando el envío programado de mensajes...");
      enviarMensajesGrupos();
      setInterval(enviarMensajesGrupos, 3 * 60 * 60 * 1000); // Cada 3 horas
    }

    client.ev.on('messages.upsert', async ({ messages }) => {
      const message = messages[0];
      if (!message?.key?.remoteJid) return;

      // Manejo de botones
      if (message.message?.buttonsResponseMessage) {
        const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
        console.log(`El usuario seleccionó: ${buttonId}`);

        let respuesta = 'No entendí tu elección.';
        if (buttonId === 'opcion1') respuesta = 'Elegiste la opción 1.';
        if (buttonId === 'opcion2') respuesta = 'Elegiste la opción 2.';
        if (buttonId === 'opcion3') respuesta = 'Elegiste la opción 3.';

        await client.sendMessage(message.key.remoteJid, { text: respuesta });
        return;
      }

      // Responder mensajes privados
      if (!message.key.remoteJid.includes('@g.us') && !message.key.fromMe) {
        console.log(`Recibiendo mensaje privado de: ${message.key.remoteJid}`);
        await client.sendMessage(
          message.key.remoteJid,
          { text: 'AQUI VA EL MENSAJE EN CASO DE QUE LE ESCRIBAN AL PRIVADO' }
        );
      }
    });

  } catch (error) {
    console.error("Error al iniciar el bot:", error);
    console.log("Reintentando en 10 segundos...");
    setTimeout(startBot, 10000);
  }
}

startBot();
