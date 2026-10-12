const qrcode = require("qrcode-terminal");
const { Client } = require("whatsapp-web.js");
const express = require("express");

const app = express();

app.use(express.json());

const PORT = 3000;
// const BOT_SECRET = process.env.BOT_SECRET;
const BOT_SECRET = "chave-teste";


// ==========================
// CONFIGURAÇÃO
// ==========================

if (!BOT_SECRET) {
  console.error("❌ BOT_SECRET não configurado.");
  process.exit(1);
}

let whatsappPronto = false;


// ==========================
// CLIENTE WHATSAPP
// ==========================

const client = new Client({

  puppeteer: {
    headless: true,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },

});


const delay = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );


// ==========================
// EVENTOS DO WHATSAPP
// ==========================

client.on("qr", (qr) => {

  console.log(
    "📲 Escaneie o QR Code abaixo:"
  );

  qrcode.generate(
    qr,
    {
      small: true,
    }
  );

});


client.on("authenticated", () => {

  console.log(
    "🔐 WhatsApp autenticado."
  );

});


client.on(
  "loading_screen",
  (percent, message) => {

    console.log(
      `⌛ Carregando: ${percent}% - ${message}`
    );

  }
);


client.on("ready", () => {

  whatsappPronto = true;

  console.log(
    "✅ WhatsApp conectado e bot pronto."
  );

});


client.on(
  "auth_failure",
  (mensagem) => {

    whatsappPronto = false;

    console.error(
      "❌ Falha na autenticação:",
      mensagem
    );

  }
);


client.on(
  "disconnected",
  (reason) => {

    whatsappPronto = false;

    console.log(
      "⚠️ WhatsApp desconectado:",
      reason
    );

  }
);


// ==========================
// ENVIO DE MENSAGEM
// ==========================

async function enviarMensagemHumanizada(
  grupoId,
  mensagem
) {

  if (!whatsappPronto) {

    throw new Error(
      "WhatsApp ainda não está conectado."
    );

  }


  console.log(
    `⏳ Preparando envio para: ${grupoId}`
  );


  const chat =
    await client.getChatById(grupoId);


  if (!chat.isGroup) {

    throw new Error(
      "O identificador informado não pertence a um grupo."
    );

  }


  // Pequeno intervalo antes de começar
  await delay(1500);


  // Mostra "digitando..."
  await chat.sendStateTyping();


  // Simula digitação por 5 segundos
  await delay(5000);


  // Para o estado de digitação
  await chat.clearState();


  // Envia a mensagem
  await chat.sendMessage(
    mensagem,
    {
      waitUntilMsgSent: true,
    }
  );


  console.log(
    `✉️ Mensagem enviada com sucesso para: ${grupoId}`
  );


  // Intervalo antes do próximo envio
  await delay(5000);

}


// ==========================
// STATUS DO BOT
// ==========================

app.get(
  "/status",
  (req, res) => {

    if (!whatsappPronto) {

      return res.status(503).json({
        pronto: false,
        mensagem:
          "WhatsApp ainda não está conectado.",
      });

    }


    return res.status(200).json({
      pronto: true,
      mensagem:
        "Bot conectado ao WhatsApp.",
    });

  }
);


// ==========================
// ENDPOINT USADO PELO SPRING
// ==========================

app.post(
  "/enviar-aviso",
  async (req, res) => {

    // ==========================
    // SEGREDO SPRING -> NODE
    // ==========================

    const secret =
      req.headers["x-bot-secret"];


    if (secret !== BOT_SECRET) {

      return res.status(401).json({
        sucesso: false,
        erro: "Chave inválida.",
      });

    }


    // ==========================
    // DADOS DO ENVIO
    // ==========================

    const {
      identificadorGrupo,
      mensagem,
    } = req.body;


    if (
      !identificadorGrupo ||
      !mensagem
    ) {

      return res.status(400).json({
        sucesso: false,
        erro:
          "identificadorGrupo e mensagem são obrigatórios.",
      });

    }


    // ==========================
    // WHATSAPP DISPONÍVEL?
    // ==========================

    if (!whatsappPronto) {

      return res.status(503).json({
        sucesso: false,
        erro:
          "WhatsApp ainda não está conectado.",
      });

    }


    // ==========================
    // TENTATIVA DE ENVIO
    // ==========================

    try {

      await enviarMensagemHumanizada(
        identificadorGrupo,
        mensagem
      );


      return res.status(200).json({
        sucesso: true,
      });


    } catch (error) {

      console.error(
        "❌ Erro ao enviar mensagem:",
        error
      );


      return res.status(500).json({
        sucesso: false,
        erro:
          error.message ||
          "Erro desconhecido ao enviar mensagem.",
      });

    }

  }
);


// ==========================
// COMANDO !idgrupo
// ==========================

client.on(
  "message",
  async (msg) => {

    if (msg.body !== "!idgrupo") {
      return;
    }


    try {

      const chat =
        await msg.getChat();


      if (!chat.isGroup) {

        await msg.reply(
          "Este comando deve ser usado dentro de um grupo."
        );

        return;
      }


      await msg.reply(
        `O ID deste grupo é:\n${msg.from}`
      );


    } catch (error) {

      console.error(
        "❌ Erro ao obter ID do grupo:",
        error
      );

    }

  }
);


// ==========================
// SERVIDOR HTTP
// ==========================

app.listen(
  PORT,
  () => {

    console.log(
      `🚀 API do bot rodando na porta ${PORT}`
    );

  }
);


// ==========================
// ENCERRAMENTO
// ==========================

process.on(
  "SIGINT",
  () => {

    console.log(
      "\n🛑 Bot encerrado."
    );

    whatsappPronto = false;

    process.exit(0);

  }
);


// ==========================
// INICIALIZAÇÃO WHATSAPP
// ==========================

client.initialize();