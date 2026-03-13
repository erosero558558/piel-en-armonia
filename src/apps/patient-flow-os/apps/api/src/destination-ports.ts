import type {
  AgentAction,
  Appointment,
  ConversationThread,
  CopilotExecutionReceipt,
  PatientCaseAction,
  PatientCaseApproval,
  PatientCaseSnapshot,
  TenantConfig,
  PersistedPreparedAction,
  QueueTicket
} from "../../../packages/core/src/index.js";
import { buildProviderReceiptMetadata } from "./provider-registry.js";
import {
  assertTenantProviderDispatchReady,
  createDefaultProviderDispatchTransport,
  dispatchThroughTenantProviderClient
} from "./provider-clients.js";
import type { ProviderDispatchTransport } from "./provider-clients.js";
import type { PlatformRepository } from "./state.js";

function nowIso(): string {
  return new Date().toISOString();
}

function latestAppointment(snapshot: PatientCaseSnapshot): Appointment | undefined {
  return snapshot.appointments
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function liveQueueTicket(snapshot: PatientCaseSnapshot): QueueTicket | undefined {
  return snapshot.queueTickets.find((ticket) => ticket.status === "waiting")
    ?? snapshot.queueTickets.find((ticket) => ticket.status === "called")
    ?? snapshot.queueTickets[0];
}

function pendingApproval(snapshot: PatientCaseSnapshot): PatientCaseApproval | undefined {
  return snapshot.approvals.find((approval) => approval.status === "pending");
}

function latestPendingAction(
  snapshot: PatientCaseSnapshot,
  candidates: readonly AgentAction[]
): PatientCaseAction | undefined {
  return snapshot.actions
    .filter((action) => action.status === "pending" && candidates.includes(action.action))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function preparedActionRationale(preparedAction: PersistedPreparedAction): string {
  const payloadRationale = preparedAction.payloadDraft.rationale;
  if (typeof payloadRationale === "string" && payloadRationale.trim().length > 0) {
    return payloadRationale;
  }

  const preconditions = preparedAction.preconditions
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (preconditions.length > 0) {
    return preconditions.join(" ");
  }

  return preparedAction.title;
}

export interface DispatchPortContext {
  tenantId: string;
  caseId: string;
  snapshot: PatientCaseSnapshot;
  preparedAction: PersistedPreparedAction;
  actorId: string;
}

export interface QueueDispatchPort {
  callNextPatient(input: DispatchPortContext): Promise<{ ticket: QueueTicket; receipt: CopilotExecutionReceipt }>;
  startCheckIn(input: DispatchPortContext): Promise<{ appointment: Appointment; receipt: CopilotExecutionReceipt }>;
}

export interface MessagingDispatchPort {
  sendOpsMessage(input: DispatchPortContext & {
    body: string;
    channelOverride?: ConversationThread["channel"];
  }): Promise<{
    thread: ConversationThread;
    receipt: CopilotExecutionReceipt;
  }>;
}

export interface SchedulingDispatchPort {
  confirmAppointment(input: DispatchPortContext): Promise<{
    appointment: Appointment;
    receipt: CopilotExecutionReceipt;
  }>;
  requestReschedule(input: DispatchPortContext): Promise<{
    appointment: Appointment;
    receipt: CopilotExecutionReceipt;
  }>;
  recordBookingOptions(input: DispatchPortContext & { rationale: string }): Promise<{
    action: PatientCaseAction;
    receipt: CopilotExecutionReceipt;
  }>;
}

export interface PaymentsDispatchPort {
  recordApprovalFollowUp(input: DispatchPortContext & {
    rationale: string;
    messageUsed: string | null;
  }): Promise<{
    action: PatientCaseAction;
    approval: PatientCaseApproval;
    receipt: CopilotExecutionReceipt;
  }>;
}

export interface FollowUpDispatchPort {
  recordFollowUp(input: DispatchPortContext & {
    rationale: string;
    messageUsed: string | null;
  }): Promise<{
    action: PatientCaseAction;
    receipt: CopilotExecutionReceipt;
  }>;
}

export interface HandoffDispatchPort {
  createHandoff(input: DispatchPortContext & { rationale: string }): Promise<{
    action: PatientCaseAction;
    receipt: CopilotExecutionReceipt;
  }>;
}

export interface DestinationDispatchPorts {
  queue: QueueDispatchPort;
  messaging: MessagingDispatchPort;
  scheduling: SchedulingDispatchPort;
  payments: PaymentsDispatchPort;
  followUp: FollowUpDispatchPort;
  handoff: HandoffDispatchPort;
}

export function buildPreparedActionPortIdempotencyKey(
  preparedAction: PersistedPreparedAction,
  operation: string
): string {
  return `${preparedAction.destinationSystem}:${preparedAction.id}:${operation}`;
}

async function buildReceipt(
  input: {
  tenant: TenantConfig;
  system: string;
  operation: string;
  idempotencyKey: string;
  localExternalRef: string | null;
  metadata?: Record<string, unknown>;
  status?: "accepted" | "noop";
  },
  providerDispatchTransport: ProviderDispatchTransport
): Promise<CopilotExecutionReceipt> {
  const providerDispatch = await dispatchThroughTenantProviderClient({
    tenant: input.tenant,
    system: input.system,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    localExternalRef: input.localExternalRef
  }, {
    transport: providerDispatchTransport
  });

  return {
    system: input.system,
    operation: input.operation,
    status: input.status ?? "accepted",
    idempotencyKey: input.idempotencyKey,
    externalRef: providerDispatch.externalRef,
    recordedAt: nowIso(),
    metadata: {
      ...buildProviderReceiptMetadata(input.tenant, input.system),
      ...providerDispatch.metadata,
      ...(input.metadata ?? {})
    }
  };
}

function requireTenant(repository: PlatformRepository, tenantId: string): TenantConfig {
  const tenant = repository.getTenantById(tenantId);
  if (!tenant) {
    throw new Error(`tenant not found for dispatch receipt: ${tenantId}`);
  }
  return tenant;
}

function requireDispatchReady(
  repository: PlatformRepository,
  tenantId: string,
  system: string
): TenantConfig {
  const tenant = requireTenant(repository, tenantId);
  assertTenantProviderDispatchReady(tenant, system);
  return tenant;
}

export interface LocalDestinationDispatchPortsOptions {
  providerDispatchTransport?: ProviderDispatchTransport;
}

export function createLocalDestinationDispatchPorts(
  repository: PlatformRepository,
  options: LocalDestinationDispatchPortsOptions = {}
): DestinationDispatchPorts {
  const providerDispatchTransport =
    options.providerDispatchTransport ?? createDefaultProviderDispatchTransport();
  return {
    queue: {
      async callNextPatient(input) {
        const ticket = liveQueueTicket(input.snapshot);
        if (!ticket) {
          throw new Error("queue ticket not found for copilot execution");
        }
        const tenant = requireDispatchReady(repository, input.tenantId, "queue_console");

        const updatedTicket =
          ticket.status === "waiting"
            ? repository.callQueueTicket(input.tenantId, ticket.id, "staff", input.actorId)
            : ticket;

        return {
          ticket: updatedTicket,
          receipt: await buildReceipt({
            tenant,
            system: "queue_console",
            operation: "call_next_patient",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "call_next_patient"),
            localExternalRef: updatedTicket.id,
            metadata: {
              ticketNumber: updatedTicket.ticketNumber,
              queueStatus: updatedTicket.status
            },
            status: ticket.status === "waiting" ? "accepted" : "noop"
          }, providerDispatchTransport)
        };
      },
      async startCheckIn(input) {
        const appointment = latestAppointment(input.snapshot);
        if (!appointment) {
          throw new Error("appointment not found for copilot execution");
        }
        const tenant = requireDispatchReady(repository, input.tenantId, "queue_console");

        const updatedAppointment =
          appointment.status === "checked_in"
            ? appointment
            : repository.checkInAppointment(input.tenantId, appointment.id, "staff", input.actorId);

        return {
          appointment: updatedAppointment,
          receipt: await buildReceipt({
            tenant,
            system: "queue_console",
            operation: "start_check_in",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "start_check_in"),
            localExternalRef: updatedAppointment.id,
            metadata: {
              providerName: updatedAppointment.providerName,
              appointmentStatus: updatedAppointment.status
            },
            status: appointment.status === "checked_in" ? "noop" : "accepted"
          }, providerDispatchTransport)
        };
      }
    },
    messaging: {
      async sendOpsMessage(input) {
        const tenant = requireDispatchReady(repository, input.tenantId, "patient_messaging");
        const thread = repository.appendConversationMessage(
          input.tenantId,
          input.caseId,
          "staff",
          input.body,
          input.channelOverride
        );
        return {
          thread,
          receipt: await buildReceipt({
            tenant,
            system: "patient_messaging",
            operation: "send_ops_message",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "send_ops_message"),
            localExternalRef: thread.id,
            metadata: {
              channel: thread.channel,
              channelOverride: input.channelOverride ?? null,
              threadStatus: thread.status,
              messageLength: input.body.length
            }
          }, providerDispatchTransport)
        };
      }
    },
    scheduling: {
      async confirmAppointment(input) {
        const appointment = latestAppointment(input.snapshot);
        if (!appointment) {
          throw new Error("appointment not found for copilot execution");
        }
        const tenant = requireDispatchReady(repository, input.tenantId, "scheduling_workbench");

        const updatedAppointment =
          appointment.status === "confirmed"
            ? appointment
            : repository.confirmAppointment(input.tenantId, appointment.id, "staff", input.actorId);

        return {
          appointment: updatedAppointment,
          receipt: await buildReceipt({
            tenant,
            system: "scheduling_workbench",
            operation: "confirm_appointment",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "confirm_appointment"),
            localExternalRef: updatedAppointment.id,
            metadata: {
              providerName: updatedAppointment.providerName,
              appointmentStatus: updatedAppointment.status
            },
            status: appointment.status === "confirmed" ? "noop" : "accepted"
          }, providerDispatchTransport)
        };
      },
      async requestReschedule(input) {
        const appointment = latestAppointment(input.snapshot);
        if (!appointment) {
          throw new Error("appointment not found for copilot execution");
        }
        const tenant = requireDispatchReady(repository, input.tenantId, "scheduling_workbench");

        const updatedAppointment =
          appointment.status === "reschedule_requested"
            ? appointment
            : repository.requestReschedule(input.tenantId, appointment.id, "staff", input.actorId);

        return {
          appointment: updatedAppointment,
          receipt: await buildReceipt({
            tenant,
            system: "scheduling_workbench",
            operation: "request_reschedule",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "request_reschedule"),
            localExternalRef: updatedAppointment.id,
            metadata: {
              providerName: updatedAppointment.providerName,
              appointmentStatus: updatedAppointment.status
            },
            status: appointment.status === "reschedule_requested" ? "noop" : "accepted"
          }, providerDispatchTransport)
        };
      },
      async recordBookingOptions(input) {
        const tenant = requireDispatchReady(repository, input.tenantId, "scheduling_workbench");
        const action = repository.createCaseAction(input.tenantId, input.caseId, {
          action: "send_booking_options",
          title: "Booking options sent by Ops",
          rationale: input.rationale,
          channel: "ops",
          source: "ops",
          status: "completed"
        });

        return {
          action,
          receipt: await buildReceipt({
            tenant,
            system: "scheduling_workbench",
            operation: "record_booking_options",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "record_booking_options"),
            localExternalRef: action.id,
            metadata: {
              actionType: action.action,
              actionStatus: action.status
            }
          }, providerDispatchTransport)
        };
      }
    },
    payments: {
      async recordApprovalFollowUp(input) {
        const approval = pendingApproval(input.snapshot);
        if (!approval) {
          throw new Error("approval not found for copilot execution");
        }
        const tenant = requireDispatchReady(repository, input.tenantId, "payments_review_queue");

        const existingAction = latestPendingAction(input.snapshot, ["review_approval", "request_payment_followup"]);
        const action = existingAction
          ? repository.updateCaseActionStatus(input.tenantId, input.caseId, existingAction.id, "completed", input.actorId)
          : repository.createCaseAction(input.tenantId, input.caseId, {
              action: input.preparedAction.recommendedAction,
              title:
                input.preparedAction.recommendedAction === "review_approval"
                  ? "Approval reviewed by Ops"
                  : "Payment follow-up sent by Ops",
              rationale: input.messageUsed ?? input.rationale,
              channel: "ops",
              source: "ops",
              status: "completed"
            });

        return {
          action,
          approval,
          receipt: await buildReceipt({
            tenant,
            system: "payments_review_queue",
            operation: input.preparedAction.recommendedAction,
            idempotencyKey: buildPreparedActionPortIdempotencyKey(
              input.preparedAction,
              input.preparedAction.recommendedAction
            ),
            localExternalRef: action.id,
            metadata: {
              approvalId: approval.id,
              approvalType: approval.type,
              actionStatus: action.status
            }
          }, providerDispatchTransport)
        };
      }
    },
    followUp: {
      async recordFollowUp(input) {
        const tenant = requireDispatchReady(repository, input.tenantId, "ops_followup_queue");
        const pendingFollowUp = latestPendingAction(input.snapshot, ["send_follow_up", "recover_no_show"]);
        const action = pendingFollowUp
          ? repository.updateCaseActionStatus(input.tenantId, input.caseId, pendingFollowUp.id, "completed", input.actorId)
          : repository.createCaseAction(input.tenantId, input.caseId, {
              action: "send_follow_up",
              title: "Follow-up sent by Ops",
              rationale: input.messageUsed ?? input.rationale,
              channel: "ops",
              source: "ops",
              status: "completed"
            });

        return {
          action,
          receipt: await buildReceipt({
            tenant,
            system: "ops_followup_queue",
            operation: input.preparedAction.recommendedAction,
            idempotencyKey: buildPreparedActionPortIdempotencyKey(
              input.preparedAction,
              input.preparedAction.recommendedAction
            ),
            localExternalRef: action.id,
            metadata: {
              actionType: action.action,
              actionStatus: action.status
            }
          }, providerDispatchTransport)
        };
      }
    },
    handoff: {
      async createHandoff(input) {
        const tenant = requireDispatchReady(repository, input.tenantId, "ops_handoff_queue");
        const existingAction = latestPendingAction(input.snapshot, ["handoff_to_staff"]);
        const action = existingAction
          ?? repository.createCaseAction(input.tenantId, input.caseId, {
            action: "handoff_to_staff",
            title: "Hand off to staff",
            rationale: input.rationale,
            channel: "ops",
            requiresHumanApproval: true,
            source: "ops"
          });

        return {
          action,
          receipt: await buildReceipt({
            tenant,
            system: "ops_handoff_queue",
            operation: "handoff_to_staff",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "handoff_to_staff"),
            localExternalRef: action.id,
            metadata: {
              actionType: action.action,
              actionStatus: action.status
            },
            status: existingAction ? "noop" : "accepted"
          }, providerDispatchTransport)
        };
      }
    }
  };
}
