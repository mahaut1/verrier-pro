import net from "net";
import tls from "tls";
import fs from "fs";

// création de fichiers pour trouver le CA cert d'un serveur Postgres+SSL
const host = process.argv[2] || "mainline.proxy.rlwy.net";
const port = Number(process.argv[3] || 27013);

console.log(`🔗 Connexion TCP à ${host}:${port} + SSLRequest Postgres ...`);

// 8 octets: int32 length=8, int32 code=80877103 (0x04D2162F), big-endian
function buildPgSSLRequest() {
  const buf = Buffer.alloc(8);
  buf.writeInt32BE(8, 0);
  buf.writeInt32BE(80877103, 4);
  return buf;
}

const socket = net.connect({ host, port }, () => {
  socket.write(buildPgSSLRequest());
});

socket.setTimeout(10000);

socket.once("timeout", () => {
  console.error("❌ Timeout TCP avant handshake SSL.");
  socket.destroy();
  process.exit(1);
});

socket.once("error", (err) => {
  console.error("❌ TCP error:", err.message);
  process.exit(1);
});

socket.once("data", (chunk) => {
  // Réponse: 'S' (0x53) = OK TLS, 'N' = refus
  if (chunk.length < 1 || chunk[0] !== 0x53) {
    console.error("❌ Le serveur a refusé TLS (réponse != 'S').");
    socket.destroy();
    process.exit(1);
  }

  // On upgrade en TLS
  console.log("🔒 TLS accepté par le serveur, upgrade en cours ...");
  const tlsSocket = tls.connect({
    socket,
    servername: host,        // SNI
    rejectUnauthorized: false // on veut juste lire la chaîne
  });

  tlsSocket.once("secureConnect", () => {
    const leaf = tlsSocket.getPeerCertificate(true);
    if (!leaf || !Object.keys(leaf).length) {
      console.error("❌ Impossible de récupérer le certificat.");
      tlsSocket.end();
      process.exit(1);
    }

    // Reconstruire la chaîne via issuerCertificate
    const chain = [];
    let cur = leaf;
    const seen = new Set();
    while (cur && cur.raw && !seen.has(cur.fingerprint256)) {
      seen.add(cur.fingerprint256);
      const pem = "-----BEGIN CERTIFICATE-----\n" +
        cur.raw.toString("base64").match(/.{1,64}/g).join("\n") +
        "\n-----END CERTIFICATE-----\n";
      chain.push({ subject: cur.subject, issuer: cur.issuer, pem });
      cur = cur.issuerCertificate && cur.issuerCertificate !== cur
        ? cur.issuerCertificate
        : null;
    }

    const fullChainPem = chain.map(c => c.pem).join("");
    fs.writeFileSync("chain.pem", fullChainPem, "ascii");
    fs.writeFileSync("root.pem", chain.at(-1).pem, "ascii");
    console.log(`✅ Écrit: chain.pem (${chain.length} certs), root.pem`);

    // Variantes pour .env
    const rootEscaped = chain.at(-1).pem.replace(/\r?\n/g, "\\n");
    const base64 = Buffer.from(chain.at(-1).pem, "ascii").toString("base64");

    fs.writeFileSync("pg-ca-cert.env",
      `PG_CA_CERT="${rootEscaped}"\nPG_SSLMODE=verify-full\n`,
      "ascii"
    );
    fs.writeFileSync("pg-ca-cert-base64.env",
      `PG_CA_CERT_BASE64=${base64}\nPG_SSLMODE=verify-full\n`,
      "ascii"
    );

    console.log("📄 Écrit: pg-ca-cert.env (PEM échappé) et pg-ca-cert-base64.env");
    tlsSocket.end();
  });

  tlsSocket.once("error", (err) => {
    console.error("❌ TLS error:", err.message);
    process.exit(1);
  });
});
