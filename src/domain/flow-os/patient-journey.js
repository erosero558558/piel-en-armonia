const { loadFlowOsManifest } = require("./load-manifest.js");

function getStageMap() {
  const manifest = loadFlowOsManifest();

  return new Map(
    manifest.journeyStages.map((stage) => [stage.id, stage])
  );
}

function canTransition(fromStage, toStage) {
  const stageMap = getStageMap();
  const currentStage = stageMap.get(fromStage);

  if (!currentStage || !stageMap.has(toStage)) {
    return false;
  }

  return currentStage.allowedNext.includes(toStage);
}

function summarizeJourney(stageId) {
  const stageMap = getStageMap();
  const stage = stageMap.get(stageId);

  if (!stage) {
    throw new Error(`Unknown Flow OS journey stage: ${stageId}`);
  }

  return {
    stage: stage.id,
    label: stage.label,
    summary: stage.summary,
    isTerminal: stage.terminal,
    nextStages: stage.allowedNext
  };
}

module.exports = {
  canTransition,
  summarizeJourney
};
