"use client";

import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase/client";
import { CALLABLES } from "./names";

export async function callFunction<TReq extends Record<string, unknown>, TRes>(
  name: keyof typeof CALLABLES,
  data: TReq,
): Promise<HttpsCallableResult<TRes>> {
  const fn = httpsCallable(getFirebaseFunctions(), CALLABLES[name]);
  return fn(data) as Promise<HttpsCallableResult<TRes>>;
}
