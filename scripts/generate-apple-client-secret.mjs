import jwt from "jsonwebtoken";
import fs from "fs";

const teamId = "X5UB8Q3ZVH";
const clientId = "com.wayne.petcare.auth";
const keyId = "4A8JHWPZAS";
const privateKeyPath = process.argv[2] || "./AuthKey_4A8JHWPZAS.p8";

if (!fs.existsSync(privateKeyPath)) {
  console.error(`[petcare] 找不到 .p8 私鑰檔案：${privateKeyPath}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, "utf8");
const now = Math.floor(Date.now() / 1000);

const token = jwt.sign(
  {
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 180,
    aud: "https://appleid.apple.com",
    sub: clientId,
  },
  privateKey,
  {
    algorithm: "ES256",
    keyid: keyId,
  }
);

console.log("[petcare] Apple Client Secret JWT generated.");
console.log("[petcare] Client ID:", clientId);
console.log("[petcare] Key ID:", keyId);
console.log("");
console.log(token);
