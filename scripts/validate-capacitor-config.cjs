const { config } = require("dotenv");
const { resolve } = require("node:path");

config({ path: resolve(process.cwd(), ".env.local"), override: false, quiet: true });
config({ path: resolve(process.cwd(), ".env"), override: false, quiet: true });

const rawUrl = String(process.env.CAPACITOR_SERVER_URL || "").trim();
if (!rawUrl) {
  console.error("CAPACITOR_SERVER_URL não definido. Configure a URL do App Hosting em .env.local.");
  process.exit(1);
}

let target;
try {
  target = new URL(rawUrl);
} catch {
  console.error("CAPACITOR_SERVER_URL não é uma URL válida.");
  process.exit(1);
}

const localHosts = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);
const privateIpv4 = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const isLocal = localHosts.has(target.hostname) || privateIpv4.test(target.hostname);
if (target.protocol !== "https:" && !(target.protocol === "http:" && isLocal)) {
  console.error("CAPACITOR_SERVER_URL deve usar HTTPS fora do ambiente local.");
  process.exit(1);
}

console.log(`Capacitor configurado para ${target.origin}.`);
