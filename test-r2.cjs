// test-r2.cjs
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");

// On cherche d'abord .env.prod sinon fallback .env
const envFile = fs.existsSync(path.resolve(".env.prod"))
  ? ".env.prod"
  : ".env";

dotenv.config({ path: envFile });

console.log("Chargement du fichier:", envFile);

// Vérification des variables nécessaires
const required = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_S3_ENDPOINT",
];
for (const k of required) {
  if (!process.env[k]) {
    throw new Error(`❌ Missing env: ${k}`);
  }
}

console.log("🔑 Variables R2 chargées ok.");

// Création du client
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Test simple : HeadBucket
(async () => {
  try {
    await client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET }));
    console.log("✅ OK: connexion R2 réussie !");
  } catch (err) {
    console.error("❌ Erreur R2:", err);
  }
  console.log("Bucket:", process.env.R2_BUCKET);
console.log("Endpoint:", process.env.R2_S3_ENDPOINT);

})();
