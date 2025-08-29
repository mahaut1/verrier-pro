// test-r2.cjs (CommonJS pour éviter les soucis ESM/quotes)
const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");

(async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET }));
    console.log("R2 TLS/SDK OK (HeadBucket passée)");
  } catch (e) {
    console.error(
      "R2 SDK reachable but error:",
      e?.name,
      e?.$metadata?.httpStatusCode,
      e?.message
    );
  }
})();
