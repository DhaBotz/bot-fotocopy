const {
  default: makeWASocket,
  useMultiFileAuthState,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys")

const fs = require("fs")
const sharp = require("sharp")

// =====================
// HARGA
// =====================
const HARGA = {
  bw: 500,
  color: 1000
}

// =====================
// AUTO STICKER
// =====================
async function createSticker(buffer) {
  return await sharp(buffer)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp()
    .toBuffer()
}

// =====================
// START BOT
// =====================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(".yud/session")

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  // =====================
  // CONNECTION
  // =====================
  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update

    if (qr) console.log("SCAN QR:", qr)

    if (connection === "open") {
      console.log("🤖 BOT FOTOCOPY PRO AKTIF")
    }
  })

  // =====================
  // HANDLER
  // =====================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.buttonsResponseMessage?.selectedButtonId ||
      msg.message.listResponseMessage?.singleSelectReply?.selectedRowId

    console.log("MSG:", text)

    // =====================
    // MENU
    // =====================
    if (text === "menu") {
      return await sock.sendMessage(from, {
        text: "📌 *AMIL JAYA FOTOCOPY*",
        buttons: [
          { buttonId: "harga", buttonText: { displayText: "💰 Harga" }, type: 1 },
          { buttonId: "order", buttonText: { displayText: "🛒 Order" }, type: 1 }
        ]
      })
    }

    // =====================
    // HARGA
    // =====================
    if (text === "harga") {
      return await sock.sendMessage(from, {
        text:
          "💰 *DAFTAR HARGA*\n\n" +
          `- BW: Rp${HARGA.bw}\n` +
          `- Color: Rp${HARGA.color}`
      })
    }

    // =====================
    // AUTO HARGA PRINT
    // =====================
    if (text && text.startsWith("print")) {
      const args = text.split(" ")
      const jumlah = parseInt(args[1]) || 0
      const jenis = args[2]

      const harga = HARGA[jenis] || 0
      const total = jumlah * harga

      return await sock.sendMessage(from, {
        text:
          `🧾 *STRUK FOTOCOPY*\n\n` +
          `Jenis: ${jenis}\n` +
          `Jumlah: ${jumlah}\n` +
          `Total: Rp${total}`
      })
    }

    // =====================
    // ORDER
    // =====================
    if (text === "order") {
      return await sock.sendMessage(from, {
        text: "📦 Kirim file atau foto untuk dicetak"
      })
    }

    // =====================
    // 📸 AUTO STICKER
    // =====================
    if (msg.message.imageMessage) {
      const stream = await downloadContentFromMessage(
        msg.message.imageMessage,
        "image"
      )

      let buffer = Buffer.from([])
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
      }

      const sticker = await createSticker(buffer)

      return await sock.sendMessage(from, {
        sticker: sticker
      })
    }
  })
}

startBot()
