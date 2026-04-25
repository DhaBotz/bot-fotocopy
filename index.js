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
// STICKER FUNCTION
// =====================
async function createSticker(buffer) {
  return await sharp(buffer)
    .resize(512, 512, { fit: "contain" })
    .webp()
    .toBuffer()
}

// =====================
// START BOT
// =====================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session")

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "22.04.4"]
  })

  sock.ev.on("creds.update", saveCreds)

  // =====================
  // CONNECTION
  // =====================
  sock.ev.on("connection.update", (u) => {
    const { connection, qr } = u

    if (qr) console.log("SCAN QR:", qr)

    if (connection === "open") {
      console.log("🤖 BOT FOTOCOPY PRO ONLINE")
    }

    if (connection === "close") {
      console.log("RECONNECT...")
      startBot()
    }
  })

  // =====================
  // MESSAGE HANDLER
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
        text:
          "📌 *AMIL JAYA FOTOCOPY*\n\n" +
          "menu:\n" +
          "- harga\n" +
          "- order\n" +
          "- print 10 bw"
      })
    }

    // =====================
    // HARGA
    // =====================
    if (text === "harga") {
      return await sock.sendMessage(from, {
        text:
          "💰 *HARGA*\n\n" +
          `BW: Rp${HARGA.bw}\n` +
          `Color: Rp${HARGA.color}`
      })
    }

    // =====================
    // AUTO HITUNG
    // =====================
    if (text && text.startsWith("print")) {
      const args = text.split(" ")

      const jumlah = parseInt(args[1]) || 0
      const jenis = args[2]

      const harga = HARGA[jenis] || 0
      const total = jumlah * harga

      return await sock.sendMessage(from, {
        text:
          `🧾 STRUK\n\n` +
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
        text: "📦 Kirim foto atau file untuk dicetak"
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
