/**
 * Remove users/{uid}.ultimaEntradaEm para permitir novo resgate no mesmo dia (data UTC, igual ao servidor).
 * Não desfaz coins/gems nem transações da carteira — só uso em desenvolvimento / testes.
 *
 * Uso:
 *   npm run reset:daily-login -- <UID_DO_FIREBASE_AUTH>
 *
 * Emulador Firestore:
 *   set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 *   set GCLOUD_PROJECT=premios-14238
 *   npm run reset:daily-login -- <UID>
 *
 * Projeto real (ADC ou JSON):
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\serviceAccount.json
 *   npm run reset:daily-login -- <UID>
 *
 * Banco Firestore nomeado (se usar):
 *   set FIRESTORE_DATABASE_ID=seu-database-id
 */

const path = require("node:path");

const functionsDir = path.join(__dirname, "..", "functions");
const nm = path.join(functionsDir, "node_modules");

let admin;
try {
  const pkg = require(path.join(nm, "firebase-admin"));
  admin = pkg.default || pkg;
} catch {
  console.error("Erro ao carregar firebase-admin. Rode: cd functions && npm install");
  process.exit(1);
}

const uid = process.argv[2] || process.env.RESET_DAILY_UID;
if (!uid || uid === "--help" || uid === "-h") {
  console.log(`
Recompensa Premiada — reset do “login diário” (campo ultimaEntradaEm)

  npm run reset:daily-login -- <UID>

Variáveis opcionais:
  RESET_DAILY_UID       UID se não passar na linha de comando
  GCLOUD_PROJECT        ID do projeto (default: premios-14238)
  FIRESTORE_EMULATOR_HOST   ex.: 127.0.0.1:8080
  GOOGLE_APPLICATION_CREDENTIALS   JSON da service account (produção)
  FIRESTORE_DATABASE_ID   se não for o database "(default)"
`);
  process.exit(uid ? 0 : 1);
}

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT_ID ||
  "premios-14238";

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const app = admin.app();
const dbId = process.env.FIRESTORE_DATABASE_ID?.trim();
const db =
  dbId && dbId !== "(default)" ? admin.firestore(app, dbId) : admin.firestore(app);

const FieldValue = admin.firestore.FieldValue;

async function main() {
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`Não existe documento users/${uid}`);
    process.exit(1);
  }

  await ref.update({
    ultimaEntradaEm: FieldValue.delete(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  console.log(`Feito: users/${uid} — campo ultimaEntradaEm removido.`);
  console.log("Você pode resgatar de novo (regra de data em UTC no servidor).");
  console.log("Obs.: saldo e extrato anteriores não foram alterados.");
}

main().catch((err) => {
  console.error(err.message || err);
  if (/Could not load the default credentials|credential/i.test(String(err.message))) {
    console.error(
      "\nConfigure credenciais: GOOGLE_APPLICATION_CREDENTIALS=...json ou use o emulador com FIRESTORE_EMULATOR_HOST.",
    );
  }
  process.exit(1);
});
