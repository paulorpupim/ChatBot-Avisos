const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  },
});

client.on("qr", (qr) => {
  console.log("📲 Escaneie o QR Code abaixo:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Tudo certo! WhatsApp conectado e API de disparo pronta.");
});

client.on("disconnected", (reason) => {
  console.log("⚠️ O WhatsApp foi desconectado:", reason);
});

client.initialize();

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function enviarMensagemHumanizada(grupoId, mensagemFormatada) {
  try {
    console.log(`⏳ [Background] Iniciando rotina humanizada para: ${grupoId}`);

    const chat = await client.getChatById(grupoId);

    await delay(1500);

    await chat.sendStateTyping();

    await delay(5000);

    await client.sendMessage(grupoId, mensagemFormatada);

    console.log(`✉️ [Background] Mensagem enviada com sucesso para: ${grupoId}`);
  } catch (error) {

    console.error("❌ [Background] Falha crítica ao enviar mensagem pelo WhatsApp:", error);
  }
}

app.post("/enviar-aviso", async (req, res) => {
  try {
    const { grupoId, titulo, descricao, dataEvento } = req.body;

    if (!grupoId || !titulo || !dataEvento) {
      return res.status(400).json({ error: "Dados obrigatórios ausentes (grupoId, titulo ou dataEvento)." });
    }

    const mensagemFormatada =
      `📢 *AVISO* 📢\n\n` +
      `🗓️ *Evento:* ${titulo}\n` +
      `📅 *Data/Hora:* ${dataEvento}\n\n` +
      `📝 *Descrição:* ${descricao || "Sem descrição informada."}`;

    enviarMensagemHumanizada(grupoId, mensagemFormatada);

    return res.status(202).json({ 
      status: "Sucesso", 
      message: "Evento salvo e aviso agendado para envio!" 
    });

  } catch (error) {
    console.error("❌ Erro na rota de envio:", error);
    return res.status(500).json({ error: "Ocorreu um erro interno ao processar a requisição." });
  }
});

client.on("message", async (msg) => {
  if (msg.body === "!idgrupo") {
    const chat = await msg.getChat();
    if (chat.isGroup) {
      await msg.reply(`O ID deste grupo é:\n${msg.from}`);
    }
  }
});

app.listen(3000, () => {
  console.log("🚀 Servidor Node pronto para receber ordens na porta 3000");
});
