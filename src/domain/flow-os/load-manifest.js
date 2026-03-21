const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.resolve(
  __dirname,
  "../../../data/flow-os/manifest.v1.json"
);

function loadFlowOsManifest() {
  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to load Flow OS manifest at ${MANIFEST_PATH}: ${error.message}`
    );
  }

  if (!Number.isFinite(parsed.version)) {
    throw new Error("Flow OS manifest is invalid: version must be numeric.");
  }

  if (!Array.isArray(parsed.journeyStages) || parsed.journeyStages.length === 0) {
    throw new Error(
      "Flow OS manifest is invalid: journeyStages must be a non-empty array."
    );
  }

  const knownStageIds = new Set();

  for (const stage of parsed.journeyStages) {
    if (!stage || typeof stage.id !== "string" || stage.id.length === 0) {
      throw new Error("Flow OS manifest is invalid: every stage needs a non-empty id.");
    }

    if (knownStageIds.has(stage.id)) {
      throw new Error(`Flow OS manifest is invalid: duplicate stage id "${stage.id}".`);
    }

    knownStageIds.add(stage.id);
  }

  for (const stage of parsed.journeyStages) {
    const allowedNext = Array.isArray(stage.allowedNext) ? stage.allowedNext : [];

    for (const nextStageId of allowedNext) {
      if (!knownStageIds.has(nextStageId)) {
        throw new Error(
          `Flow OS manifest is invalid: stage "${stage.id}" references unknown next stage "${nextStageId}".`
        );
      }
    }
  }

  return parsed;
}

module.exports = {
  loadFlowOsManifest
};
