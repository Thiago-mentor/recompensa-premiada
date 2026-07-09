"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { buildHomeClanCardModel } from "@/lib/clan/ui";
import {
  subscribeClan,
  subscribeClanRankingBoard,
  subscribeMyClanMembership,
} from "@/services/clans/clanService";
import type { Clan, ClanMembership } from "@/types/clan";

export function useHomeClanCard() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [membership, setMembership] = useState<ClanMembership | null>(null);
  const [membershipObservedFor, setMembershipObservedFor] = useState<string | null>(null);
  const [clan, setClan] = useState<Clan | null>(null);
  const [loadedClanId, setLoadedClanId] = useState<string | null>(null);
  const [board, setBoard] = useState<Clan[]>([]);

  useEffect(() => {
    if (!uid) {
      return;
    }
    return subscribeMyClanMembership(uid, (next) => {
      setMembership(next);
      setMembershipObservedFor(uid);
    });
  }, [uid]);

  useEffect(() => {
    const clanId = membership?.clanId;
    if (!clanId) {
      return;
    }
    return subscribeClan(clanId, (next) => {
      setClan(next);
      setLoadedClanId(clanId);
    });
  }, [membership?.clanId]);

  useEffect(() => {
    return subscribeClanRankingBoard(setBoard);
  }, []);

  const membershipLoading = Boolean(uid) && membershipObservedFor !== uid;
  const activeMembership = membershipObservedFor === uid ? membership : null;
  const activeClanId = activeMembership?.clanId;
  const clanLoading = Boolean(activeClanId) && loadedClanId !== activeClanId;
  const activeClan = loadedClanId === activeClanId ? clan : null;

  return useMemo(
    () =>
      buildHomeClanCardModel({
        membershipLoading,
        clanLoading,
        membership: activeMembership,
        clan: activeClan,
        board,
      }),
    [membershipLoading, clanLoading, activeMembership, activeClan, board],
  );
}
