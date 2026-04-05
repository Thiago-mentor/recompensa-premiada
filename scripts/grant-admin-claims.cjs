/**
 * Define custom claim admin: true no Firebase Auth (produção).
 *
 * Uso (PowerShell — aspas no caminho se tiver espaços):
 *   node scripts/grant-admin-claims.cjs "C:\caminho\premios-14238-....json" UID1 UID2
 *
 * Ou com npm:
 *   npm run grant-admin -- "C:\caminho\chave.json" UID1 UID2
 */

const path = require("node:path");

const functionsDir = path.join(__dirname, "..", "functions");
const nm = path.join(functionsDir, "node_modules");

let admin;
try {
  const pkg = require(path.join(nm, "firebase-admin"));
  admin = pkg.default || pkg;
} catch {
  console.error("Dependência ausente. Rode: cd functions && npm install");
  process.exit(1);
}

const keyPath = process.argv[2];
const uids = process.argv.slice(3).filter(Boolean);

if (!keyPath || uids.length === 0) {
  console.error(
    'Uso: node scripts/grant-admin-claims.cjs "C:\\caminho\\serviceAccount.json" <UID> [UID2 ...]',
  );
  process.exit(1);
}

const resolvedKey = path.resolve(keyPath);
let serviceAccount;
try {
  serviceAccount = require(resolvedKey);
} catch (e) {
  console.error("Não foi possível ler a chave:", resolvedKey);
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  for (const uid of uids) {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    const u = await admin.auth().getUser(uid);
    console.log("OK admin:", uid, u.email ? `(${u.email})` : "");
  }
  console.log("\nPeça para cada usuário sair e entrar de novo no app para atualizar o token.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
