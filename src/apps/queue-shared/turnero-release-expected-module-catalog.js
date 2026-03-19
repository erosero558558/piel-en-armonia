export function buildTurneroReleaseExpectedModuleCatalog(input = {}) {
    const modules =
        Array.isArray(input.modules) && input.modules.length
            ? input.modules
            : [
                  {
                      key: 'release-control',
                      label: 'Release Control',
                      domain: 'governance',
                      surface: 'admin-queue',
                      priority: 'high',
                  },
                  {
                      key: 'assurance',
                      label: 'Assurance',
                      domain: 'assurance',
                      surface: 'admin-queue',
                      priority: 'high',
                  },
                  {
                      key: 'reliability',
                      label: 'Reliability',
                      domain: 'reliability',
                      surface: 'admin-queue',
                      priority: 'high',
                  },
                  {
                      key: 'service-excellence',
                      label: 'Service Excellence',
                      domain: 'service',
                      surface: 'admin-queue',
                      priority: 'medium',
                  },
                  {
                      key: 'safety-privacy',
                      label: 'Safety Privacy',
                      domain: 'privacy',
                      surface: 'admin-queue',
                      priority: 'high',
                  },
                  {
                      key: 'integration',
                      label: 'Integration',
                      domain: 'integration',
                      surface: 'admin-queue',
                      priority: 'high',
                  },
                  {
                      key: 'telemetry',
                      label: 'Telemetry',
                      domain: 'telemetry',
                      surface: 'admin-queue',
                      priority: 'medium',
                  },
                  {
                      key: 'strategy',
                      label: 'Strategy',
                      domain: 'strategy',
                      surface: 'admin-queue',
                      priority: 'medium',
                  },
                  {
                      key: 'orchestration',
                      label: 'Orchestration',
                      domain: 'orchestration',
                      surface: 'admin-queue',
                      priority: 'high',
                  },
                  {
                      key: 'diagnostic',
                      label: 'Diagnostic Prep',
                      domain: 'diagnostic',
                      surface: 'admin-queue',
                      priority: 'high',
                  },
              ];

    const rows = modules.map((module, index) => ({
        id: module.id || `expected-${index + 1}`,
        key: module.key || `expected-${index + 1}`,
        label: module.label || `Expected Module ${index + 1}`,
        domain: module.domain || 'general',
        surface: module.surface || 'admin-queue',
        priority: module.priority || 'medium',
    }));

    return {
        rows,
        summary: {
            all: rows.length,
            high: rows.filter((row) => row.priority === 'high').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
