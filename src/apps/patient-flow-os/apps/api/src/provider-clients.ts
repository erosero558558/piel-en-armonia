import type { TenantConfig, TenantProviderRuntimeBinding } from "../../../packages/core/src/index.js";
import { resolveTenantProviderRuntimeBinding } from "./provider-registry.js";
import { PermanentDispatchError, RetryableDispatchError } from "./provider-runtime.js";

export interface ProviderDispatchEnvelopeInput {
  tenant: TenantConfig;
  system: string;
  operation: string;
  idempotencyKey: string;
  localExternalRef: string | null;
}

export interface ProviderDispatchEnvelope {
  binding: TenantProviderRuntimeBinding;
  externalRef: string | null;
  metadata: Record<string, unknown>;
}

export interface ProviderDispatchTransportRequest {
  tenant: TenantConfig;
  binding: TenantProviderRuntimeBinding;
  system: string;
  operation: string;
  idempotencyKey: string;
  localExternalRef: string | null;
  operationRef: string;
  dispatchUrl: string;
  dispatchedAt: string;
}

export interface ProviderDispatchTransportResult {
  externalRef?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProviderDispatchTransport {
  dispatch(input: ProviderDispatchTransportRequest): Promise<ProviderDispatchTransportResult>;
}

interface ProviderDispatchHttpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

type ProviderDispatchFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<ProviderDispatchHttpResponse>;

export interface ProviderDispatchClientOptions {
  transport?: ProviderDispatchTransport;
}

export interface DefaultProviderDispatchTransportOptions {
  fetchImpl?: ProviderDispatchFetch;
  timeoutMs?: number;
}

const DEFAULT_PROVIDER_DISPATCH_TIMEOUT_MS = 10_000;

function nowIso(): string {
  return new Date().toISOString();
}

function buildOperationRef(input: ProviderDispatchEnvelopeInput, binding: TenantProviderRuntimeBinding): string {
  const anchor = input.localExternalRef ?? input.idempotencyKey;
  return `${binding.providerKey}:${input.operation}:${anchor}`;
}

function buildBlockedDispatchMessage(binding: TenantProviderRuntimeBinding): string {
  const issues = binding.dispatchIssues.join(", ");
  return `provider binding ${binding.providerKey} is blocked for ${binding.system}: ${issues}`;
}

function isPlaceholderProviderEndpoint(binding: TenantProviderRuntimeBinding): boolean {
  return typeof binding.endpointBaseUrl === "string" && binding.endpointBaseUrl.includes("providers.local");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const numericSeconds = Number(value);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return numericSeconds * 1_000;
  }

  const retryAt = new Date(value);
  if (Number.isNaN(retryAt.getTime())) {
    return null;
  }

  return Math.max(0, retryAt.getTime() - Date.now());
}

function extractPayloadField(payload: unknown, key: string): unknown {
  if (isRecord(payload) && key in payload) {
    return payload[key];
  }
  if (isRecord(payload) && isRecord(payload.data) && key in payload.data) {
    return payload.data[key];
  }
  return undefined;
}

async function readTransportPayload(response: ProviderDispatchHttpResponse): Promise<unknown> {
  const body = await response.text();
  if (body.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return { message: body };
  }
}

function buildBaseDispatchMetadata(input: {
  binding: TenantProviderRuntimeBinding;
  operationRef: string;
  localExternalRef: string | null;
  dispatchedAt: string;
  transportKind: string;
}): Record<string, unknown> {
  return {
    providerDeliveryMode: input.binding.dispatchMode === "relay" ? "provider_relay" : "local_stub",
    providerOperationRef: input.operationRef,
    providerLocalExternalRef: input.localExternalRef,
    providerTransportEndpoint: input.binding.endpointBaseUrl,
    providerTransportKind: input.transportKind,
    providerDispatchAcceptedAt: input.dispatchedAt
  };
}

export function createDefaultProviderDispatchTransport(
  options: DefaultProviderDispatchTransportOptions = {}
): ProviderDispatchTransport {
  const fetchImpl =
    options.fetchImpl ??
    (typeof globalThis.fetch === "function"
      ? (globalThis.fetch.bind(globalThis) as ProviderDispatchFetch)
      : null);
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_DISPATCH_TIMEOUT_MS;

  return {
    async dispatch(input) {
      if (!fetchImpl) {
        throw new RetryableDispatchError("global fetch is not available for provider relay dispatch");
      }

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

      let response: ProviderDispatchHttpResponse;
      try {
        response = await fetchImpl(input.dispatchUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-patient-flow-idempotency-key": input.idempotencyKey,
            "x-patient-flow-provider-key": input.binding.providerKey,
            "x-patient-flow-operation": input.operation
          },
          body: JSON.stringify({
            tenantId: input.tenant.id,
            tenantSlug: input.tenant.slug,
            system: input.system,
            operation: input.operation,
            idempotencyKey: input.idempotencyKey,
            localExternalRef: input.localExternalRef,
            operationRef: input.operationRef,
            providerKey: input.binding.providerKey,
            senderProfile: input.binding.senderProfile,
            dispatchedAt: input.dispatchedAt
          }),
          signal: controller?.signal
        });
      } catch (error) {
        if (timeout) {
          clearTimeout(timeout);
        }
        if (controller?.signal.aborted) {
          throw new RetryableDispatchError(
            `provider relay ${input.binding.providerKey} timed out for ${input.operation}`
          );
        }
        const message = error instanceof Error ? error.message : "provider relay network failure";
        throw new RetryableDispatchError(
          `provider relay ${input.binding.providerKey} failed for ${input.operation}: ${message}`
        );
      }

      if (timeout) {
        clearTimeout(timeout);
      }

      const payload = await readTransportPayload(response);
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const requestId =
        response.headers.get("x-request-id") ??
        response.headers.get("x-provider-request-id") ??
        (typeof extractPayloadField(payload, "requestId") === "string"
          ? String(extractPayloadField(payload, "requestId"))
          : null);
      const acceptedAt =
        (typeof extractPayloadField(payload, "acceptedAt") === "string"
          ? String(extractPayloadField(payload, "acceptedAt"))
          : null) ??
        response.headers.get("date") ??
        input.dispatchedAt;

      if (!response.ok) {
        const payloadMessage =
          typeof extractPayloadField(payload, "message") === "string"
            ? String(extractPayloadField(payload, "message"))
            : typeof extractPayloadField(payload, "error") === "string"
              ? String(extractPayloadField(payload, "error"))
              : `http ${response.status}`;
        const message =
          `provider relay ${input.binding.providerKey} rejected ${input.operation}: ${payloadMessage}`;
        if (response.status === 408 || response.status === 429 || response.status >= 500) {
          throw new RetryableDispatchError(message, { retryAfterMs });
        }
        throw new PermanentDispatchError(message);
      }

      const externalRef =
        typeof extractPayloadField(payload, "externalRef") === "string"
          ? String(extractPayloadField(payload, "externalRef"))
          : typeof extractPayloadField(payload, "operationRef") === "string"
            ? String(extractPayloadField(payload, "operationRef"))
            : input.operationRef;

      return {
        externalRef,
        metadata: {
          providerTransportKind: "http_relay",
          providerHttpStatus: response.status,
          providerHttpRequestId: requestId,
          providerDispatchAcceptedAt: acceptedAt,
          providerTransportStatus:
            typeof extractPayloadField(payload, "status") === "string"
              ? String(extractPayloadField(payload, "status"))
              : "accepted"
        }
      };
    }
  };
}

export function assertTenantProviderDispatchReady(
  tenant: TenantConfig,
  system: string
): TenantProviderRuntimeBinding {
  const binding = resolveTenantProviderRuntimeBinding(tenant, system);
  if (!binding.dispatchReady) {
    throw new PermanentDispatchError(buildBlockedDispatchMessage(binding));
  }
  return binding;
}

export async function dispatchThroughTenantProviderClient(
  input: ProviderDispatchEnvelopeInput,
  options: ProviderDispatchClientOptions = {}
): Promise<ProviderDispatchEnvelope> {
  const binding = assertTenantProviderDispatchReady(input.tenant, input.system);
  const operationRef = buildOperationRef(input, binding);
  const dispatchedAt = nowIso();

  if (binding.dispatchMode !== "relay" || !binding.endpointBaseUrl || isPlaceholderProviderEndpoint(binding)) {
    return {
      binding,
      externalRef: binding.dispatchMode === "relay" ? operationRef : input.localExternalRef,
      metadata: buildBaseDispatchMetadata({
        binding,
        operationRef,
        localExternalRef: input.localExternalRef,
        dispatchedAt,
        transportKind: binding.dispatchMode === "relay" ? "placeholder_relay" : "stub"
      })
    };
  }

  const transport = options.transport ?? createDefaultProviderDispatchTransport();
  const relayDispatch = await transport.dispatch({
    tenant: input.tenant,
    binding,
    system: input.system,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    localExternalRef: input.localExternalRef,
    operationRef,
    dispatchUrl: binding.endpointBaseUrl,
    dispatchedAt
  });

  return {
    binding,
    externalRef: relayDispatch.externalRef ?? operationRef,
    metadata: {
      ...buildBaseDispatchMetadata({
        binding,
        operationRef,
        localExternalRef: input.localExternalRef,
        dispatchedAt,
        transportKind: "http_relay"
      }),
      ...(relayDispatch.metadata ?? {})
    }
  };
}
