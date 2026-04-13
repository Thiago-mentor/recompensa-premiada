import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { initializeApp as initializeAdminApp } from "../functions/node_modules/firebase-admin/lib/app/index.js";
import { getAuth as getAdminAuth } from "../functions/node_modules/firebase-admin/lib/auth/index.js";
import { getFirestore as getAdminFirestore } from "../functions/node_modules/firebase-admin/lib/firestore/index.js";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "premios-14238";
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
const authPort = 9099;
const firestorePort = 8080;
const functionsPort = 5001;
const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "southamerica-east1";

process.env.GCLOUD_PROJECT = projectId;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `${emulatorHost}:${authPort}`;
process.env.FIRESTORE_EMULATOR_HOST = `${emulatorHost}:${firestorePort}`;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

initializeAdminApp({ projectId });
const adminAuth = getAdminAuth();
const adminDb = getAdminFirestore();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createClientApp(name) {
  const app = initializeApp(firebaseConfig, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${emulatorHost}:${authPort}`, {
    disableWarnings: true,
  });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, emulatorHost, firestorePort);
  const functions = getFunctions(app, region);
  connectFunctionsEmulator(functions, emulatorHost, functionsPort);
  return { auth, db, functions };
}

async function createSignedInUser({
  suffix,
  role,
  gems,
}) {
  const email = `${role}-${suffix}@test.local`;
  const password = "123456";
  const username = `${role}_${suffix}`;
  const nome = role === "admin" ? "Admin Teste" : "Comprador Teste";
  const client = createClientApp(`${role}-${suffix}`);
  const credential = await createUserWithEmailAndPassword(client.auth, email, password);
  if (role === "admin") {
    await adminAuth.setCustomUserClaims(credential.user.uid, { admin: true });
    await signInWithEmailAndPassword(client.auth, email, password);
    await client.auth.currentUser?.getIdToken(true);
  }
  await adminDb.doc(`users/${credential.user.uid}`).set({
    uid: credential.user.uid,
    nome,
    username,
    gems,
    coins: 0,
    rewardBalance: 0,
    banido: false,
  });
  return {
    ...client,
    uid: credential.user.uid,
    email,
    username,
    nome,
  };
}

async function run() {
  const suffix = `${Date.now()}`;
  const admin = await createSignedInUser({ suffix, role: "admin", gems: 0 });
  const buyer = await createSignedInUser({ suffix, role: "buyer", gems: 500 });

  const adminDrawRaffle = httpsCallable(admin.functions, "adminDrawRaffle");
  const purchaseRaffleNumbers = httpsCallable(buyer.functions, "purchaseRaffleNumbers");
  const listMyRafflePurchases = httpsCallable(buyer.functions, "listMyRafflePurchases");
  const raffleId = `raffle-test-${suffix}`;

  await adminDb.doc(`raffles/${raffleId}`).set({
    title: `Sorteio teste ${suffix}`,
    description: "Fluxo automatizado do emulador",
    status: "active",
    releasedCount: 100,
    nextSequentialNumber: 0,
    soldCount: 0,
    soldTicketsRevenue: 0,
    ticketPrice: 1,
    maxPerPurchase: 100,
    prizeCurrency: "coins",
    prizeAmount: 100,
    prizeImageUrl: null,
    allocationMode: "random",
    soldBits: Buffer.alloc(Math.ceil(100 / 8), 0),
    startsAt: new Date(Date.now() - 60_000),
    endsAt: null,
    scheduleMode: "until_sold_out",
    closedAt: null,
    resultScheduledAt: null,
    drawnAt: null,
    paidAt: null,
    winningNumber: null,
    winnerUserId: null,
    winnerPurchaseId: null,
    winnerName: null,
    winnerUsername: null,
    instantPrizeTiers: [{ quantity: 2, amount: 15, currency: "rewardBalance", awardedCount: 0 }],
    instantPrizeHits: [],
    noWinnerPolicy: "no_payout_close",
    drawTimeZone: "America/Sao_Paulo",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const purchaseRes = await purchaseRaffleNumbers({
    raffleId,
    quantity: 100,
    clientRequestId: `req-${suffix}`,
  });

  const purchasedRaffle = purchaseRes.data?.raffle;
  const purchase = purchaseRes.data?.purchase;

  assert(purchasedRaffle?.status === "closed", "O sorteio deveria fechar ao esgotar os números.");
  assert(
    Array.isArray(purchase?.instantPrizeHits) && purchase.instantPrizeHits.length === 2,
    "A compra deveria encontrar 2 números premiados.",
  );
  assert(
    typeof purchasedRaffle?.resultScheduledAtMs === "number",
    "A data do resultado da Federal deveria ser agendada automaticamente.",
  );

  const buyerSnap = await getDoc(doc(buyer.db, "users", buyer.uid));
  const buyerData = buyerSnap.data();
  assert(buyerData, "Usuário comprador não encontrado no Firestore emulator.");
  assert(buyerData.gems === 400, `Saldo TICKET esperado: 400, recebido: ${buyerData.gems}`);
  assert(
    buyerData.rewardBalance === 30,
    `Saldo CASH esperado: 30, recebido: ${buyerData.rewardBalance}`,
  );

  const raffleSnap = await adminDb.doc(`raffles/${raffleId}`).get();
  const raffleDoc = raffleSnap.data();
  assert(raffleDoc, "Documento do sorteio não encontrado no Firestore emulator.");
  assert(
    Array.isArray(raffleDoc.instantPrizeHits) && raffleDoc.instantPrizeHits.length === 2,
    "O sorteio deveria persistir 2 números premiados encontrados.",
  );

  const listRes = await listMyRafflePurchases({
    raffleId,
    pageSize: 10,
    cursor: null,
  });
  assert(
    Array.isArray(listRes.data?.items) &&
      listRes.data.items[0]?.instantPrizeHits?.length === 2,
    "A listagem de compras deveria trazer os números premiados da compra.",
  );

  let drawBlocked = false;
  try {
    await adminDrawRaffle({
      raffleId,
      winningNumber: 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    drawBlocked = message.toLowerCase().includes("só pode ser lançado após");
  }
  assert(drawBlocked, "O lançamento do número oficial deveria ficar bloqueado antes da janela da Federal.");

  console.log(
    JSON.stringify(
      {
        ok: true,
        raffleId,
        statusAfterPurchase: purchasedRaffle.status,
        resultScheduledAtMs: purchasedRaffle.resultScheduledAtMs,
        instantPrizeHits: purchase.instantPrizeHits,
        buyerBalances: {
          gems: buyerData.gems,
          rewardBalance: buyerData.rewardBalance,
        },
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
