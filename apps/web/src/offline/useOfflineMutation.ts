import { useMutation, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { HttpMethod } from "../api/client.js";
import { apiRequest, NetworkError } from "../api/client.js";
import { enqueue } from "./outbox.js";

export interface OfflineMutationResult<T> {
  queued: boolean;
  data?: T;
}

interface UseOfflineMutationOptions<TVariables> {
  method: HttpMethod;
  path: (vars: TVariables) => string;
  body?: (vars: TVariables) => unknown;
  entityLabel: (vars: TVariables) => string;
  /** Query keys to invalidate after a successful (non-queued) request. */
  invalidateKeys: (vars: TVariables) => QueryKey[];
  /** Optional: patch the cache immediately so the UI reflects the change even while queued offline. */
  optimisticUpdate?: (queryClient: QueryClient, vars: TVariables) => void;
}

/**
 * A mutation that queues itself for later instead of failing when the device
 * is offline. Used for the flows staff need mid-appointment with patchy wifi:
 * patients, appointments, treatment notes (see docs/architecture.md).
 */
export function useOfflineMutation<TVariables, TResponse = unknown>(
  options: UseOfflineMutationOptions<TVariables>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: TVariables): Promise<OfflineMutationResult<TResponse>> => {
      const path = options.path(vars);
      const body = options.body?.(vars);
      try {
        const data = await apiRequest<TResponse>(options.method, path, body);
        return { queued: false, data };
      } catch (err) {
        if (err instanceof NetworkError) {
          await enqueue({ method: options.method, path, body, entityLabel: options.entityLabel(vars) });
          return { queued: true };
        }
        throw err;
      }
    },
    onSuccess: (result, vars) => {
      if (options.optimisticUpdate) {
        options.optimisticUpdate(queryClient, vars);
      }
      if (!result.queued) {
        for (const key of options.invalidateKeys(vars)) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });
}
