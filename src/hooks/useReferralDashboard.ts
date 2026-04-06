"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type {
  ReferralCampaign,
  ReferralRankingEntry,
  ReferralRankingPeriod,
  ReferralRecord,
  ReferralSystemConfig,
} from "@/types/referral";
import {
  fetchActiveReferralCampaign,
  fetchMyReferralRankingEntry,
  fetchReferralRankingTop,
  fetchReferralSystemConfig,
  subscribeInvitedReferrals,
  subscribeReferralAsInvited,
} from "@/services/referral/referralService";

export function useReferralDashboard(period: ReferralRankingPeriod) {
  const { user } = useAuth();
  const [config, setConfig] = useState<ReferralSystemConfig | null>(null);
  const [campaign, setCampaign] = useState<ReferralCampaign | null>(null);
  const [invitedRows, setInvitedRows] = useState<ReferralRecord[]>([]);
  const [myReferral, setMyReferral] = useState<ReferralRecord | null>(null);
  const [ranking, setRanking] = useState<ReferralRankingEntry[]>([]);
  const [myRanking, setMyRanking] = useState<ReferralRankingEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, activeCampaign] = await Promise.all([
          fetchReferralSystemConfig(),
          fetchActiveReferralCampaign(),
        ]);
        if (cancelled) return;
        setConfig(cfg);
        setCampaign(activeCampaign);
      } catch {
        if (cancelled) return;
        setConfig(null);
        setCampaign(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setInvitedRows([]);
      setMyReferral(null);
      return;
    }
    const unsubInvited = subscribeInvitedReferrals(user.uid, setInvitedRows);
    const unsubMine = subscribeReferralAsInvited(user.uid, setMyReferral);
    return () => {
      unsubInvited();
      unsubMine();
    };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const top = await fetchReferralRankingTop(period, 20);
        if (cancelled) return;
        setRanking(top);
      } catch {
        if (cancelled) return;
        setRanking([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    if (!user?.uid) {
      setMyRanking(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const entry = await fetchMyReferralRankingEntry(period, user.uid);
        if (cancelled) return;
        setMyRanking(entry);
      } catch {
        if (cancelled) return;
        setMyRanking(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, user?.uid]);

  return {
    config,
    campaign,
    invitedRows,
    myReferral,
    ranking,
    myRanking,
  };
}
