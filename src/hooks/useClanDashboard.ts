"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  subscribeClan,
  subscribeClanJoinRequests,
  subscribeClanMembers,
  subscribeClanMessages,
  subscribeMyClanJoinRequest,
  subscribeMyClanMembership,
} from "@/services/clans/clanService";
import type {
  Clan,
  ClanJoinRequest,
  ClanMember,
  ClanMembership,
  ClanMessage,
} from "@/types/clan";

function roleWeight(role: ClanMember["role"] | ClanMembership["role"]): number {
  if (role === "owner") return 0;
  if (role === "leader") return 1;
  return 2;
}

function timestampToMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

export function useClanDashboard() {
  const { user } = useAuth();
  const activeUserUid = user?.uid ?? null;
  const [membership, setMembership] = useState<ClanMembership | null>(null);
  const [clan, setClan] = useState<Clan | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [messages, setMessages] = useState<ClanMessage[]>([]);
  const [myJoinRequest, setMyJoinRequest] = useState<ClanJoinRequest | null>(null);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<ClanJoinRequest[]>([]);
  const [observedMembershipUid, setObservedMembershipUid] = useState<string | null>(null);
  const [loadedClanId, setLoadedClanId] = useState<string | null>(null);
  const [observedJoinRequestUid, setObservedJoinRequestUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const unsubscribe = subscribeMyClanMembership(user.uid, (nextMembership) => {
      setMembership(nextMembership);
      setObservedMembershipUid(user.uid);
      if (!nextMembership?.clanId) {
        setClan(null);
        setMembers([]);
        setMessages([]);
        setLoadedClanId(null);
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const unsubscribe = subscribeMyClanJoinRequest(user.uid, (nextRequest) => {
      setMyJoinRequest(nextRequest);
      setObservedJoinRequestUid(user.uid);
    });

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!membership?.clanId || membership.uid !== activeUserUid) return;

    const unsubClan = subscribeClan(membership.clanId, (nextClan) => {
      setClan(nextClan);
      setLoadedClanId(membership.clanId);
    });
    const unsubMembers = subscribeClanMembers(membership.clanId, setMembers);
    const unsubMessages = subscribeClanMessages(membership.clanId, setMessages);
    const unsubRequests =
      membership.role === "owner" || membership.role === "leader"
        ? subscribeClanJoinRequests(membership.clanId, setPendingJoinRequests)
        : () => {};

    return () => {
      unsubClan();
      unsubMembers();
      unsubMessages();
      unsubRequests();
    };
  }, [activeUserUid, membership?.clanId, membership?.role, membership?.uid]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const roleDiff = roleWeight(a.role) - roleWeight(b.role);
        if (roleDiff !== 0) return roleDiff;
        return timestampToMs(a.joinedAt) - timestampToMs(b.joinedAt);
      }),
    [members],
  );

  const myMember = useMemo(
    () => sortedMembers.find((item) => item.uid === activeUserUid) ?? null,
    [activeUserUid, sortedMembers],
  );
  const visibleMembership = membership?.uid === activeUserUid ? membership : null;
  const visibleMyJoinRequest = myJoinRequest?.userId === activeUserUid ? myJoinRequest : null;
  const visiblePendingJoinRequests =
    visibleMembership?.role === "owner" || visibleMembership?.role === "leader"
      ? pendingJoinRequests
      : [];
  const membershipLoading = Boolean(activeUserUid) && observedMembershipUid !== activeUserUid;
  const clanLoading = Boolean(visibleMembership?.clanId) && loadedClanId !== visibleMembership?.clanId;
  const joinRequestLoading =
    Boolean(activeUserUid) &&
    !visibleMembership?.clanId &&
    observedJoinRequestUid !== activeUserUid;
  const lastMessageMs = timestampToMs(clan?.lastMessageAt ?? null);
  const lastReadMs = timestampToMs(visibleMembership?.lastReadAt ?? null);
  const hasUnreadChat = Boolean(
    visibleMembership?.clanId &&
      clan?.id &&
      lastMessageMs > 0 &&
      lastMessageMs > lastReadMs,
  );
  const hasPendingJoinRequest = visibleMyJoinRequest?.status === "pending";
  const pendingJoinRequestsCount = visiblePendingJoinRequests.length;
  const hasPendingJoinRequests = pendingJoinRequestsCount > 0;
  const clanAccessBadge = hasPendingJoinRequest
    ? { label: "Pedido pendente", tone: "amber" as const }
    : hasPendingJoinRequests
      ? {
          label: pendingJoinRequestsCount === 1 ? "1 pedido" : `${pendingJoinRequestsCount} pedidos`,
          tone: "amber" as const,
        }
      : hasUnreadChat
        ? { label: "Novo chat", tone: "fuchsia" as const }
        : null;

  return {
    loading: activeUserUid ? membershipLoading || clanLoading || joinRequestLoading : false,
    hasClan: Boolean(visibleMembership?.clanId),
    membership: visibleMembership,
    clan: visibleMembership ? clan : null,
    members: visibleMembership ? sortedMembers : [],
    myMember: visibleMembership ? myMember : null,
    messages: visibleMembership ? messages : [],
    myJoinRequest: visibleMembership ? null : visibleMyJoinRequest,
    pendingJoinRequests: visiblePendingJoinRequests,
    hasPendingJoinRequest,
    hasPendingJoinRequests,
    pendingJoinRequestsCount,
    hasUnreadChat,
    clanAccessBadge,
    canManageClan: visibleMembership?.role === "owner" || visibleMembership?.role === "leader",
    isOwner: visibleMembership?.role === "owner",
  };
}
