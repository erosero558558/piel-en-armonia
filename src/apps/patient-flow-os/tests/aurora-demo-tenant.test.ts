import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { createBootstrapState, InMemoryPlatformRepository } from "../apps/api/src/state.js";
import {
  buildClinicDashboardProjection,
  buildPatientFlowLinkProjection,
  buildWaitRoomDisplayProjection
} from "../apps/api/src/surfaces.js";

const require = createRequire(import.meta.url);
const {
  listJourneyStages,
  resolveCaseStatusStage
} = require("../../../../src/domain/flow-os/patient-journey.js") as {
  listJourneyStages: () => Array<{ id: string }>;
  resolveCaseStatusStage: (status: string) => { id: string } | null;
};

test("Aurora Derm demo tenant spans the paid-pilot stages across the canonical Flow OS surfaces", () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantBySlug("aurora-derm");
  assert.ok(tenant);

  const location = repository.getLocationBySlug(tenant.id, "aurora-main");
  const bookedSnapshot = repository.getPatientCaseSnapshot(tenant.id, "case_aurora_003");
  const snapshots = repository.listPatientCaseSnapshots(tenant.id);
  assert.ok(location);
  assert.ok(bookedSnapshot);

  const expectedStages = listJourneyStages()
    .map((stage) => stage.id)
    .sort();
  const observedStages = snapshots
    .map((snapshot) => resolveCaseStatusStage(snapshot.case.status)?.id ?? null)
    .filter((stageId): stageId is string => Boolean(stageId))
    .sort();

  assert.deepEqual(observedStages, expectedStages);

  const patientFlowProjection = buildPatientFlowLinkProjection(bookedSnapshot);
  const waitRoomProjection = buildWaitRoomDisplayProjection(tenant.id, location, snapshots);
  const dashboardProjection = buildClinicDashboardProjection(
    repository.getKpiReport(tenant.id),
    snapshots
  );

  assert.equal(patientFlowProjection.tenantId, tenant.id);
  assert.equal(patientFlowProjection.caseStatus, "booked");
  assert.equal(waitRoomProjection.tenantId, tenant.id);
  assert.equal(waitRoomProjection.locationId, location.id);
  assert.equal(waitRoomProjection.waiting.some((item) => item.caseId === "case_aurora_004"), true);
  assert.equal(dashboardProjection.tenantId, tenant.id);
  assert.equal(
    dashboardProjection.recentCases.some((item) => item.caseId === "case_aurora_005"),
    true
  );
});
