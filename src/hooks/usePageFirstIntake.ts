/**
 * React Query hooks for the page-first document intake flow.
 *
 * Each hook wraps one API operation and keeps its own cache key so components
 * can subscribe independently and stay in sync without prop drilling.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiGetUploadPages,
  apiGetUploadPackets,
  apiPatchPageLabels,
  apiCreatePacket,
  apiPatchPacket,
  apiAttachPageToPacket,
  apiDetachPageFromPacket,
  apiRegroupUpload,
  apiPageSearch,
  apiPacketSearch,
} from "@/services/apiPageFirstIntake";
import type {
  PatchPageLabelsRequest,
  CreatePacketRequest,
  PatchPacketRequest,
  PageSearchParams,
  PacketSearchParams,
  DocumentPacketStatus,
} from "@/types/pageFirstIntake";

// ─────────────────────────────────────────────────────────────────────────────
// Cache keys
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_FIRST_KEYS = {
  pages: (uploadId: string) => ["page-first", "pages", uploadId] as const,
  packets: (uploadId: string) => ["page-first", "packets", uploadId] as const,
  pageSearch: (params: PageSearchParams) => ["page-first", "page-search", params] as const,
  packetSearch: (params: PacketSearchParams) => ["page-first", "packet-search", params] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Query hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all DocumentPage records for an upload. */
export function useUploadPages(uploadId: string | undefined) {
  return useQuery({
    queryKey: PAGE_FIRST_KEYS.pages(uploadId ?? ""),
    queryFn: () => apiGetUploadPages(uploadId!),
    enabled: !!uploadId,
    staleTime: 5_000,
  });
}

/** Fetch all DocumentPacket records (with joined pages) for an upload. */
export function useUploadPackets(uploadId: string | undefined) {
  return useQuery({
    queryKey: PAGE_FIRST_KEYS.packets(uploadId ?? ""),
    queryFn: () => apiGetUploadPackets(uploadId!),
    enabled: !!uploadId,
    staleTime: 5_000,
  });
}

/** Search DocumentPage records. */
export function usePageSearch(params: PageSearchParams, enabled = true) {
  return useQuery({
    queryKey: PAGE_FIRST_KEYS.pageSearch(params),
    queryFn: () => apiPageSearch(params),
    enabled,
    staleTime: 3_000,
  });
}

/** Search DocumentPacket records. */
export function usePacketSearch(params: PacketSearchParams, enabled = true) {
  return useQuery({
    queryKey: PAGE_FIRST_KEYS.packetSearch(params),
    queryFn: () => apiPacketSearch(params),
    enabled,
    staleTime: 3_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Update label metadata on a single DocumentPage. */
export function usePatchPageLabels(uploadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, updates }: { pageId: string; updates: PatchPageLabelsRequest }) =>
      apiPatchPageLabels(pageId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAGE_FIRST_KEYS.pages(uploadId) });
    },
  });
}

/** Create a new DocumentPacket from selected page IDs. */
export function useCreatePacket(uploadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePacketRequest) => apiCreatePacket(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAGE_FIRST_KEYS.packets(uploadId) });
    },
  });
}

/** Update packet metadata or status. */
export function usePatchPacket(uploadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packetId, updates }: { packetId: string; updates: PatchPacketRequest }) =>
      apiPatchPacket(packetId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAGE_FIRST_KEYS.packets(uploadId) });
    },
  });
}

/** Approve a packet (sets status = "approved"). */
export function useApprovePacket(uploadId: string) {
  const patchPacket = usePatchPacket(uploadId);
  return {
    ...patchPacket,
    mutateAsync: (packetId: string) =>
      patchPacket.mutateAsync({ packetId, updates: { status: "approved" as DocumentPacketStatus } }),
  };
}

/** Reject a packet (sets status = "rejected"). */
export function useRejectPacket(uploadId: string) {
  const patchPacket = usePatchPacket(uploadId);
  return {
    ...patchPacket,
    mutateAsync: (packetId: string) =>
      patchPacket.mutateAsync({ packetId, updates: { status: "rejected" as DocumentPacketStatus } }),
  };
}

/** Attach an existing page to a packet. */
export function useAttachPageToPacket(uploadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      packetId,
      pageId,
      relationshipType,
    }: {
      packetId: string;
      pageId: string;
      relationshipType?: string;
    }) => apiAttachPageToPacket(packetId, pageId, relationshipType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAGE_FIRST_KEYS.packets(uploadId) });
    },
  });
}

/** Detach a page from a packet. */
export function useDetachPageFromPacket(uploadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packetId, pageId }: { packetId: string; pageId: string }) =>
      apiDetachPageFromPacket(packetId, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAGE_FIRST_KEYS.packets(uploadId) });
    },
  });
}

/** Re-run the grouping engine. Refreshes the packets cache on success. */
export function useRegroupUpload(uploadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRegroupUpload(uploadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAGE_FIRST_KEYS.packets(uploadId) });
    },
  });
}
