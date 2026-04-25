import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

// ====== DATA TOKO ======
const PRICE = {
  fotocopy: 200,
  warna: 500,
  print: 1000,
  laminating: 5000
};

// ====== STATE SEDERHANA (per user) ======
const carts = {}; // { jid: [ {item, qty, price, subtotal} ] }

// ====== HELPER ======
const formatRp = (n) => "Rp" + n.toLocaleString("id-ID");

function getCart(jid) {
  if (!carts[jid]) carts[jid] = [];
  return carts[jid];
}

function cartTotal(cart) {
  return cart.reduce((s, i) => s + i.subtotal, 0);
}

function cartText(cart) {
  if (cart.length === 0) return "🛒 Keranjang kosong";
  let t = "🛒 *Keranjang*\n";
  cart.forEach((i, idx) => {
    t += `${idx + 1}. ${i.item} x${i.qty} = ${formatRp(i.subtotal)}\n`;
  });
  t += `\nTotal: *${formatRp(cartTotal(cart))}*`;
  return t;
}

// ====== BOT ======
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("/session");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (u) => {
  const { connection, lastDisconnect, qr } = u;

  console.log("STATUS:", connection); // 🔥 ini penting

  if (qr) {
    console.log("\n📱 SCAN QR INI:\n");
    qrcode.generate(qr, { small: true });
  }

  if (connection === "open") {
    console.log("✅ Bot siap digunakan");
  }

  if (connection === "close") {
    console.log("🔁 Reconnecting...");
    const reconnect =
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
    if (reconnect) startBot();
  }
});
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    const m = text.trim().toLowerCase();

    // ====== MENU ======
    if (m === "menu") {
      await sock.sendMessage(jid, {
        text:
          "📄 *Amil Jaya Fotocopy*\n\n" +
          "Perintah:\n" +
          "• harga\n" +
          "• tambah <layanan> <jumlah>\n" +
          "• keranjang\n" +
          "• hapus <no_item>\n" +
          "• checkout\n" +
          "• bantuan\n\n" +
          "Contoh: tambah print 5"
      });
      return;
    }

    // ====== HARGA ======
    if (m === "harga") {
      await sock.sendMessage(jid, {
        text:
          "💰 *Daftar Harga:*\n" +
          `- fotocopy: ${formatRp(PRICE.fotocopy)}\n` +
          `- warna: ${formatRp(PRICE.warna)}\n` +
          `- print: ${formatRp(PRICE.print)}\n` +
          `- laminating: ${formatRp(PRICE.laminating)}`
      });
      return;
    }

    // ====== TAMBAH KE KERANJANG ======
    if (m.startsWith("tambah ")) {
      const [, item, qtyStr] = m.split(" ");
      const qty = parseInt(qtyStr);

      if (!PRICE[item] || isNaN(qty) || qty <= 0) {
        await sock.sendMessage(jid, {
          text: "❌ Format salah.\nContoh: tambah print 5"
        });
        return;
      }

      const cart = getCart(jid);
      const price = PRICE[item];
      const subtotal = price * qty;

      cart.push({ item, qty, price, subtotal });

      await sock.sendMessage(jid, {
        text:
          `✅ Ditambahkan: ${item} x${qty}\n` +
          `${cartText(cart)}`
      });
      return;
    }

    // ====== LIHAT KERANJANG ======
    if (m === "keranjang") {
      const cart = getCart(jid);
      await sock.sendMessage(jid, { text: cartText(cart) });
      return;
    }

    // ====== HAPUS ITEM ======
    if (m.startsWith("hapus ")) {
      const idx = parseInt(m.split(" ")[1]) - 1;
      const cart = getCart(jid);

      if (isNaN(idx) || idx < 0 || idx >= cart.length) {
        await sock.sendMessage(jid, { text: "❌ Nomor item tidak valid" });
        return;
      }

      const removed = cart.splice(idx, 1)[0];
      await sock.sendMessage(jid, {
        text:
          `🗑️ Dihapus: ${removed.item}\n` +
          `${cartText(cart)}`
      });
      return;
    }

    // ====== CHECKOUT ======
    if (m === "checkout") {
      const cart = getCart(jid);
      if (cart.length === 0) {
        await sock.sendMessage(jid, { text: "🛒 Keranjang masih kosong" });
        return;
      }

      const total = cartTotal(cart);
      const now = new Date();
      const id = "TRX" + now.getTime().toString().slice(-6);

      let struk =
        "🧾 *STRUK PEMBELIAN*\n" +
        `ID: ${id}\n` +
        `Tanggal: ${now.toLocaleString("id-ID")}\n\n`;

      cart.forEach((i, idx) => {
        struk += `${idx + 1}. ${i.item} x${i.qty} = ${formatRp(i.subtotal)}\n`;
      });

      struk += `\nTotal: *${formatRp(total)}*\n\nTerima kasih 🙏`;

      // kirim struk
      await sock.sendMessage(jid, { text: struk });

      // kosongkan keranjang
      carts[jid] = [];

      // (opsional) notifikasi admin:
      // await sock.sendMessage("628xxxx@s.whatsapp.net", { text: struk });

      return;
    }

    // ====== BANTUAN ======
    if (m === "bantuan") {
      await sock.sendMessage(jid, {
        text:
          "📌 *Panduan:*\n" +
          "• tambah print 5\n" +
          "• keranjang\n" +
          "• hapus 1\n" +
          "• checkout\n\n" +
          "Layanan: fotocopy, warna, print, laminating"
      });
      return;
    }
  });
}

startBot();
