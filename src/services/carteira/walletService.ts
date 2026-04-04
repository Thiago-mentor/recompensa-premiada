"use client";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants/collections";
import type { WalletTransaction, WalletTransactionType } from "@/types/wallet";

export function subscribeWalletTransactions(
  userId: string,
  opts: { pageSize?: number; tipo?: WalletTransactionType | null },
  onNext: (rows: WalletTransaction[]) => void,
): Unsubscribe {
  const page = opts.pageSize ?? 40;
  const base = collection(getFirebaseFirestore(), COLLECTIONS.walletTransactions);
  const q =
    opts.tipo != null
      ? query(
          base,
          where("userId", "==", userId),
          where("tipo", "==", opts.tipo),
          orderBy("criadoEm", "desc"),
          limit(page),
        )
      : query(base, where("userId", "==", userId), orderBy("criadoEm", "desc"), limit(page));
  return onSnapshot(q, (snap) => {
    onNext(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WalletTransaction),
    );
  });
}
