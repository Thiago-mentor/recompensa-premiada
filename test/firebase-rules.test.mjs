import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadString } from "firebase/storage";

function emulatorAddress(name, fallbackPort) {
  const raw = process.env[name] || `127.0.0.1:${fallbackPort}`;
  const separator = raw.lastIndexOf(":");
  return {
    host: raw.slice(0, separator),
    port: Number(raw.slice(separator + 1)),
  };
}

const firestore = emulatorAddress("FIRESTORE_EMULATOR_HOST", 8080);
const storage = emulatorAddress("FIREBASE_STORAGE_EMULATOR_HOST", 9199);
const environment = await initializeTestEnvironment({
  projectId: "rivaliza-rules-test",
  firestore: {
    ...firestore,
    rules: readFileSync("firestore.rules", "utf8"),
  },
  storage: {
    ...storage,
    rules: readFileSync("storage.rules", "utf8"),
  },
});

after(async () => {
  await environment.cleanup();
});

test("usuário lê apenas o próprio perfil e não altera economia", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/alice"), { uid: "alice", coins: 10 });
    await setDoc(doc(context.firestore(), "users/bob"), { uid: "bob", coins: 20 });
  });

  const aliceDb = environment.authenticatedContext("alice").firestore();
  await assertSucceeds(getDoc(doc(aliceDb, "users/alice")));
  await assertFails(getDoc(doc(aliceDb, "users/bob")));
  await assertFails(setDoc(doc(aliceDb, "users/alice"), { coins: 1 }, { merge: true }));
});

test("reservas de unicidade e rate limits são exclusivos do backend", async () => {
  const adminDb = environment.authenticatedContext("admin", { admin: true }).firestore();
  await assertFails(setDoc(doc(adminDb, "unique_usernames/alice"), { uid: "admin" }));
  await assertFails(setDoc(doc(adminDb, "referral_codes/ABC123"), { uid: "admin" }));
  await assertFails(setDoc(doc(adminDb, "rate_limits/test"), { count: 1 }));
});

test("custom claim de admin permite configuração, mas não saldo direto", async () => {
  const adminDb = environment.authenticatedContext("admin", { admin: true }).firestore();
  await assertSucceeds(setDoc(doc(adminDb, "system_configs/economy"), { welcomeBonus: 10 }));
  await assertFails(setDoc(doc(adminDb, "users/alice"), { coins: 999 }, { merge: true }));
});

test("Storage limita uploads ao namespace e tipo de imagem permitidos", async () => {
  const aliceStorage = environment.authenticatedContext("alice").storage();
  const bobStorage = environment.authenticatedContext("bob").storage();
  const avatar = ref(aliceStorage, "avatars/alice/avatar.png");

  await assertSucceeds(uploadString(avatar, "imagem", "raw", { contentType: "image/png" }));
  await assertSucceeds(getBytes(ref(bobStorage, "avatars/alice/avatar.png")));
  await assertFails(
    uploadString(ref(bobStorage, "avatars/alice/invasao.png"), "imagem", "raw", {
      contentType: "image/png",
    }),
  );
  await assertFails(
    uploadString(ref(aliceStorage, "avatars/alice/script.svg"), "<svg/>", "raw", {
      contentType: "image/svg+xml",
    }),
  );
  assert.ok(true);
});
