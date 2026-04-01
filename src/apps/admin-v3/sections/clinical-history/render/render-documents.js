import { getState, updateState } from '../../../shared/core/store.js';
import { setHtml, setText, escapeHtml, createToast, formatDateTime } from '../../../shared/ui/render.js';
import * as helpers from './index.js';

export function renderPrescriptionMedicationMirror(items) {
    return normalizePrescriptionItems(items)
        .filter(prescriptionItemStarted)
        .map((item) =>
            [item.medication, item.presentation].filter(Boolean).join(' ')
        )
        .filter(Boolean)
        .join('\n');
}

export function renderPrescriptionDirectionsMirror(items) {
    return normalizePrescriptionItems(items)
        .filter(prescriptionItemStarted)
        .map((item) => {
            const segments = [
                item.dose,
                item.route,
                item.frequency,
                item.duration,
                item.quantity ? `Cantidad ${item.quantity}` : '',
            ].filter(Boolean);
            const base = item.medication
                ? `${item.medication}: ${segments.join(' • ')}`
                : segments.join(' • ');
            return item.instructions
                ? [base, item.instructions].filter(Boolean).join('. ')
                : base;
        })
        .filter(Boolean)
        .join('\n');
}

export function buildPrescriptionItemEditor(item, index, disabled) {
    const safeItem = normalizePrescriptionItem(item);
    return `
        <article class="clinical-history-event-card" data-hcu005-prescription-item="${escapeHtml(
            String(index)
        )}">
            <div class="clinical-history-event-head">
                <span class="clinical-history-mini-chip">Prescripción ${escapeHtml(
                    String(index + 1)
                )}</span>
                <button
                    type="button"
                    class="clinical-history-mini-chip"
                    data-clinical-draft-action="remove-prescription-item"
                    data-prescription-index="${escapeHtml(String(index))}"
                    ${disabled ? 'disabled' : ''}
                >
                    Quitar
                </button>
            </div>
            ${helpers.buildClinicalHistoryInlineGrid([
                helpers.inputField(
                    `hcu005_prescription_${index}_medication`,
                    'Medicamento',
                    safeItem.medication,
                    {
                        placeholder: 'Nombre del medicamento',
                        disabled,
                    }
                ),
                helpers.inputField(
                    `hcu005_prescription_${index}_presentation`,
                    'Presentación',
                    safeItem.presentation,
                    {
                        placeholder: 'Tableta, crema, solución',
                        disabled,
                    }
                ),
            ])}
            ${helpers.buildClinicalHistoryInlineGrid([
                helpers.inputField(
                    `hcu005_prescription_${index}_dose`,
                    'Dosis',
                    safeItem.dose,
                    {
                        placeholder: '500 mg',
                        disabled,
                    }
                ),
                helpers.inputField(
                    `hcu005_prescription_${index}_route`,
                    'Vía',
                    safeItem.route,
                    {
                        placeholder: 'VO, tópica, IM',
                        disabled,
                    }
                ),
                helpers.inputField(
                    `hcu005_prescription_${index}_frequency`,
                    'Frecuencia',
                    safeItem.frequency,
                    {
                        placeholder: 'Cada 12 horas',
                        disabled,
                    }
                ),
            ])}
            ${helpers.buildClinicalHistoryInlineGrid([
                helpers.inputField(
                    `hcu005_prescription_${index}_duration`,
                    'Duración',
                    safeItem.duration,
                    {
                        placeholder: '7 días',
                        disabled,
                    }
                ),
                helpers.inputField(
                    `hcu005_prescription_${index}_quantity`,
                    'Cantidad',
                    safeItem.quantity,
                    {
                        placeholder: '14 tabletas',
                        disabled,
                    }
                ),
            ])}
            ${helpers.textareaField(
                `hcu005_prescription_${index}_instructions`,
                'Indicaciones',
                safeItem.instructions,
                {
                    rows: 3,
                    placeholder:
                        'Instrucciones detalladas para uso y seguimiento.',
                    disabled,
                }
            )}
        </article>
    `;
}

export function emptyPrescriptionItem() {
    return {
        medication: '',
        presentation: '',
        dose: '',
        route: '',
        frequency: '',
        duration: '',
        quantity: '',
        instructions: '',
    };
}

export function emptyPosology() {
    return {
        texto: '',
        baseCalculo: '',
        pesoKg: null,
        edadAnios: null,
        units: '',
        ambiguous: true,
    };
}

export function normalizePosology(posology) {
    const source = posology && typeof posology === 'object' ? posology : {};
    return {
        texto: helpers.normalizeString(source.texto),
        baseCalculo: helpers.normalizeString(source.baseCalculo),
        pesoKg: helpers.normalizeNullableFloat(source.pesoKg),
        edadAnios: helpers.normalizeNullableInt(source.edadAnios),
        units: helpers.normalizeString(source.units),
        ambiguous:
            source.ambiguous === undefined ? true : source.ambiguous === true,
    };
}

export function normalizePrescriptionItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        medication: helpers.normalizeString(source.medication),
        presentation: helpers.normalizeString(source.presentation),
        dose: helpers.normalizeString(source.dose),
        route: helpers.normalizeString(source.route),
        frequency: helpers.normalizeString(source.frequency),
        duration: helpers.normalizeString(source.duration),
        quantity: helpers.normalizeString(source.quantity),
        instructions: helpers.normalizeString(source.instructions),
    };
}

export function normalizePrescriptionItems(items) {
    return helpers.normalizeList(items).map(normalizePrescriptionItem);
}

export function prescriptionItemStarted(item) {
    return Object.values(normalizePrescriptionItem(item)).some(
        (value) => helpers.normalizeString(value) !== ''
    );
}

export function mutatePrescriptionItems(mutator) {
    const rootForm = document.getElementById('clinicalHistoryDraftForm');
    const baseDraft =
        rootForm instanceof HTMLFormElement
            ? helpers.serializeDraftForm(rootForm, helpers.currentDraftSource())
            : helpers.currentDraftSource();
    const nextDraft = helpers.synchronizeDraftClinicalState(helpers.cloneValue(baseDraft));
    const items = normalizePrescriptionItems(
        nextDraft?.clinicianDraft?.hcu005?.prescriptionItems || []
    );
    const mutatedItems = mutator(items) || items;

    nextDraft.clinicianDraft.hcu005 = helpers.normalizeHcu005(
        nextDraft.clinicianDraft.hcu005,
        {
            prescriptionItems: mutatedItems,
        }
    );

    const review = helpers.currentReviewSource();
    const normalizedNext = helpers.synchronizeDraftClinicalState(nextDraft);
    const dirty =
        JSON.stringify(normalizedNext) !==
        JSON.stringify(helpers.normalizeDraftSnapshot(review.draft));

    helpers.setClinicalHistoryState({
        draftForm: helpers.cloneValue(normalizedNext),
        dirty,
    });
    helpers.renderClinicalHistorySection();
}

export function buildClinicalHistoryDocumentsSection(draft, disabled) {
    return helpers.buildClinicalHistorySection(
        'Certificado y salida',
        'La nota final y la receta se regeneran desde HCU-005; aquí solo mantienes el certificado.',
        `
                <article class="clinical-history-event-card">
                    <div class="clinical-history-event-head">
                        <span class="clinical-history-mini-chip">Mirror HCU-005</span>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            helpers.hcu005StatusMeta(
                                helpers.evaluateHcu005(draft.clinicianDraft.hcu005)
                                    .status
                            ).label
                        )}</span>
                    </div>
                    <p>${escapeHtml(
                        draft.documents.finalNote.summary ||
                            'La nota final se construirá desde HCU-005.'
                    )}</p>
                    <small>${escapeHtml(
                        draft.documents.prescription.directions ||
                            'La receta se reflejará aquí cuando existan prescripciones completas.'
                    )}</small>
                </article>
                ${helpers.buildClinicalHistoryInlineGrid([
                    helpers.textareaField(
                        'document_certificate_summary',
                        'Certificado',
                        draft.documents.certificate.summary,
                        { rows: 3, disabled }
                    ),
                    helpers.inputField(
                        'document_certificate_rest_days',
                        'Dias de reposo',
                        draft.documents.certificate.restDays ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '1',
                            disabled,
                        }
                    ),
                ])}
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        id="clinicalHistoryExportFullRecordBtn"
                        data-clinical-review-action="export-full-record"
                        ${disabled ? 'disabled' : ''}
                    >
                        Exportar HCE completa (PDF)
                    </button>
                </div>
                <small>
                    Genera una version imprimible con todo el historial, el
                    estado legal y la trazabilidad documental del episodio.
                </small>
            `
    );
}

export function buildCertificateHistoryMetaText(review, history) {
    const caseId = helpers.currentReviewCaseId(review);
    if (!caseId) {
        return 'Selecciona un caso clinico para revisar su salida documental.';
    }
    if (history.loading && history.items.length === 0) {
        return 'Consultando los certificados emitidos para este caso.';
    }
    if (history.error && history.items.length === 0) {
        return history.error;
    }
    if (history.items.length === 0) {
        return 'Todavia no se han emitido certificados para este caso.';
    }

    const latest = history.items[0];
    const countLabel =
        history.items.length === 1
            ? '1 certificado emitido'
            : `${history.items.length} certificados emitidos`;
    const latestLabel = helpers.readableTimestamp(latest.issuedAt);
    return latestLabel && latestLabel !== '-'
        ? `${countLabel} • Ultimo ${latestLabel}`
        : countLabel;
}

export function buildCertificateHistoryList(review, history) {
    const caseId = helpers.currentReviewCaseId(review);
    if (!caseId) {
        return helpers.buildEmptyClinicalCard(
            'Sin caso activo',
            'Selecciona un caso clinico para ver folios, fechas y descargas PDF.',
            { cardClass: 'clinical-history-document-card is-empty' }
        );
    }

    if (history.loading && history.items.length === 0) {
        return helpers.buildEmptyClinicalCard(
            'Cargando certificados',
            'Estamos recuperando el historial documental del caso activo.',
            { cardClass: 'clinical-history-document-card is-empty' }
        );
    }

    if (history.error && history.items.length === 0) {
        return helpers.buildEmptyClinicalCard(
            'No se pudo cargar el historial',
            history.error,
            {
                cardClass: 'clinical-history-document-card is-empty',
                tone: 'warning',
            }
        );
    }

    return helpers.buildClinicalHistoryCollection(
        history.items,
        () =>
            helpers.buildEmptyClinicalCard(
                'Sin certificados emitidos',
                'El primer certificado que emitas desde este caso aparecera aqui.',
                { cardClass: 'clinical-history-document-card is-empty' }
            ),
        (item) => {
            const meta = [
                item.folio,
                item.typeLabel || helpers.humanizeClinicalCode(item.type),
                helpers.readableTimestamp(item.issuedAt),
            ]
                .filter((value) => value && value !== '-')
                .join(' • ');
            const summary = [
                item.cie10Code ? `CIE-10 ${item.cie10Code}` : '',
                item.diagnosisText,
                item.restDays > 0 ? `${item.restDays} dia(s) de reposo` : '',
                item.observations,
            ]
                .filter(Boolean)
                .join(' • ');
            const pdfUrl = `/api.php?resource=certificate&id=${encodeURIComponent(
                item.id
            )}&format=pdf`;

            return `
                <article class="clinical-history-document-card">
                    <div class="clinical-history-event-head">
                        <strong>${escapeHtml(
                            item.typeLabel || 'Certificado medico'
                        )}</strong>
                        ${
                            item.restDays > 0
                                ? `<span class="clinical-history-mini-chip" data-tone="warning">${escapeHtml(
                                      `${item.restDays} dia(s)`
                                  )}</span>`
                                : ''
                        }
                    </div>
                    <small>${escapeHtml(meta || 'Documento emitido')}</small>
                    <p>${escapeHtml(
                        summary || 'Sin resumen clinico adicional.'
                    )}</p>
                    <div class="clinical-history-document-actions">
                        <a
                            class="clinical-history-document-link"
                            href="${escapeHtml(pdfUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Descargar PDF
                        </a>
                    </div>
                </article>
            `;
        }
    );
}

export function emptyCertificateHistoryState() {
    return {
        caseId: '',
        loading: false,
        error: '',
        items: [],
        lastLoadedAt: 0,
    };
}

export function normalizeCertificateHistoryItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        id: helpers.normalizeString(source.id),
        folio: helpers.normalizeString(source.folio),
        caseId: helpers.normalizeString(source.caseId),
        type: helpers.normalizeString(source.type),
        typeLabel: helpers.normalizeString(source.typeLabel),
        diagnosisText: helpers.normalizeString(source.diagnosisText),
        cie10Code: helpers.normalizeString(source.cie10Code),
        restDays: helpers.normalizeNullableInt(source.restDays) ?? 0,
        observations: helpers.normalizeString(source.observations),
        issuedAt: helpers.normalizeString(source.issuedAt),
        issuedDateLocal: helpers.normalizeString(source.issuedDateLocal),
    };
}

export function readCertificateHistorySlice(state = getState()) {
    const source = helpers.getClinicalHistorySlice(state).certificateHistory;
    if (!source || typeof source !== 'object') {
        return emptyCertificateHistoryState();
    }

    return {
        caseId: helpers.normalizeString(source.caseId),
        loading: source.loading === true,
        error: helpers.normalizeString(source.error),
        items: helpers.normalizeList(source.items).map(normalizeCertificateHistoryItem),
        lastLoadedAt: helpers.normalizeNumber(source.lastLoadedAt),
    };
}

export function consentPacketTemplate(templateKey) {
    const normalizedTemplate = helpers.normalizeString(templateKey) || 'generic';
    const base = {
        templateKey: normalizedTemplate,
        title: 'Consentimiento informado HCU-form.024/2008',
        writtenRequired: true,
        careMode: 'ambulatorio',
        serviceLabel: 'Dermatología ambulatoria',
        establishmentLabel: 'Consultorio privado',
        procedureKey: 'generic',
        procedureLabel: 'Consentimiento genérico',
        procedureName: 'Procedimiento ambulatorio',
        procedureWhatIsIt: '',
        procedureHowItIsDone: '',
        durationEstimate: '',
        benefits: '',
        frequentRisks: '',
        rareSeriousRisks: '',
        patientSpecificRisks: '',
        alternatives: '',
        postProcedureCare: '',
        noProcedureConsequences: '',
        anesthesiologistAttestation: {
            applicable: false,
        },
    };

    if (normalizedTemplate === 'laser-dermatologico') {
        return {
            ...base,
            procedureKey: 'laser-dermatologico',
            procedureLabel: 'Láser dermatológico',
            procedureName: 'Procedimiento con láser dermatológico',
            procedureWhatIsIt:
                'Aplicación dirigida de energía láser sobre la piel para manejo dermatológico ambulatorio.',
            procedureHowItIsDone:
                'Se delimita el área, se protege la zona y se aplica el láser por sesiones según criterio clínico.',
            durationEstimate: '20 a 45 minutos según área tratada',
            benefits:
                'Mejoría del objetivo dermatológico indicado y manejo ambulatorio controlado.',
            frequentRisks:
                'Eritema, edema, ardor transitorio, costras leves o hiperpigmentación postinflamatoria.',
            rareSeriousRisks:
                'Quemadura, cicatriz, infección secundaria o alteraciones pigmentarias persistentes.',
            postProcedureCare:
                'Fotoprotección estricta, cuidado gentil de la zona y seguimiento clínico.',
            noProcedureConsequences:
                'Persistencia del problema dermatológico o necesidad de otras alternativas.',
        };
    }

    if (normalizedTemplate === 'peeling-quimico') {
        return {
            ...base,
            procedureKey: 'peeling-quimico',
            procedureLabel: 'Peeling químico',
            procedureName: 'Peeling químico ambulatorio',
            procedureWhatIsIt:
                'Aplicación controlada de agentes químicos sobre la piel para renovación superficial o media.',
            procedureHowItIsDone:
                'Se prepara la piel, se aplica el agente por tiempo definido y luego se neutraliza o retira según técnica.',
            durationEstimate: '20 a 40 minutos según protocolo',
            benefits:
                'Mejoría de textura, tono, lesiones superficiales y apoyo al plan dermatológico.',
            frequentRisks:
                'Ardor, eritema, descamación, sensibilidad y cambios pigmentarios transitorios.',
            rareSeriousRisks:
                'Quemadura química, cicatriz, infección o discromías persistentes.',
            postProcedureCare:
                'Hidratación, fotoprotección y seguimiento según indicaciones postratamiento.',
            noProcedureConsequences:
                'Persistencia del problema cutáneo o necesidad de otras alternativas terapéuticas.',
        };
    }

    if (normalizedTemplate === 'botox') {
        return {
            ...base,
            procedureKey: 'botox',
            procedureLabel: 'Botox',
            procedureName: 'Aplicación de toxina botulínica',
            procedureWhatIsIt:
                'Aplicación intramuscular o intradérmica de toxina botulínica en puntos definidos.',
            procedureHowItIsDone:
                'Se realiza marcación anatómica y se aplica el medicamento en dosis distribuidas según plan clínico.',
            durationEstimate: '15 a 30 minutos según zonas tratadas',
            benefits:
                'Mejoría funcional o estética según la indicación clínica establecida.',
            frequentRisks:
                'Dolor leve, hematoma, edema, asimetría transitoria o cefalea.',
            rareSeriousRisks:
                'Ptosis, debilidad muscular no deseada, reacción alérgica o difusión del efecto.',
            postProcedureCare:
                'Evitar masaje local, seguir indicaciones médicas y asistir a control si se programa.',
            noProcedureConsequences:
                'Persistencia del motivo de consulta o necesidad de otras alternativas terapéuticas.',
        };
    }

    return base;
}

export function emptyConsentPacket() {
    return {
        packetId: '',
        templateKey: 'generic',
        sourceMode: '',
        title: 'Consentimiento informado HCU-form.024/2008',
        procedureKey: 'generic',
        procedureLabel: 'Consentimiento genérico',
        status: 'draft',
        writtenRequired: true,
        careMode: 'ambulatorio',
        serviceLabel: '',
        establishmentLabel: '',
        patientName: '',
        patientDocumentNumber: '',
        patientRecordId: '',
        encounterDateTime: '',
        diagnosisLabel: '',
        diagnosisCie10: '',
        procedureName: '',
        procedureWhatIsIt: '',
        procedureHowItIsDone: '',
        durationEstimate: '',
        graphicRef: '',
        benefits: '',
        frequentRisks: '',
        rareSeriousRisks: '',
        patientSpecificRisks: '',
        alternatives: '',
        postProcedureCare: '',
        noProcedureConsequences: '',
        privateCommunicationConfirmed: false,
        companionShareAuthorized: false,
        declaration: {
            declaredAt: '',
            patientCanConsent: true,
            capacityAssessment: '',
            notes: '',
        },
        denial: {
            declinedAt: '',
            reason: '',
            patientRefusedSignature: false,
            notes: '',
        },
        revocation: {
            revokedAt: '',
            receivedBy: '',
            reason: '',
            notes: '',
        },
        patientAttestation: {
            name: '',
            documentNumber: '',
            signedAt: '',
            refusedSignature: false,
        },
        representativeAttestation: {
            name: '',
            kinship: '',
            documentNumber: '',
            phone: '',
            signedAt: '',
        },
        professionalAttestation: {
            name: '',
            role: 'medico_tratante',
            documentNumber: '',
            signedAt: '',
        },
        anesthesiologistAttestation: {
            applicable: false,
            name: '',
            documentNumber: '',
            signedAt: '',
        },
        witnessAttestation: {
            name: '',
            documentNumber: '',
            phone: '',
            signedAt: '',
        },
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

export function emptyConsentFormSnapshot() {
    return {
        snapshotId: '',
        finalizedAt: '',
        snapshotAt: '',
        ...emptyConsentPacket(),
    };
}

export function normalizeConsentPacket(packet, fallback = {}) {
    const defaults = emptyConsentPacket();
    const safeSource = packet && typeof packet === 'object' ? packet : {};
    const safeFallback =
        fallback && typeof fallback === 'object' ? fallback : {};
    const template = consentPacketTemplate(
        safeSource.templateKey ||
            safeFallback.templateKey ||
            defaults.templateKey
    );
    const source = {
        ...defaults,
        ...template,
        ...safeFallback,
        ...safeSource,
    };
    const declaration =
        source.declaration && typeof source.declaration === 'object'
            ? source.declaration
            : {};
    const denial =
        source.denial && typeof source.denial === 'object' ? source.denial : {};
    const revocation =
        source.revocation && typeof source.revocation === 'object'
            ? source.revocation
            : {};
    const patientAttestation =
        source.patientAttestation &&
        typeof source.patientAttestation === 'object'
            ? source.patientAttestation
            : {};
    const representativeAttestation =
        source.representativeAttestation &&
        typeof source.representativeAttestation === 'object'
            ? source.representativeAttestation
            : {};
    const professionalAttestation =
        source.professionalAttestation &&
        typeof source.professionalAttestation === 'object'
            ? source.professionalAttestation
            : {};
    const anesthesiologistAttestation =
        source.anesthesiologistAttestation &&
        typeof source.anesthesiologistAttestation === 'object'
            ? source.anesthesiologistAttestation
            : {};
    const witnessAttestation =
        source.witnessAttestation &&
        typeof source.witnessAttestation === 'object'
            ? source.witnessAttestation
            : {};

    return {
        ...source,
        packetId: helpers.normalizeString(source.packetId),
        templateKey: helpers.normalizeString(
            source.templateKey || template.templateKey
        ),
        sourceMode: helpers.normalizeString(source.sourceMode),
        title: helpers.normalizeString(source.title),
        procedureKey: helpers.normalizeString(source.procedureKey),
        procedureLabel: helpers.normalizeString(source.procedureLabel),
        status: helpers.normalizeString(source.status || 'draft'),
        writtenRequired: source.writtenRequired !== false,
        careMode: helpers.normalizeString(source.careMode || 'ambulatorio'),
        serviceLabel: helpers.normalizeString(source.serviceLabel),
        establishmentLabel: helpers.normalizeString(source.establishmentLabel),
        patientName: helpers.normalizeString(source.patientName),
        patientDocumentNumber: helpers.normalizeString(source.patientDocumentNumber),
        patientRecordId: helpers.normalizeString(source.patientRecordId),
        encounterDateTime: helpers.normalizeString(source.encounterDateTime),
        diagnosisLabel: helpers.normalizeString(source.diagnosisLabel),
        diagnosisCie10: helpers.normalizeString(source.diagnosisCie10),
        procedureName: helpers.normalizeString(source.procedureName),
        procedureWhatIsIt: helpers.normalizeString(source.procedureWhatIsIt),
        procedureHowItIsDone: helpers.normalizeString(source.procedureHowItIsDone),
        durationEstimate: helpers.normalizeString(source.durationEstimate),
        graphicRef: helpers.normalizeString(source.graphicRef),
        benefits: helpers.normalizeString(source.benefits),
        frequentRisks: helpers.normalizeString(source.frequentRisks),
        rareSeriousRisks: helpers.normalizeString(source.rareSeriousRisks),
        patientSpecificRisks: helpers.normalizeString(source.patientSpecificRisks),
        alternatives: helpers.normalizeString(source.alternatives),
        postProcedureCare: helpers.normalizeString(source.postProcedureCare),
        noProcedureConsequences: helpers.normalizeString(
            source.noProcedureConsequences
        ),
        privateCommunicationConfirmed:
            source.privateCommunicationConfirmed === true,
        companionShareAuthorized: source.companionShareAuthorized === true,
        declaration: {
            declaredAt: helpers.normalizeString(declaration.declaredAt),
            patientCanConsent:
                declaration.patientCanConsent === undefined
                    ? true
                    : declaration.patientCanConsent === true,
            capacityAssessment: helpers.normalizeString(declaration.capacityAssessment),
            notes: helpers.normalizeString(declaration.notes),
        },
        denial: {
            declinedAt: helpers.normalizeString(denial.declinedAt),
            reason: helpers.normalizeString(denial.reason),
            patientRefusedSignature: denial.patientRefusedSignature === true,
            notes: helpers.normalizeString(denial.notes),
        },
        revocation: {
            revokedAt: helpers.normalizeString(revocation.revokedAt),
            receivedBy: helpers.normalizeString(revocation.receivedBy),
            reason: helpers.normalizeString(revocation.reason),
            notes: helpers.normalizeString(revocation.notes),
        },
        patientAttestation: {
            name: helpers.normalizeString(patientAttestation.name),
            documentNumber: helpers.normalizeString(patientAttestation.documentNumber),
            signedAt: helpers.normalizeString(patientAttestation.signedAt),
            refusedSignature: patientAttestation.refusedSignature === true,
        },
        representativeAttestation: {
            name: helpers.normalizeString(representativeAttestation.name),
            kinship: helpers.normalizeString(representativeAttestation.kinship),
            documentNumber: helpers.normalizeString(
                representativeAttestation.documentNumber
            ),
            phone: helpers.normalizeString(representativeAttestation.phone),
            signedAt: helpers.normalizeString(representativeAttestation.signedAt),
        },
        professionalAttestation: {
            name: helpers.normalizeString(professionalAttestation.name),
            role:
                helpers.normalizeString(professionalAttestation.role) ||
                'medico_tratante',
            documentNumber: helpers.normalizeString(
                professionalAttestation.documentNumber
            ),
            signedAt: helpers.normalizeString(professionalAttestation.signedAt),
        },
        anesthesiologistAttestation: {
            applicable: anesthesiologistAttestation.applicable === true,
            name: helpers.normalizeString(anesthesiologistAttestation.name),
            documentNumber: helpers.normalizeString(
                anesthesiologistAttestation.documentNumber
            ),
            signedAt: helpers.normalizeString(anesthesiologistAttestation.signedAt),
        },
        witnessAttestation: {
            name: helpers.normalizeString(witnessAttestation.name),
            documentNumber: helpers.normalizeString(witnessAttestation.documentNumber),
            phone: helpers.normalizeString(witnessAttestation.phone),
            signedAt: helpers.normalizeString(witnessAttestation.signedAt),
        },
        history: helpers.normalizeList(source.history),
        createdAt: helpers.normalizeString(source.createdAt),
        updatedAt: helpers.normalizeString(source.updatedAt),
    };
}

export function normalizeConsentPackets(items) {
    return helpers.normalizeList(items).map((item) => normalizeConsentPacket(item));
}

export function normalizeConsentFormSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        ...emptyConsentFormSnapshot(),
        ...normalizeConsentPacket(source),
        snapshotId: helpers.normalizeString(source.snapshotId),
        finalizedAt: helpers.normalizeString(source.finalizedAt),
        snapshotAt: helpers.normalizeString(source.snapshotAt),
    };
}

export function normalizeConsentFormSnapshots(items) {
    return helpers.normalizeList(items).map(normalizeConsentFormSnapshot);
}

export function buildLegacyConsentFromPacket(packet, fallback = {}) {
    const normalized = normalizeConsentPacket(packet);
    const acceptedAt =
        helpers.normalizeString(normalized.patientAttestation.signedAt) ||
        helpers.normalizeString(normalized.representativeAttestation.signedAt);
    return helpers.normalizeConsent({
        ...fallback,
        required: normalized.writtenRequired === true,
        status:
            helpers.normalizeString(normalized.status) ||
            (normalized.writtenRequired === true ? 'draft' : 'not_required'),
        informedBy: normalized.professionalAttestation.name,
        informedAt: normalized.declaration.declaredAt,
        explainedWhat: normalized.procedureWhatIsIt,
        risksExplained: normalized.frequentRisks,
        alternativesExplained: normalized.alternatives,
        capacityAssessment: normalized.declaration.capacityAssessment,
        privateCommunicationConfirmed:
            normalized.privateCommunicationConfirmed === true,
        companionShareAuthorized: normalized.companionShareAuthorized === true,
        acceptedAt,
        declinedAt: normalized.denial.declinedAt,
        revokedAt: normalized.revocation.revokedAt,
        notes:
            normalized.declaration.notes ||
            normalized.denial.notes ||
            normalized.revocation.notes,
    });
}

export function consentPacketHasSubstantiveContent(packet) {
    const normalized = normalizeConsentPacket(packet);
    return [
        normalized.procedureName,
        normalized.diagnosisLabel,
        normalized.procedureWhatIsIt,
        normalized.benefits,
        normalized.frequentRisks,
        normalized.alternatives,
        normalized.status,
    ].some(
        (value) =>
            helpers.normalizeString(value) !== '' && helpers.normalizeString(value) !== 'draft'
    );
}

export function evaluateConsentPacket(packet) {
    const normalized = normalizeConsentPacket(packet);
    const legacyBridge =
        helpers.normalizeString(normalized.sourceMode) === 'legacy_bridge' ||
        helpers.normalizeString(normalized.templateKey) === 'legacy-bridge';
    const missing = [];
    [
        ['title', normalized.title],
        ['establishment', normalized.establishmentLabel],
        ['service', normalized.serviceLabel],
        ['encounter_datetime', normalized.encounterDateTime],
        ['record_id', normalized.patientRecordId],
        ['patient_name', normalized.patientName],
        ['patient_document', normalized.patientDocumentNumber],
        ['diagnosis', normalized.diagnosisLabel],
        ['procedure_name', normalized.procedureName],
        ['procedure_what_is_it', normalized.procedureWhatIsIt],
        ['procedure_how', normalized.procedureHowItIsDone],
        ['frequent_risks', normalized.frequentRisks],
        ['alternatives', normalized.alternatives],
        ['professional_attestation', normalized.professionalAttestation.name],
    ].forEach(([key, value]) => {
        if (!helpers.normalizeString(value)) {
            missing.push(key);
        }
    });
    if (!legacyBridge) {
        [
            ['duration', normalized.durationEstimate],
            ['benefits', normalized.benefits],
            ['rare_serious_risks', normalized.rareSeriousRisks],
            ['patient_specific_risks', normalized.patientSpecificRisks],
            ['post_procedure_care', normalized.postProcedureCare],
            ['no_procedure_consequences', normalized.noProcedureConsequences],
        ].forEach(([key, value]) => {
            if (!helpers.normalizeString(value)) {
                missing.push(key);
            }
        });
    }
    if (normalized.declaration.patientCanConsent !== true) {
        [
            ['representative_name', normalized.representativeAttestation.name],
            [
                'representative_document',
                normalized.representativeAttestation.documentNumber,
            ],
            [
                'representative_phone',
                normalized.representativeAttestation.phone,
            ],
            [
                'representative_kinship',
                normalized.representativeAttestation.kinship,
            ],
        ].forEach(([key, value]) => {
            if (!helpers.normalizeString(value)) {
                missing.push(key);
            }
        });
    }
    if (normalized.anesthesiologistAttestation.applicable === true) {
        if (!helpers.normalizeString(normalized.anesthesiologistAttestation.name)) {
            missing.push('anesthesiologist_name');
        }
        if (
            !helpers.normalizeString(
                normalized.anesthesiologistAttestation.documentNumber
            )
        ) {
            missing.push('anesthesiologist_document');
        }
    }

    const readyForDeclaration = missing.length === 0;
    const signedAt =
        helpers.normalizeString(normalized.patientAttestation.signedAt) ||
        helpers.normalizeString(normalized.representativeAttestation.signedAt);
    let status = readyForDeclaration ? 'ready_for_declaration' : 'incomplete';
    if (helpers.normalizeString(normalized.status) === 'accepted') {
        status = readyForDeclaration && signedAt ? 'accepted' : 'incomplete';
    } else if (helpers.normalizeString(normalized.status) === 'declined') {
        const witnessReady =
            helpers.normalizeString(normalized.witnessAttestation.name) &&
            helpers.normalizeString(normalized.witnessAttestation.documentNumber);
        if (
            normalized.denial.patientRefusedSignature === true &&
            !witnessReady
        ) {
            missing.push('witness_attestation');
            status = 'incomplete';
        } else {
            status = helpers.normalizeString(normalized.denial.declinedAt)
                ? 'declined'
                : 'incomplete';
        }
    } else if (helpers.normalizeString(normalized.status) === 'revoked') {
        status =
            helpers.normalizeString(normalized.revocation.revokedAt) &&
            helpers.normalizeString(normalized.revocation.receivedBy)
                ? 'revoked'
                : 'incomplete';
    } else if (helpers.normalizeString(normalized.status) === 'draft') {
        status = readyForDeclaration ? 'ready_for_declaration' : 'draft';
    }

    return {
        status,
        readyForDeclaration,
        missingFields: Array.from(new Set(missing)),
    };
}

export function deriveConsentPacketContext(packet, draft, fallbackPatient = {}) {
    const normalized = normalizeConsentPacket(packet);
    const admission = helpers.normalizeAdmission001(
        draft?.admission001,
        fallbackPatient,
        draft?.intake
    );
    const patient = helpers.normalizePatient(fallbackPatient);
    const clinic = helpers.resolveClinicProfileDisplay();

    return normalizeConsentPacket(
        {
            ...normalized,
            title:
                normalized.title ||
                'Consentimiento informado HCU-form.024/2008',
            establishmentLabel:
                normalized.establishmentLabel || clinic.establishmentLabel,
            serviceLabel: normalized.serviceLabel || clinic.serviceLabel,
            patientName:
                normalized.patientName ||
                helpers.buildAdmissionLegalName(admission, patient),
            patientDocumentNumber:
                normalized.patientDocumentNumber ||
                helpers.normalizeString(admission.identity.documentNumber),
            patientRecordId:
                normalized.patientRecordId ||
                helpers.normalizeString(draft.patientRecordId),
            encounterDateTime:
                normalized.encounterDateTime ||
                helpers.normalizeString(
                    draft.updatedAt ||
                        draft.createdAt ||
                        admission?.admissionMeta?.admissionDate
                ),
            diagnosisLabel:
                normalized.diagnosisLabel ||
                helpers.normalizeString(
                    draft?.clinicianDraft?.hcu005?.diagnosticImpression
                ),
            diagnosisCie10:
                normalized.diagnosisCie10 ||
                helpers.normalizeStringList(draft?.clinicianDraft?.cie10Sugeridos).join(
                    ', '
                ),
            procedureHowItIsDone:
                normalized.procedureHowItIsDone ||
                helpers.normalizeString(draft?.clinicianDraft?.hcu005?.careIndications),
            benefits:
                normalized.benefits ||
                helpers.normalizeString(draft?.clinicianDraft?.hcu005?.therapeuticPlan),
        },
        consentPacketTemplate(normalized.templateKey)
    );
}

export function buildClinicalHistoryConsentSection(review, draft, disabled) {
    const packets = normalizeConsentPackets(draft.consentPackets);
    const activePacketId = helpers.normalizeString(draft.activeConsentPacketId);
    const activePacket =
        packets.find(
            (packet) => helpers.normalizeString(packet.packetId) === activePacketId
        ) || null;
    const hydratedPacket = activePacket
        ? deriveConsentPacketContext(
              activePacket,
              draft,
              review.session.patient
          )
        : null;
    const activeStatus = helpers.hcu024StatusMeta(
        hydratedPacket
            ? evaluateConsentPacket(hydratedPacket).status
            : 'not_applicable'
    );
    const consentForms = normalizeConsentFormSnapshots(
        draft.documents.consentForms
    );

    return helpers.buildClinicalHistorySection(
        'Consentimiento HCU-form.024/2008',
        'Consentimientos escritos por procedimiento, con bridge legacy hacia el consentimiento activo.',
        `
                <input
                    type="hidden"
                    id="consent_active_packet_id"
                    name="consent_active_packet_id"
                    value="${escapeHtml(activePacketId)}"
                />
                <div class="clinical-history-summary-grid">
                    ${helpers.summaryStatCard(
                        'HCU-024',
                        activeStatus.label,
                        activeStatus.summary,
                        activeStatus.status === 'accepted'
                            ? 'success'
                            : ['declined', 'revoked', 'incomplete'].includes(
                                    activeStatus.status
                                )
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Paciente',
                        hydratedPacket?.patientName ||
                            helpers.buildAdmissionLegalName(
                                draft.admission001,
                                review.session.patient
                            ) ||
                            'Sin paciente',
                        hydratedPacket?.patientDocumentNumber ||
                            helpers.normalizeString(
                                draft.admission001.identity.documentNumber
                            ) ||
                            'Sin documento',
                        'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Establecimiento',
                        hydratedPacket?.establishmentLabel ||
                            helpers.resolveClinicProfileDisplay().establishmentLabel,
                        hydratedPacket?.serviceLabel ||
                            helpers.resolveClinicProfileDisplay().serviceLabel,
                        'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Snapshots',
                        String(consentForms.length),
                        consentForms.length > 0
                            ? 'Snapshots documentales inmutables del episodio'
                            : 'Todavía no hay snapshots HCU-024 emitidos',
                        consentForms.length > 0 ? 'success' : 'neutral'
                    )}
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        data-clinical-draft-action="create-consent-packet-local"
                        data-template-key="laser-dermatologico"
                        ${disabled ? 'disabled' : ''}
                    >
                        Láser dermatológico
                    </button>
                    <button
                        type="button"
                        data-clinical-draft-action="create-consent-packet-local"
                        data-template-key="peeling-quimico"
                        ${disabled ? 'disabled' : ''}
                    >
                        Peeling químico
                    </button>
                    <button
                        type="button"
                        data-clinical-draft-action="create-consent-packet-local"
                        data-template-key="botox"
                        ${disabled ? 'disabled' : ''}
                    >
                        Botox
                    </button>
                    <button
                        type="button"
                        data-clinical-draft-action="create-consent-packet-local"
                        data-template-key="generic"
                        ${disabled ? 'disabled' : ''}
                    >
                        Consentimiento genérico
                    </button>
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    ${packets
                        .map((packet) =>
                            buildConsentPacketChip(
                                packet,
                                activePacketId,
                                disabled
                            )
                        )
                        .join('')}
                </div>
                ${
                    !hydratedPacket
                        ? helpers.buildEmptyClinicalCard(
                              'Sin consentimiento activo',
                              'Crea un consentimiento por procedimiento para empezar el HCU-024 del episodio.'
                          )
                        : `
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_title',
                                    'Título del formulario',
                                    hydratedPacket.title,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_care_mode',
                                    'Tipo de atención',
                                    hydratedPacket.careMode,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_service_label',
                                    'Servicio',
                                    hydratedPacket.serviceLabel,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'consent_packet_establishment_label',
                                    'Establecimiento',
                                    hydratedPacket.establishmentLabel,
                                    { disabled: true }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_patient_name',
                                    'Paciente',
                                    hydratedPacket.patientName,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'consent_packet_patient_document',
                                    'Documento / HCU',
                                    `${
                                        hydratedPacket.patientDocumentNumber ||
                                        ''
                                    } ${
                                        hydratedPacket.patientRecordId || ''
                                    }`.trim(),
                                    { disabled: true }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_encounter_datetime',
                                    'Fecha/hora',
                                    hydratedPacket.encounterDateTime,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'consent_packet_diagnosis_cie10',
                                    'CIE-10',
                                    hydratedPacket.diagnosisCie10,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_diagnosis_label',
                                    'Diagnóstico principal',
                                    hydratedPacket.diagnosisLabel,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_procedure_name',
                                    'Procedimiento',
                                    hydratedPacket.procedureName,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.textareaField(
                                    'consent_packet_procedure_what_is_it',
                                    'En qué consiste',
                                    hydratedPacket.procedureWhatIsIt,
                                    { rows: 4, disabled }
                                ),
                                helpers.textareaField(
                                    'consent_packet_procedure_how',
                                    'Cómo se realiza',
                                    hydratedPacket.procedureHowItIsDone,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_duration_estimate',
                                    'Duración estimada',
                                    hydratedPacket.durationEstimate,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_graphic_ref',
                                    'Referencia gráfica',
                                    hydratedPacket.graphicRef,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.textareaField(
                                    'consent_packet_benefits',
                                    'Beneficios',
                                    hydratedPacket.benefits,
                                    { rows: 4, disabled }
                                ),
                                helpers.textareaField(
                                    'consent_packet_frequent_risks',
                                    'Riesgos frecuentes',
                                    hydratedPacket.frequentRisks,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.textareaField(
                                    'consent_packet_rare_serious_risks',
                                    'Riesgos poco frecuentes graves',
                                    hydratedPacket.rareSeriousRisks,
                                    { rows: 4, disabled }
                                ),
                                helpers.textareaField(
                                    'consent_packet_patient_specific_risks',
                                    'Riesgos específicos del paciente',
                                    hydratedPacket.patientSpecificRisks,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.textareaField(
                                    'consent_packet_alternatives',
                                    'Alternativas',
                                    hydratedPacket.alternatives,
                                    { rows: 4, disabled }
                                ),
                                helpers.textareaField(
                                    'consent_packet_post_procedure_care',
                                    'Manejo posterior',
                                    hydratedPacket.postProcedureCare,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${helpers.textareaField(
                                'consent_packet_no_procedure_consequences',
                                'Consecuencias de no realizarlo',
                                hydratedPacket.noProcedureConsequences,
                                { rows: 3, disabled }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_declared_at',
                                    'Fecha/hora de información',
                                    hydratedPacket.declaration.declaredAt,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_professional_name',
                                    'Profesional tratante',
                                    hydratedPacket.professionalAttestation.name,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_professional_document',
                                    'Documento profesional',
                                    hydratedPacket.professionalAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_professional_signed_at',
                                    'Firma profesional',
                                    hydratedPacket.professionalAttestation
                                        .signedAt,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.textareaField(
                                    'consent_packet_capacity_assessment',
                                    'Capacidad para decidir',
                                    hydratedPacket.declaration
                                        .capacityAssessment,
                                    { rows: 3, disabled }
                                ),
                                helpers.textareaField(
                                    'consent_packet_declaration_notes',
                                    'Notas de declaración',
                                    hydratedPacket.declaration.notes,
                                    { rows: 3, disabled }
                                ),
                            ])}
                            ${helpers.checkboxField(
                                'consent_packet_patient_can_consent',
                                'El paciente puede consentir por sí mismo',
                                hydratedPacket.declaration.patientCanConsent !==
                                    false,
                                { disabled }
                            )}
                            ${helpers.checkboxField(
                                'consent_packet_private_communication_confirmed',
                                'La comunicación ocurrió en entorno privado',
                                hydratedPacket.privateCommunicationConfirmed ===
                                    true,
                                { disabled }
                            )}
                            ${helpers.checkboxField(
                                'consent_packet_companion_share_authorized',
                                'Hay autorización para compartir con acompañante',
                                hydratedPacket.companionShareAuthorized ===
                                    true,
                                { disabled }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_patient_attestation_name',
                                    'Paciente compareciente',
                                    hydratedPacket.patientAttestation.name,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_patient_attestation_document',
                                    'Documento del paciente',
                                    hydratedPacket.patientAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_patient_attestation_signed_at',
                                    'Fecha de firma del paciente',
                                    hydratedPacket.patientAttestation.signedAt,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_representative_name',
                                    'Representante',
                                    hydratedPacket.representativeAttestation
                                        .name,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_representative_kinship',
                                    'Parentesco',
                                    hydratedPacket.representativeAttestation
                                        .kinship,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_representative_document',
                                    'Documento representante',
                                    hydratedPacket.representativeAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_representative_phone',
                                    'Teléfono representante',
                                    hydratedPacket.representativeAttestation
                                        .phone,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_representative_signed_at',
                                    'Firma representante',
                                    hydratedPacket.representativeAttestation
                                        .signedAt,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.checkboxField(
                                'consent_packet_patient_attestation_refused_signature',
                                'El paciente se negó a firmar la declaración',
                                hydratedPacket.patientAttestation
                                    .refusedSignature === true,
                                { disabled }
                            )}
                            ${helpers.checkboxField(
                                'consent_packet_denial_refused_signature',
                                'Si hay negativa, el paciente se niega a firmarla',
                                hydratedPacket.denial
                                    .patientRefusedSignature === true,
                                { disabled }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_denial_declined_at',
                                    'Fecha/hora de negativa',
                                    hydratedPacket.denial.declinedAt,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_denial_reason',
                                    'Razón de negativa',
                                    hydratedPacket.denial.reason,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_witness_name',
                                    'Testigo',
                                    hydratedPacket.witnessAttestation.name,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_witness_document',
                                    'Documento testigo',
                                    hydratedPacket.witnessAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_witness_phone',
                                    'Teléfono testigo',
                                    hydratedPacket.witnessAttestation.phone,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_witness_signed_at',
                                    'Firma testigo',
                                    hydratedPacket.witnessAttestation.signedAt,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.textareaField(
                                'consent_packet_denial_notes',
                                'Notas de negativa',
                                hydratedPacket.denial.notes,
                                { rows: 3, disabled }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_revocation_revoked_at',
                                    'Fecha/hora de revocatoria',
                                    hydratedPacket.revocation.revokedAt,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_revocation_received_by',
                                    'Profesional que recibe revocatoria',
                                    hydratedPacket.revocation.receivedBy,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_revocation_reason',
                                    'Razón de revocatoria',
                                    hydratedPacket.revocation.reason,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.textareaField(
                                'consent_packet_revocation_notes',
                                'Notas de revocatoria',
                                hydratedPacket.revocation.notes,
                                { rows: 3, disabled }
                            )}
                            ${helpers.checkboxField(
                                'consent_packet_anesthesiologist_applicable',
                                'Requiere comparecencia de anestesiología',
                                hydratedPacket.anesthesiologistAttestation
                                    .applicable === true,
                                { disabled }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'consent_packet_anesthesiologist_name',
                                    'Anestesiólogo',
                                    hydratedPacket.anesthesiologistAttestation
                                        .name,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_anesthesiologist_document',
                                    'Documento anestesiólogo',
                                    hydratedPacket.anesthesiologistAttestation
                                        .documentNumber,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'consent_packet_anesthesiologist_signed_at',
                                    'Firma anestesiología',
                                    hydratedPacket.anesthesiologistAttestation
                                        .signedAt,
                                    { disabled }
                                ),
                            ])}
                            <div class="toolbar-row clinical-history-actions-row">
                                <button
                                    type="button"
                                    data-clinical-review-action="declare-current-consent"
                                    ${disabled ? 'disabled' : ''}
                                >
                                    Declarar consentimiento
                                </button>
                                <button
                                    type="button"
                                    data-clinical-review-action="deny-current-consent"
                                    ${disabled ? 'disabled' : ''}
                                >
                                    Registrar negativa
                                </button>
                                <button
                                    type="button"
                                    data-clinical-review-action="revoke-current-consent"
                                    ${disabled ? 'disabled' : ''}
                                >
                                    Registrar revocatoria
                                </button>
                            </div>
                        `
                }
            `
    );
}

export function emptyInterconsultation() {
    return {
        interconsultId: '',
        status: 'draft',
        reportStatus: 'not_received',
        requiredForCurrentPlan: false,
        priority: 'normal',
        requestedAt: '',
        requestingEstablishment: '',
        requestingService: '',
        destinationEstablishment: '',
        destinationService: '',
        consultedProfessionalName: '',
        patientName: '',
        patientDocumentNumber: '',
        patientRecordId: '',
        patientAgeYears: null,
        patientSexAtBirth: '',
        clinicalPicture: '',
        requestReason: '',
        diagnoses: [
            helpers.emptyInterconsultationDiagnosis('pre'),
            helpers.emptyInterconsultationDiagnosis('def'),
        ],
        performedDiagnosticsSummary: '',
        therapeuticMeasuresDone: '',
        questionForConsultant: '',
        issuedBy: '',
        issuedAt: '',
        cancelledAt: '',
        cancelReason: '',
        report: helpers.emptyInterconsultReport(),
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

export function emptyLabOrder() {
    return {
        labOrderId: '',
        status: 'draft',
        requiredForCurrentPlan: false,
        priority: 'routine',
        requestedAt: '',
        sampleDate: '',
        requestingEstablishment: '',
        requestingService: '',
        careSite: '',
        bedLabel: '',
        requestedBy: '',
        patientName: '',
        patientDocumentNumber: '',
        patientRecordId: '',
        patientAgeYears: null,
        patientSexAtBirth: '',
        diagnoses: [
            helpers.emptyInterconsultationDiagnosis('pre'),
            helpers.emptyInterconsultationDiagnosis('def'),
        ],
        studySelections: {
            hematology: [],
            urinalysis: [],
            coprological: [],
            bloodChemistry: [],
            serology: [],
            bacteriology: [],
            others: '',
        },
        bacteriologySampleSource: '',
        physicianPresentAtExam: false,
        notes: '',
        issuedAt: '',
        cancelledAt: '',
        cancelReason: '',
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

export function emptyImagingOrder() {
    return {
        imagingOrderId: '',
        status: 'draft',
        resultStatus: 'not_received',
        requiredForCurrentPlan: false,
        priority: 'routine',
        requestedAt: '',
        studyDate: '',
        requestingEstablishment: '',
        requestingService: '',
        careSite: '',
        bedLabel: '',
        requestedBy: '',
        patientName: '',
        patientDocumentNumber: '',
        patientRecordId: '',
        patientAgeYears: null,
        patientSexAtBirth: '',
        diagnoses: [
            helpers.emptyInterconsultationDiagnosis('pre'),
            helpers.emptyInterconsultationDiagnosis('def'),
        ],
        studySelections: {
            conventionalRadiography: [],
            tomography: [],
            magneticResonance: [],
            ultrasound: [],
            procedures: [],
            others: [],
        },
        requestReason: '',
        clinicalSummary: '',
        canMobilize: false,
        canRemoveDressingsOrCasts: false,
        physicianPresentAtExam: false,
        bedsideRadiography: false,
        notes: '',
        issuedAt: '',
        cancelledAt: '',
        cancelReason: '',
        result: {
            status: 'not_received',
            reportedAt: '',
            reportedBy: '',
            receivedBy: '',
            reportingEstablishment: '',
            reportingService: '',
            radiologistProfessionalName: '',
            radiologistProfessionalRole: '',
            studyPerformedSummary: '',
            findings: '',
            diagnosticImpression: '',
            recommendations: '',
            followUpIndications: '',
            sourceDocumentType: '',
            sourceReference: '',
            attachments: [],
            history: [],
            createdAt: '',
            updatedAt: '',
        },
        history: [],
        createdAt: '',
        updatedAt: '',
    };
}

export function buildInterconsultationChip(
    interconsultation,
    activeInterconsultationId,
    disabled
) {
    const normalized = helpers.normalizeInterconsultation(interconsultation);
    const status = helpers.hcu007StatusMeta(
        helpers.evaluateInterconsultation(normalized).status
    );
    const isActive =
        helpers.normalizeString(normalized.interconsultId) ===
        helpers.normalizeString(activeInterconsultationId);

    return `
        <button
            type="button"
            class="clinical-history-workspace-tab${isActive ? ' is-active' : ''}"
            data-clinical-review-action="select-interconsultation"
            data-interconsult-id="${escapeHtml(normalized.interconsultId)}"
            ${disabled ? 'disabled' : ''}
        >
            <strong>${escapeHtml(
                normalized.destinationService ||
                    normalized.requestReason ||
                    'Interconsulta'
            )}</strong>
            <small>${escapeHtml(status.label)}</small>
        </button>
    `;
}

export function buildClinicalHistoryInterconsultSection(review, draft, disabled) {
    const interconsultations = helpers.normalizeInterconsultations(
        draft.interconsultations
    );
    const activeInterconsultationId = helpers.normalizeString(
        draft.activeInterconsultationId
    );
    const activeInterconsultation =
        interconsultations.find(
            (item) =>
                helpers.normalizeString(item.interconsultId) ===
                activeInterconsultationId
        ) || null;
    const hydratedInterconsultation = activeInterconsultation
        ? helpers.deriveInterconsultationContext(
              activeInterconsultation,
              draft,
              review.session.patient
          )
        : null;
    const activeStatus = helpers.hcu007StatusMeta(
        hydratedInterconsultation
            ? helpers.evaluateInterconsultation(hydratedInterconsultation).status
            : 'not_applicable'
    );
    const activeReport = hydratedInterconsultation
        ? helpers.normalizeInterconsultReport(hydratedInterconsultation.report, {
              consultantProfessionalName:
                  hydratedInterconsultation.consultedProfessionalName,
              respondingEstablishment:
                  hydratedInterconsultation.destinationEstablishment,
              respondingService: hydratedInterconsultation.destinationService,
          })
        : helpers.emptyInterconsultReport();
    const activeReportStatus = helpers.hcu007ReportStatusMeta(
        hydratedInterconsultation
            ? helpers.evaluateInterconsultReport(activeReport).status
            : 'not_received'
    );
    const interconsultForms = helpers.normalizeInterconsultFormSnapshots(
        draft.documents.interconsultForms
    );
    const interconsultReports = helpers.normalizeInterconsultReportSnapshots(
        draft.documents.interconsultReports
    );
    const supportAttachments = helpers.normalizeAttachmentList(draft.intake.adjuntos);
    const selectedAttachmentIds = new Set(
        helpers.normalizeAttachmentList(activeReport.attachments).map((attachment) =>
            String(attachment.id || '')
        )
    );
    const attachmentSelector =
        supportAttachments.length > 0
            ? supportAttachments
                  .map((attachment) => {
                      const attachmentId = String(attachment.id || '');
                      const checked =
                          attachmentId &&
                          selectedAttachmentIds.has(attachmentId);
                      const meta = [
                          helpers.normalizeString(attachment.kind) || 'archivo',
                          helpers.normalizeString(attachment.mime),
                          attachment.size > 0
                              ? helpers.formatBytes(attachment.size)
                              : '',
                      ]
                          .filter(Boolean)
                          .join(' • ');
                      return `
                            <label class="clinical-history-inline-checkbox">
                                <input
                                    type="checkbox"
                                    name="interconsult_report_attachment_ids"
                                    value="${escapeHtml(attachmentId)}"
                                    ${checked ? 'checked' : ''}
                                    ${disabled ? 'disabled' : ''}
                                />
                                <span>
                                    <strong>${escapeHtml(
                                        attachment.originalName ||
                                            `Adjunto ${attachmentId}`
                                    )}</strong>
                                    <small>${escapeHtml(meta || 'Soporte clínico')}</small>
                                </span>
                            </label>
                        `;
                  })
                  .join('')
            : helpers.buildEmptyClinicalCard(
                  'Sin adjuntos clínicos disponibles',
                  'Cuando el caso tenga adjuntos de clinical_uploads podrás seleccionarlos como respaldo del informe.'
              );
    const diagnoses = hydratedInterconsultation
        ? helpers.normalizeInterconsultationDiagnoses(
              hydratedInterconsultation.diagnoses
          )
        : helpers.normalizeInterconsultationDiagnoses([]);
    const preDiagnosis =
        diagnoses.find((item) => item.type === 'pre') ||
        helpers.emptyInterconsultationDiagnosis('pre');
    const defDiagnosis =
        diagnoses.find((item) => item.type === 'def') ||
        helpers.emptyInterconsultationDiagnosis('def');

    return helpers.buildClinicalHistorySection(
        'Interconsulta HCU-form.007/2008',
        'Documento formal de interconsulta emitida con captura estructurada del informe del consultado y adjunto opcional.',
        `
                <input
                    type="hidden"
                    id="interconsult_active_id"
                    name="interconsult_active_id"
                    value="${escapeHtml(activeInterconsultationId)}"
                />
                <div class="clinical-history-summary-grid">
                    ${helpers.summaryStatCard(
                        'HCU-007',
                        activeStatus.label,
                        activeStatus.summary,
                        ['issued', 'received'].includes(activeStatus.status)
                            ? 'success'
                            : [
                                    'ready_to_issue',
                                    'incomplete',
                                    'draft',
                                ].includes(activeStatus.status)
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Informe del consultado',
                        activeReportStatus.label,
                        activeReportStatus.summary,
                        activeReportStatus.status === 'received'
                            ? 'success'
                            : ['ready_to_receive', 'draft'].includes(
                                    activeReportStatus.status
                                )
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Paciente / HCU',
                        hydratedInterconsultation?.patientName ||
                            helpers.buildAdmissionLegalName(
                                draft.admission001,
                                review.session.patient
                            ) ||
                            'Sin paciente',
                        [
                            hydratedInterconsultation?.patientDocumentNumber,
                            hydratedInterconsultation?.patientRecordId,
                        ]
                            .filter(Boolean)
                            .join(' • ') || 'Sin documento',
                        'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Solicitante',
                        hydratedInterconsultation?.requestingService ||
                            helpers.resolveClinicProfileDisplay().serviceLabel,
                        hydratedInterconsultation?.requestingEstablishment ||
                            helpers.resolveClinicProfileDisplay().establishmentLabel,
                        'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Snapshots',
                        String(
                            interconsultForms.length +
                                interconsultReports.length
                        ),
                        interconsultReports.length > 0
                            ? 'Hay snapshots emitidos/cancelados y al menos un informe recibido.'
                            : interconsultForms.length > 0
                              ? 'Snapshots documentales HCU-007 emitidos o cancelados.'
                              : 'Todavía no hay snapshots HCU-007 emitidos.',
                        interconsultForms.length + interconsultReports.length >
                            0
                            ? 'success'
                            : 'neutral'
                    )}
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        data-clinical-review-action="create-interconsultation"
                        ${disabled ? 'disabled' : ''}
                    >
                        Nueva interconsulta
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="issue-current-interconsultation"
                        ${disabled || !hydratedInterconsultation ? 'disabled' : ''}
                    >
                        Emitir interconsulta
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="cancel-current-interconsultation"
                        ${disabled || !hydratedInterconsultation ? 'disabled' : ''}
                    >
                        Cancelar interconsulta
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="receive-current-interconsult-report"
                        ${disabled || !hydratedInterconsultation ? 'disabled' : ''}
                    >
                        Recibir informe
                    </button>
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    ${interconsultations
                        .map((item) =>
                            buildInterconsultationChip(
                                item,
                                activeInterconsultationId,
                                disabled
                            )
                        )
                        .join('')}
                </div>
                ${
                    !hydratedInterconsultation
                        ? helpers.buildEmptyClinicalCard(
                              'Sin interconsulta activa',
                              'Crea una interconsulta del episodio para empezar el HCU-007.'
                          )
                        : `
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'interconsult_requested_at',
                                    'Fecha/hora',
                                    hydratedInterconsultation.requestedAt,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'interconsult_priority',
                                    'Prioridad',
                                    hydratedInterconsultation.priority,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'interconsult_issued_by',
                                    'Profesional solicitante',
                                    hydratedInterconsultation.issuedBy,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.checkboxField(
                                'interconsult_required_for_current_plan',
                                'La interconsulta es parte del plan actual',
                                hydratedInterconsultation.requiredForCurrentPlan ===
                                    true,
                                {
                                    hint: 'Si está marcada, la aprobación final exige emitirla o cancelarla.',
                                    disabled,
                                }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'interconsult_patient_name',
                                    'Paciente',
                                    hydratedInterconsultation.patientName,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'interconsult_patient_record',
                                    'Documento / HCU',
                                    [
                                        hydratedInterconsultation.patientDocumentNumber,
                                        hydratedInterconsultation.patientRecordId,
                                    ]
                                        .filter(Boolean)
                                        .join(' '),
                                    { disabled: true }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'interconsult_requesting_establishment',
                                    'Establecimiento solicitante',
                                    hydratedInterconsultation.requestingEstablishment,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'interconsult_requesting_service',
                                    'Servicio solicitante',
                                    hydratedInterconsultation.requestingService,
                                    { disabled: true }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'interconsult_destination_establishment',
                                    'Establecimiento destino',
                                    hydratedInterconsultation.destinationEstablishment,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'interconsult_destination_service',
                                    'Servicio destino',
                                    hydratedInterconsultation.destinationService,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'interconsult_consulted_professional_name',
                                    'Profesional consultado',
                                    hydratedInterconsultation.consultedProfessionalName,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.textareaField(
                                    'interconsult_request_reason',
                                    'Motivo de interconsulta',
                                    hydratedInterconsultation.requestReason,
                                    { rows: 4, disabled }
                                ),
                                helpers.textareaField(
                                    'interconsult_question_for_consultant',
                                    'Pregunta para el consultado',
                                    hydratedInterconsultation.questionForConsultant,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${helpers.textareaField(
                                'interconsult_clinical_picture',
                                'Cuadro clínico actual',
                                hydratedInterconsultation.clinicalPicture,
                                {
                                    rows: 5,
                                    placeholder:
                                        'Resumen clínico actual del episodio que justifica la interconsulta.',
                                    disabled,
                                }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.textareaField(
                                    'interconsult_performed_diagnostics_summary',
                                    'Exámenes y procedimientos diagnósticos relevantes',
                                    hydratedInterconsultation.performedDiagnosticsSummary,
                                    { rows: 4, disabled }
                                ),
                                helpers.textareaField(
                                    'interconsult_therapeutic_measures_done',
                                    'Medidas terapéuticas y educativas realizadas',
                                    hydratedInterconsultation.therapeuticMeasuresDone,
                                    { rows: 4, disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'interconsult_diagnosis_pre_label',
                                    'Diagnóstico PRE',
                                    preDiagnosis.label,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'interconsult_diagnosis_pre_cie10',
                                    'CIE-10 PRE',
                                    preDiagnosis.cie10,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'interconsult_diagnosis_def_label',
                                    'Diagnóstico DEF',
                                    defDiagnosis.label,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'interconsult_diagnosis_def_cie10',
                                    'CIE-10 DEF',
                                    defDiagnosis.cie10,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'interconsult_issued_at',
                                    'Emitida el',
                                    hydratedInterconsultation.issuedAt,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'interconsult_cancelled_at',
                                    'Cancelada el',
                                    hydratedInterconsultation.cancelledAt,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'interconsult_cancel_reason',
                                    'Razón de cancelación',
                                    hydratedInterconsultation.cancelReason,
                                    { disabled }
                                ),
                            ])}
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Informe del consultado</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        activeReportStatus.label
                                    )}</span>
                                </div>
                                ${
                                    activeReportStatus.status === 'received'
                                        ? `
                                            <div class="clinical-history-banner clinical-history-banner-success">
                                                Informe recibido: reconciliar manualmente en HCU-005/HCU-024 si aplica.
                                            </div>
                                        `
                                        : ''
                                }
                                ${helpers.buildClinicalHistoryInlineGrid([
                                    helpers.inputField(
                                        'interconsult_report_reported_at',
                                        'Fecha/hora del informe',
                                        activeReport.reportedAt,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'interconsult_report_reported_by',
                                        'Reportado por',
                                        activeReport.reportedBy,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'interconsult_report_received_by',
                                        'Recibido por',
                                        activeReport.receivedBy,
                                        { disabled: true }
                                    ),
                                ])}
                                ${helpers.buildClinicalHistoryInlineGrid([
                                    helpers.inputField(
                                        'interconsult_report_responding_establishment',
                                        'Establecimiento respondiente',
                                        activeReport.respondingEstablishment,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'interconsult_report_responding_service',
                                        'Servicio respondiente',
                                        activeReport.respondingService,
                                        { disabled }
                                    ),
                                ])}
                                ${helpers.buildClinicalHistoryInlineGrid([
                                    helpers.inputField(
                                        'interconsult_report_consultant_professional_name',
                                        'Profesional consultado',
                                        activeReport.consultantProfessionalName,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'interconsult_report_consultant_professional_role',
                                        'Rol profesional',
                                        activeReport.consultantProfessionalRole,
                                        { disabled }
                                    ),
                                ])}
                                ${helpers.textareaField(
                                    'interconsult_report_summary',
                                    'Resumen del informe',
                                    activeReport.reportSummary,
                                    {
                                        rows: 3,
                                        disabled,
                                    }
                                )}
                                ${helpers.buildClinicalHistoryInlineGrid([
                                    helpers.textareaField(
                                        'interconsult_report_clinical_findings',
                                        'Hallazgos clínicos',
                                        activeReport.clinicalFindings,
                                        {
                                            rows: 4,
                                            disabled,
                                        }
                                    ),
                                    helpers.textareaField(
                                        'interconsult_report_diagnostic_opinion',
                                        'Criterio / impresión del consultado',
                                        activeReport.diagnosticOpinion,
                                        {
                                            rows: 4,
                                            disabled,
                                        }
                                    ),
                                ])}
                                ${helpers.buildClinicalHistoryInlineGrid([
                                    helpers.textareaField(
                                        'interconsult_report_recommendations',
                                        'Recomendaciones',
                                        activeReport.recommendations,
                                        {
                                            rows: 4,
                                            disabled,
                                        }
                                    ),
                                    helpers.textareaField(
                                        'interconsult_report_follow_up_indications',
                                        'Conducta sugerida / seguimiento',
                                        activeReport.followUpIndications,
                                        {
                                            rows: 4,
                                            disabled,
                                        }
                                    ),
                                ])}
                                ${helpers.buildClinicalHistoryInlineGrid([
                                    helpers.inputField(
                                        'interconsult_report_source_document_type',
                                        'Tipo de documento fuente',
                                        activeReport.sourceDocumentType,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'interconsult_report_source_reference',
                                        'Referencia / folio',
                                        activeReport.sourceReference,
                                        { disabled }
                                    ),
                                ])}
                                <div class="clinical-history-section-block">
                                    <div class="clinical-history-event-head">
                                        <strong>Adjunto opcional de respaldo</strong>
                                        <small>Reutiliza adjuntos ya cargados por clinical_uploads.</small>
                                    </div>
                                    <div class="clinical-history-inline-checkbox-list">
                                        ${attachmentSelector}
                                    </div>
                                </div>
                            </div>
                        `
                }
            `
    );
}

export function buildLabOrderChip(labOrder, activeLabOrderId, disabled) {
    const normalized = helpers.normalizeLabOrder(labOrder);
    const status = helpers.hcu010AStatusMeta(helpers.evaluateLabOrder(normalized).status);
    const isActive =
        helpers.normalizeString(normalized.labOrderId) ===
        helpers.normalizeString(activeLabOrderId);

    return `
        <button
            type="button"
            class="clinical-history-workspace-tab${isActive ? ' is-active' : ''}"
            data-clinical-review-action="select-lab-order"
            data-lab-order-id="${escapeHtml(normalized.labOrderId)}"
            ${disabled ? 'disabled' : ''}
        >
            <strong>${escapeHtml(
                normalized.sampleDate ||
                    normalized.requestedAt ||
                    'Orden laboratorio'
            )}</strong>
            <small>${escapeHtml(status.label)}</small>
        </button>
    `;
}

export function buildClinicalHistoryLabOrderSection(review, draft, disabled) {
    const labOrders = helpers.normalizeLabOrders(draft.labOrders);
    const activeLabOrderId = helpers.normalizeString(draft.activeLabOrderId);
    const activeLabOrder =
        labOrders.find(
            (item) => helpers.normalizeString(item.labOrderId) === activeLabOrderId
        ) || null;
    const hydratedLabOrder = activeLabOrder
        ? helpers.deriveLabOrderContext(activeLabOrder, draft, review.session.patient)
        : null;
    const evaluation = hydratedLabOrder
        ? helpers.evaluateLabOrder(hydratedLabOrder)
        : { status: 'not_applicable', selectedStudiesCount: 0 };
    const activeStatus = helpers.hcu010AStatusMeta(evaluation.status);
    const labOrderSnapshots = helpers.normalizeLabOrderSnapshots(
        draft.documents.labOrders
    );
    const diagnoses = hydratedLabOrder
        ? helpers.normalizeInterconsultationDiagnoses(hydratedLabOrder.diagnoses)
        : helpers.normalizeInterconsultationDiagnoses([]);
    const preDiagnosis =
        diagnoses.find((item) => item.type === 'pre') ||
        helpers.emptyInterconsultationDiagnosis('pre');
    const defDiagnosis =
        diagnoses.find((item) => item.type === 'def') ||
        helpers.emptyInterconsultationDiagnosis('def');
    const studySelections = hydratedLabOrder
        ? helpers.normalizeLabOrderStudySelections(hydratedLabOrder.studySelections)
        : helpers.normalizeLabOrderStudySelections({});
    const selectedStudies = helpers.flattenLabOrderStudySelections(studySelections);

    return helpers.buildClinicalHistorySection(
        'Laboratorio HCU-form.010A/2008',
        'Solicitud formal de laboratorio clinico trazable al formulario MSP, con emision y cancelacion documentadas por episodio.',
        `
                <input
                    type="hidden"
                    id="lab_order_active_id"
                    name="lab_order_active_id"
                    value="${escapeHtml(activeLabOrderId)}"
                />
                <div class="clinical-history-summary-grid">
                    ${helpers.summaryStatCard(
                        'HCU-010A',
                        activeStatus.label,
                        activeStatus.summary,
                        activeStatus.status === 'issued'
                            ? 'success'
                            : [
                                    'ready_to_issue',
                                    'incomplete',
                                    'draft',
                                ].includes(activeStatus.status)
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Paciente / HCU',
                        hydratedLabOrder?.patientName ||
                            helpers.buildAdmissionLegalName(
                                draft.admission001,
                                review.session.patient
                            ) ||
                            'Sin paciente',
                        [
                            hydratedLabOrder?.patientDocumentNumber,
                            hydratedLabOrder?.patientRecordId,
                        ]
                            .filter(Boolean)
                            .join(' • ') || 'Sin documento',
                        'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Solicitante',
                        hydratedLabOrder?.requestingService ||
                            helpers.resolveClinicProfileDisplay().serviceLabel,
                        hydratedLabOrder?.requestingEstablishment ||
                            helpers.resolveClinicProfileDisplay().establishmentLabel,
                        'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Estudios',
                        String(selectedStudies.length),
                        selectedStudies.length > 0
                            ? selectedStudies.slice(0, 3).join(' • ')
                            : 'Sin estudios seleccionados',
                        selectedStudies.length > 0 ? 'success' : 'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Snapshots',
                        String(labOrderSnapshots.length),
                        labOrderSnapshots.length > 0
                            ? 'Snapshots emitidos o cancelados del HCU-010A.'
                            : 'Todavia no hay snapshots HCU-010A emitidos.',
                        labOrderSnapshots.length > 0 ? 'success' : 'neutral'
                    )}
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        data-clinical-review-action="create-lab-order"
                        ${disabled ? 'disabled' : ''}
                    >
                        Nueva solicitud de laboratorio
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="issue-current-lab-order"
                        ${disabled || !hydratedLabOrder ? 'disabled' : ''}
                    >
                        Emitir solicitud
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="cancel-current-lab-order"
                        ${disabled || !hydratedLabOrder ? 'disabled' : ''}
                    >
                        Cancelar solicitud
                    </button>
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    ${labOrders
                        .map((item) =>
                            buildLabOrderChip(item, activeLabOrderId, disabled)
                        )
                        .join('')}
                </div>
                ${
                    !hydratedLabOrder
                        ? helpers.buildEmptyClinicalCard(
                              'Sin solicitud activa',
                              'Crea una solicitud de laboratorio del episodio para empezar el HCU-010A.'
                          )
                        : `
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'lab_order_requested_at',
                                    'Fecha/hora de solicitud',
                                    hydratedLabOrder.requestedAt,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'lab_order_sample_date',
                                    'Fecha de toma',
                                    hydratedLabOrder.sampleDate,
                                    { disabled }
                                ),
                                helpers.selectField(
                                    'lab_order_priority',
                                    'Prioridad',
                                    hydratedLabOrder.priority,
                                    CLINICAL_HISTORY_LAB_ORDER_PRIORITY_CHOICES,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'lab_order_requested_by',
                                    'Profesional solicitante',
                                    hydratedLabOrder.requestedBy,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.checkboxField(
                                'lab_order_required_for_current_plan',
                                'La solicitud de laboratorio es parte del plan actual',
                                hydratedLabOrder.requiredForCurrentPlan ===
                                    true,
                                {
                                    hint: 'Si esta marcada, la aprobacion final exige emitirla o cancelarla.',
                                    disabled,
                                }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'lab_order_patient_name',
                                    'Paciente',
                                    hydratedLabOrder.patientName,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'lab_order_patient_record',
                                    'Documento / HCU',
                                    [
                                        hydratedLabOrder.patientDocumentNumber,
                                        hydratedLabOrder.patientRecordId,
                                    ]
                                        .filter(Boolean)
                                        .join(' '),
                                    { disabled: true }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'lab_order_requesting_establishment',
                                    'Establecimiento solicitante',
                                    hydratedLabOrder.requestingEstablishment,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'lab_order_requesting_service',
                                    'Servicio solicitante',
                                    hydratedLabOrder.requestingService,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'lab_order_care_site',
                                    'Sala / sitio',
                                    hydratedLabOrder.careSite,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'lab_order_bed_label',
                                    'Cama / referencia',
                                    hydratedLabOrder.bedLabel,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'lab_order_diagnosis_pre_label',
                                    'Diagnostico PRE',
                                    preDiagnosis.label,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'lab_order_diagnosis_pre_cie10',
                                    'CIE-10 PRE',
                                    preDiagnosis.cie10,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'lab_order_diagnosis_def_label',
                                    'Diagnostico DEF',
                                    defDiagnosis.label,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'lab_order_diagnosis_def_cie10',
                                    'CIE-10 DEF',
                                    defDiagnosis.cie10,
                                    { disabled }
                                ),
                            ])}
                            ${buildLabOrderStudyChecklist(
                                'hematology',
                                'Hematologia',
                                studySelections.hematology,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'urinalysis',
                                'Uroanalisis',
                                studySelections.urinalysis,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'coprological',
                                'Coprologico',
                                studySelections.coprological,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'bloodChemistry',
                                'Quimica sanguinea',
                                studySelections.bloodChemistry,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'serology',
                                'Serologia',
                                studySelections.serology,
                                disabled
                            )}
                            ${buildLabOrderStudyChecklist(
                                'bacteriology',
                                'Bacteriologia',
                                studySelections.bacteriology,
                                disabled
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'lab_order_bacteriology_sample_source',
                                    'Muestra de',
                                    hydratedLabOrder.bacteriologySampleSource,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'lab_order_study_others',
                                    'Otros examenes',
                                    studySelections.others,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.checkboxField(
                                'lab_order_physician_present',
                                'El medico estara presente en el examen',
                                hydratedLabOrder.physicianPresentAtExam ===
                                    true,
                                {
                                    hint: 'Campo opcional del formulario cuando aplica.',
                                    disabled,
                                }
                            )}
                            ${helpers.textareaField(
                                'lab_order_notes',
                                'Observaciones',
                                hydratedLabOrder.notes,
                                {
                                    rows: 3,
                                    placeholder:
                                        'Condiciones de toma, observaciones o instrucciones clinicas complementarias.',
                                    disabled,
                                }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'lab_order_issued_at',
                                    'Emitida el',
                                    hydratedLabOrder.issuedAt,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'lab_order_cancelled_at',
                                    'Cancelada el',
                                    hydratedLabOrder.cancelledAt,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'lab_order_cancel_reason',
                                    'Razon de cancelacion',
                                    hydratedLabOrder.cancelReason,
                                    { disabled }
                                ),
                            ])}
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Snapshots documentales HCU-010A</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        String(labOrderSnapshots.length)
                                    )}</span>
                                </div>
                                <div class="clinical-history-events">
                                    ${
                                        labOrderSnapshots.length === 0
                                            ? helpers.buildEmptyClinicalCard(
                                                  'Sin snapshots emitidos',
                                                  'Las solicitudes emitidas o canceladas quedaran congeladas aqui.'
                                              )
                                            : labOrderSnapshots
                                                  .map(
                                                      (snapshot) => `
                                                            <article class="clinical-history-event-card" data-tone="neutral">
                                                                <div class="clinical-history-event-head">
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        helpers.hcu010AStatusMeta(
                                                                            snapshot.status
                                                                        ).label
                                                                    )}</span>
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        helpers.readableTimestamp(
                                                                            snapshot.finalizedAt ||
                                                                                snapshot.snapshotAt
                                                                        )
                                                                    )}</span>
                                                                </div>
                                                                <p>${escapeHtml(
                                                                    helpers.flattenLabOrderStudySelections(
                                                                        snapshot.studySelections
                                                                    ).join(
                                                                        ' • '
                                                                    ) ||
                                                                        'Sin estudios visibles'
                                                                )}</p>
                                                            </article>
                                                        `
                                                  )
                                                  .join('')
                                    }
                                </div>
                            </div>
                        `
                }
            `
    );
}

export function buildImagingOrderChip(imagingOrder, activeImagingOrderId, disabled) {
    const normalized = helpers.normalizeImagingOrder(imagingOrder);
    const status = helpers.hcu012AStatusMeta(helpers.evaluateImagingOrder(normalized).status);
    const isActive =
        helpers.normalizeString(normalized.imagingOrderId) ===
        helpers.normalizeString(activeImagingOrderId);

    return `
        <button
            type="button"
            class="clinical-history-workspace-tab${isActive ? ' is-active' : ''}"
            data-clinical-review-action="select-imaging-order"
            data-imaging-order-id="${escapeHtml(normalized.imagingOrderId)}"
            ${disabled ? 'disabled' : ''}
        >
            <strong>${escapeHtml(
                normalized.studyDate ||
                    normalized.requestedAt ||
                    'Orden imagenologia'
            )}</strong>
            <small>${escapeHtml(status.label)}</small>
        </button>
    `;
}

export function buildClinicalHistoryImagingOrderSection(review, draft, disabled) {
    const imagingOrders = helpers.normalizeImagingOrders(draft.imagingOrders);
    const activeImagingOrderId = helpers.normalizeString(draft.activeImagingOrderId);
    const activeImagingOrder =
        imagingOrders.find(
            (item) =>
                helpers.normalizeString(item.imagingOrderId) === activeImagingOrderId
        ) || null;
    const hydratedImagingOrder = activeImagingOrder
        ? helpers.deriveImagingOrderContext(
              activeImagingOrder,
              draft,
              review.session.patient
          )
        : null;
    const evaluation = hydratedImagingOrder
        ? helpers.evaluateImagingOrder(hydratedImagingOrder)
        : { status: 'not_applicable', selectedStudiesCount: 0 };
    const activeStatus = helpers.hcu012AStatusMeta(evaluation.status);
    const imagingSnapshots = helpers.normalizeImagingOrderSnapshots(
        draft.documents.imagingOrders
    );
    const activeReport = hydratedImagingOrder
        ? helpers.normalizeImagingReport(hydratedImagingOrder.result)
        : helpers.emptyImagingReport();
    const activeReportStatus = helpers.hcu012AReportStatusMeta(
        hydratedImagingOrder
            ? helpers.evaluateImagingReport(activeReport).status
            : 'not_received'
    );
    const imagingReportSnapshots = helpers.normalizeImagingReportSnapshots(
        draft.documents.imagingReports
    );
    const diagnoses = hydratedImagingOrder
        ? helpers.normalizeInterconsultationDiagnoses(hydratedImagingOrder.diagnoses)
        : helpers.normalizeInterconsultationDiagnoses([]);
    const preDiagnosis =
        diagnoses.find((item) => item.type === 'pre') ||
        helpers.emptyInterconsultationDiagnosis('pre');
    const defDiagnosis =
        diagnoses.find((item) => item.type === 'def') ||
        helpers.emptyInterconsultationDiagnosis('def');
    const studySelections = hydratedImagingOrder
        ? helpers.normalizeImagingStudySelections(hydratedImagingOrder.studySelections)
        : helpers.normalizeImagingStudySelections({});
    const selectedStudies = helpers.flattenImagingStudySelections(studySelections);
    const supportAttachments = helpers.normalizeAttachmentList(draft.intake.adjuntos);
    const selectedAttachmentIds = new Set(
        helpers.normalizeAttachmentList(activeReport.attachments).map((attachment) =>
            String(attachment.id || '')
        )
    );
    const attachmentSelector =
        supportAttachments.length > 0
            ? supportAttachments
                  .map((attachment) => {
                      const attachmentId = String(attachment.id || '');
                      const checked =
                          attachmentId &&
                          selectedAttachmentIds.has(attachmentId);
                      const meta = [
                          helpers.normalizeString(attachment.kind) || 'archivo',
                          helpers.normalizeString(attachment.mime),
                          attachment.size > 0
                              ? helpers.formatBytes(attachment.size)
                              : '',
                      ]
                          .filter(Boolean)
                          .join(' • ');
                      return `
                            <label class="clinical-history-inline-checkbox">
                                <input
                                    type="checkbox"
                                    name="imaging_report_attachment_ids"
                                    value="${escapeHtml(attachmentId)}"
                                    ${checked ? 'checked' : ''}
                                    ${disabled ? 'disabled' : ''}
                                />
                                <span>
                                    <strong>${escapeHtml(
                                        attachment.originalName ||
                                            `Adjunto ${attachmentId}`
                                    )}</strong>
                                    <small>${escapeHtml(meta || 'Soporte clínico')}</small>
                                </span>
                            </label>
                        `;
                  })
                  .join('')
            : helpers.buildEmptyClinicalCard(
                  'Sin adjuntos clínicos disponibles',
                  'Cuando el caso tenga adjuntos de clinical_uploads podrás seleccionarlos como respaldo del informe radiológico.'
              );

    return helpers.buildClinicalHistorySection(
        'Imagenologia HCU-form.012A/2008',
        'Solicitud formal de imagenologia trazable al formulario MSP, con emision, cancelacion y recepcion estructurada del resultado radiologico por episodio.',
        `
                <input
                    type="hidden"
                    id="imaging_order_active_id"
                    name="imaging_order_active_id"
                    value="${escapeHtml(activeImagingOrderId)}"
                />
                <div class="clinical-history-summary-grid">
                    ${helpers.summaryStatCard(
                        'HCU-012A',
                        activeStatus.label,
                        activeStatus.summary,
                        ['issued', 'received'].includes(activeStatus.status)
                            ? 'success'
                            : [
                                    'ready_to_issue',
                                    'incomplete',
                                    'draft',
                                ].includes(activeStatus.status)
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Paciente / HCU',
                        hydratedImagingOrder?.patientName ||
                            helpers.buildAdmissionLegalName(
                                draft.admission001,
                                review.session.patient
                            ) ||
                            'Sin paciente',
                        [
                            hydratedImagingOrder?.patientDocumentNumber,
                            hydratedImagingOrder?.patientRecordId,
                        ]
                            .filter(Boolean)
                            .join(' • ') || 'Sin documento',
                        'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Solicitante',
                        hydratedImagingOrder?.requestingService ||
                            helpers.resolveClinicProfileDisplay().serviceLabel,
                        hydratedImagingOrder?.requestingEstablishment ||
                            helpers.resolveClinicProfileDisplay().establishmentLabel,
                        'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Estudios',
                        String(selectedStudies.length),
                        selectedStudies.length > 0
                            ? selectedStudies.slice(0, 3).join(' • ')
                            : 'Sin estudios seleccionados',
                        selectedStudies.length > 0 ? 'success' : 'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Resultado',
                        activeReportStatus.label,
                        activeReportStatus.summary,
                        activeReportStatus.status === 'received'
                            ? 'success'
                            : ['ready_to_receive', 'draft'].includes(
                                    activeReportStatus.status
                                )
                              ? 'warning'
                              : 'neutral'
                    )}
                    ${helpers.summaryStatCard(
                        'Snapshots',
                        String(
                            imagingSnapshots.length +
                                imagingReportSnapshots.length
                        ),
                        imagingSnapshots.length +
                            imagingReportSnapshots.length >
                            0
                            ? 'Incluye snapshots emitidos/cancelados y resultados radiologicos recibidos.'
                            : 'Todavia no hay snapshots HCU-012A emitidos.',
                        imagingSnapshots.length +
                            imagingReportSnapshots.length >
                            0
                            ? 'success'
                            : 'neutral'
                    )}
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    <button
                        type="button"
                        data-clinical-review-action="create-imaging-order"
                        ${disabled ? 'disabled' : ''}
                    >
                        Nueva solicitud de imagenologia
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="issue-current-imaging-order"
                        ${disabled || !hydratedImagingOrder ? 'disabled' : ''}
                    >
                        Emitir solicitud
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="cancel-current-imaging-order"
                        ${disabled || !hydratedImagingOrder ? 'disabled' : ''}
                    >
                        Cancelar solicitud
                    </button>
                    <button
                        type="button"
                        data-clinical-review-action="receive-current-imaging-report"
                        ${disabled || !hydratedImagingOrder ? 'disabled' : ''}
                    >
                        Recibir resultado
                    </button>
                </div>
                <div class="toolbar-row clinical-history-actions-row">
                    ${imagingOrders
                        .map((item) =>
                            buildImagingOrderChip(
                                item,
                                activeImagingOrderId,
                                disabled
                            )
                        )
                        .join('')}
                </div>
                ${
                    !hydratedImagingOrder
                        ? helpers.buildEmptyClinicalCard(
                              'Sin solicitud activa',
                              'Crea una solicitud de imagenologia del episodio para empezar el HCU-012A.'
                          )
                        : `
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'imaging_order_requested_at',
                                    'Fecha/hora de solicitud',
                                    hydratedImagingOrder.requestedAt,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'imaging_order_study_date',
                                    'Fecha de toma',
                                    hydratedImagingOrder.studyDate,
                                    { disabled }
                                ),
                                helpers.selectField(
                                    'imaging_order_priority',
                                    'Prioridad',
                                    hydratedImagingOrder.priority,
                                    CLINICAL_HISTORY_LAB_ORDER_PRIORITY_CHOICES,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'imaging_order_requested_by',
                                    'Profesional solicitante',
                                    hydratedImagingOrder.requestedBy,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.checkboxField(
                                'imaging_order_required_for_current_plan',
                                'La solicitud de imagenologia es parte del plan actual',
                                hydratedImagingOrder.requiredForCurrentPlan ===
                                    true,
                                {
                                    hint: 'Si esta marcada, la aprobacion final exige emitirla o cancelarla.',
                                    disabled,
                                }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'imaging_order_patient_name',
                                    'Paciente',
                                    hydratedImagingOrder.patientName,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'imaging_order_patient_record',
                                    'Documento / HCU',
                                    [
                                        hydratedImagingOrder.patientDocumentNumber,
                                        hydratedImagingOrder.patientRecordId,
                                    ]
                                        .filter(Boolean)
                                        .join(' '),
                                    { disabled: true }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'imaging_order_requesting_establishment',
                                    'Establecimiento solicitante',
                                    hydratedImagingOrder.requestingEstablishment,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'imaging_order_requesting_service',
                                    'Servicio solicitante',
                                    hydratedImagingOrder.requestingService,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'imaging_order_care_site',
                                    'Sala / sitio',
                                    hydratedImagingOrder.careSite,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'imaging_order_bed_label',
                                    'Cama / referencia',
                                    hydratedImagingOrder.bedLabel,
                                    { disabled }
                                ),
                            ])}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'imaging_order_diagnosis_pre_label',
                                    'Diagnostico PRE',
                                    preDiagnosis.label,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'imaging_order_diagnosis_pre_cie10',
                                    'CIE-10 PRE',
                                    preDiagnosis.cie10,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'imaging_order_diagnosis_def_label',
                                    'Diagnostico DEF',
                                    defDiagnosis.label,
                                    { disabled }
                                ),
                                helpers.inputField(
                                    'imaging_order_diagnosis_def_cie10',
                                    'CIE-10 DEF',
                                    defDiagnosis.cie10,
                                    { disabled }
                                ),
                            ])}
                            ${CLINICAL_HISTORY_IMAGING_STUDY_GROUPS.map(
                                ({ key, label, hint }) =>
                                    buildImagingStudyGroupField(
                                        key,
                                        label,
                                        studySelections[key],
                                        hint,
                                        disabled
                                    )
                            ).join('')}
                            ${helpers.textareaField(
                                'imaging_order_request_reason',
                                'Motivo de la solicitud',
                                hydratedImagingOrder.requestReason,
                                {
                                    rows: 3,
                                    placeholder:
                                        'Registra las razones para solicitar aclaracion diagnostica o apoyo por imagen.',
                                    disabled,
                                }
                            )}
                            ${helpers.textareaField(
                                'imaging_order_clinical_summary',
                                'Resumen clinico',
                                hydratedImagingOrder.clinicalSummary,
                                {
                                    rows: 4,
                                    placeholder:
                                        'Sintesis clinica relevante para el estudio solicitado.',
                                    disabled,
                                }
                            )}
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.checkboxField(
                                    'imaging_order_can_mobilize',
                                    'Puede movilizarse',
                                    hydratedImagingOrder.canMobilize === true,
                                    { disabled }
                                ),
                                helpers.checkboxField(
                                    'imaging_order_can_remove_dressings',
                                    'Puede retirarse vendas, apositos o yesos',
                                    hydratedImagingOrder.canRemoveDressingsOrCasts ===
                                        true,
                                    { disabled }
                                ),
                                helpers.checkboxField(
                                    'imaging_order_physician_present',
                                    'El medico estara presente en el examen',
                                    hydratedImagingOrder.physicianPresentAtExam ===
                                        true,
                                    { disabled }
                                ),
                                helpers.checkboxField(
                                    'imaging_order_bedside_radiography',
                                    'Toma de radiografia en la cama',
                                    hydratedImagingOrder.bedsideRadiography ===
                                        true,
                                    {
                                        hint: 'Si la marcas, debe existir al menos un estudio en R-X convencional.',
                                        disabled,
                                    }
                                ),
                            ])}
                            ${helpers.textareaField(
                                'imaging_order_notes',
                                'Observaciones',
                                hydratedImagingOrder.notes,
                                {
                                    rows: 3,
                                    placeholder:
                                        'Condiciones logisticas, observaciones o instrucciones complementarias.',
                                    disabled,
                                }
                            )}
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Resultado / informe radiologico</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        activeReportStatus.label
                                    )}</span>
                                </div>
                                ${helpers.buildClinicalHistoryInlineGrid([
                                    helpers.inputField(
                                        'imaging_report_reported_at',
                                        'Fecha/hora del informe',
                                        activeReport.reportedAt,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'imaging_report_reported_by',
                                        'Cargado por',
                                        activeReport.reportedBy,
                                        {
                                            disabled,
                                            placeholder:
                                                'Staff o medico que registra el resultado',
                                        }
                                    ),
                                    helpers.inputField(
                                        'imaging_report_reporting_establishment',
                                        'Establecimiento respondiente',
                                        activeReport.reportingEstablishment,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'imaging_report_reporting_service',
                                        'Servicio respondiente',
                                        activeReport.reportingService,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'imaging_report_radiologist_professional_name',
                                        'Profesional/radiologo',
                                        activeReport.radiologistProfessionalName,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'imaging_report_radiologist_professional_role',
                                        'Rol del profesional',
                                        activeReport.radiologistProfessionalRole,
                                        { disabled }
                                    ),
                                ])}
                                ${helpers.textareaField(
                                    'imaging_report_study_performed_summary',
                                    'Estudio realizado',
                                    activeReport.studyPerformedSummary,
                                    {
                                        rows: 2,
                                        placeholder:
                                            'Describe el estudio efectivamente realizado o la modalidad reportada.',
                                        disabled,
                                    }
                                )}
                                ${helpers.textareaField(
                                    'imaging_report_findings',
                                    'Hallazgos',
                                    activeReport.findings,
                                    {
                                        rows: 3,
                                        placeholder:
                                            'Hallazgos radiologicos relevantes del informe.',
                                        disabled,
                                    }
                                )}
                                ${helpers.textareaField(
                                    'imaging_report_diagnostic_impression',
                                    'Impresion diagnostica',
                                    activeReport.diagnosticImpression,
                                    {
                                        rows: 3,
                                        placeholder:
                                            'Criterio o impresion diagnostica del estudio.',
                                        disabled,
                                    }
                                )}
                                ${helpers.textareaField(
                                    'imaging_report_recommendations',
                                    'Recomendaciones',
                                    activeReport.recommendations,
                                    {
                                        rows: 3,
                                        placeholder:
                                            'Recomendaciones o conducta sugerida desde imagenologia.',
                                        disabled,
                                    }
                                )}
                                ${helpers.textareaField(
                                    'imaging_report_follow_up_indications',
                                    'Indicaciones de seguimiento',
                                    activeReport.followUpIndications,
                                    {
                                        rows: 2,
                                        placeholder:
                                            'Indicaciones posteriores o hallazgos a vigilar.',
                                        disabled,
                                    }
                                )}
                                ${helpers.buildClinicalHistoryInlineGrid([
                                    helpers.inputField(
                                        'imaging_report_source_document_type',
                                        'Tipo de documento fuente',
                                        activeReport.sourceDocumentType,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'imaging_report_source_reference',
                                        'Referencia del documento',
                                        activeReport.sourceReference,
                                        { disabled }
                                    ),
                                    helpers.inputField(
                                        'imaging_report_received_by',
                                        'Recibido por',
                                        activeReport.receivedBy,
                                        { disabled: true }
                                    ),
                                ])}
                                <div class="clinical-history-section-block">
                                    <div class="clinical-history-event-head">
                                        <strong>Adjuntos del informe</strong>
                                        <span class="clinical-history-mini-chip">${escapeHtml(
                                            String(
                                                activeReport.attachments.length
                                            )
                                        )}</span>
                                    </div>
                                    <div class="clinical-history-inline-checks">
                                        ${attachmentSelector}
                                    </div>
                                    <small>Reutiliza adjuntos ya cargados por clinical_uploads.</small>
                                </div>
                                ${
                                    activeReportStatus.status === 'received'
                                        ? `
                                            <div class="clinical-history-section-block">
                                                <div class="clinical-history-event-head">
                                                    <strong>Reconciliacion manual requerida</strong>
                                                </div>
                                                <p>Informe recibido: reconciliar manualmente en HCU-005/HCU-024 si aplica.</p>
                                            </div>
                                        `
                                        : ''
                                }
                            </div>
                            ${helpers.buildClinicalHistoryInlineGrid([
                                helpers.inputField(
                                    'imaging_order_issued_at',
                                    'Emitida el',
                                    hydratedImagingOrder.issuedAt,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'imaging_order_cancelled_at',
                                    'Cancelada el',
                                    hydratedImagingOrder.cancelledAt,
                                    { disabled: true }
                                ),
                                helpers.inputField(
                                    'imaging_order_cancel_reason',
                                    'Razon de cancelacion',
                                    hydratedImagingOrder.cancelReason,
                                    { disabled }
                                ),
                            ])}
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Snapshots documentales HCU-012A</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        String(imagingSnapshots.length)
                                    )}</span>
                                </div>
                                <div class="clinical-history-events">
                                    ${
                                        imagingSnapshots.length === 0
                                            ? helpers.buildEmptyClinicalCard(
                                                  'Sin snapshots emitidos',
                                                  'Las solicitudes emitidas o canceladas quedaran congeladas aqui.'
                                              )
                                            : imagingSnapshots
                                                  .map(
                                                      (snapshot) => `
                                                            <article class="clinical-history-event-card" data-tone="neutral">
                                                                <div class="clinical-history-event-head">
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        helpers.hcu012AStatusMeta(
                                                                            snapshot.status
                                                                        ).label
                                                                    )}</span>
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        helpers.readableTimestamp(
                                                                            snapshot.finalizedAt ||
                                                                                snapshot.snapshotAt
                                                                        )
                                                                    )}</span>
                                                                </div>
                                                                <p>${escapeHtml(
                                                                    helpers.flattenImagingStudySelections(
                                                                        snapshot.studySelections
                                                                    ).join(
                                                                        ' • '
                                                                    ) ||
                                                                        'Sin estudios visibles'
                                                                )}</p>
                                                            </article>
                                                        `
                                                  )
                                                  .join('')
                                    }
                                </div>
                            </div>
                            <div class="clinical-history-section-block">
                                <div class="clinical-history-event-head">
                                    <strong>Snapshots de resultados radiologicos</strong>
                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                        String(imagingReportSnapshots.length)
                                    )}</span>
                                </div>
                                <div class="clinical-history-events">
                                    ${
                                        imagingReportSnapshots.length === 0
                                            ? helpers.buildEmptyClinicalCard(
                                                  'Sin resultados recibidos',
                                                  'Los resultados radiologicos recibidos quedaran congelados aqui como respaldo documental.'
                                              )
                                            : imagingReportSnapshots
                                                  .map(
                                                      (snapshot) => `
                                                            <article class="clinical-history-event-card" data-tone="neutral">
                                                                <div class="clinical-history-event-head">
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        helpers.hcu012AReportStatusMeta(
                                                                            snapshot.reportStatus
                                                                        ).label
                                                                    )}</span>
                                                                    <span class="clinical-history-mini-chip">${escapeHtml(
                                                                        helpers.readableTimestamp(
                                                                            snapshot.finalizedAt ||
                                                                                snapshot.snapshotAt
                                                                        )
                                                                    )}</span>
                                                                </div>
                                                                <p>${escapeHtml(
                                                                    snapshot
                                                                        .report
                                                                        ?.studyPerformedSummary ||
                                                                        snapshot
                                                                            .report
                                                                            ?.diagnosticImpression ||
                                                                        snapshot
                                                                            .report
                                                                            ?.findings ||
                                                                        'Sin resumen visible'
                                                                )}</p>
                                                            </article>
                                                        `
                                                  )
                                                  .join('')
                                    }
                                </div>
                            </div>
                        `
                }
            `
    );
}

export function buildConsentPacketChip(packet, activePacketId, disabled) {
    const normalized = normalizeConsentPacket(packet);
    const status = helpers.hcu024StatusMeta(evaluateConsentPacket(normalized).status);
    const isActive =
        helpers.normalizeString(normalized.packetId) ===
        helpers.normalizeString(activePacketId);

    return `
        <button
            type="button"
            class="clinical-history-workspace-tab${isActive ? ' is-active' : ''}"
            data-clinical-draft-action="select-consent-packet-local"
            data-packet-id="${escapeHtml(normalized.packetId)}"
            ${disabled ? 'disabled' : ''}
        >
            <strong>${escapeHtml(
                normalized.procedureLabel || 'Consentimiento'
            )}</strong>
            <small>${escapeHtml(status.label)}</small>
        </button>
    `;
}

export function buildLabOrderStudyChecklist(
    groupKey,
    label,
    selectedValues,
    disabled
) {
    const options = helpers.normalizeList(CLINICAL_HISTORY_LAB_STUDY_OPTIONS[groupKey]);
    const selected = new Set(helpers.normalizeStringList(selectedValues));

    return `
        <div class="clinical-history-section-block">
            <div class="clinical-history-event-head">
                <strong>${escapeHtml(label)}</strong>
                <span class="clinical-history-mini-chip">${escapeHtml(
                    String(selected.size)
                )}</span>
            </div>
            <div class="clinical-history-events">
                ${options
                    .map(
                        (option, index) => `
                            <label class="clinical-history-inline-checkbox">
                                <input
                                    type="checkbox"
                                    id="lab_order_study_${escapeHtml(
                                        groupKey
                                    )}_${index}"
                                    name="lab_order_study_${escapeHtml(
                                        groupKey
                                    )}"
                                    value="${escapeHtml(option)}"
                                    ${
                                        selected.has(helpers.normalizeString(option))
                                            ? 'checked'
                                            : ''
                                    }
                                    ${disabled ? 'disabled' : ''}
                                />
                                <span>${escapeHtml(option)}</span>
                            </label>
                        `
                    )
                    .join('')}
            </div>
        </div>
    `;
}

export function buildImagingStudyGroupField(groupKey, label, value, hint, disabled) {
    return helpers.textareaField(
        `imaging_order_studies_${groupKey}`,
        label,
        helpers.formatTextareaList(value),
        {
            rows: 3,
            hint,
            placeholder: 'Una linea por estudio',
            disabled,
        }
    );
}

export function normalizeDocuments(documents) {
    const defaults = helpers.emptyDraft().documents;
    const source = documents && typeof documents === 'object' ? documents : {};
    const hcu001Source =
        source?.finalNote?.sections?.hcu001 &&
        typeof source.finalNote.sections.hcu001 === 'object'
            ? source.finalNote.sections.hcu001
            : {};
    const sectionSource =
        source?.finalNote?.sections?.hcu005 &&
        typeof source.finalNote.sections.hcu005 === 'object'
            ? source.finalNote.sections.hcu005
            : {};
    const hcu001 = helpers.normalizeAdmission001(hcu001Source);
    const fallbackHcu005 = helpers.normalizeHcu005({
        evolutionNote: source?.finalNote?.summary,
        diagnosticImpression: '',
        therapeuticPlan: '',
        careIndications: source?.prescription?.directions,
        prescriptionItems:
            source?.prescription?.items || source?.prescriptionItems || [],
    });
    const hcu005 = helpers.normalizeHcu005(sectionSource, fallbackHcu005);
    const prescriptionItems = normalizePrescriptionItems(
        source?.prescription?.items ||
            source?.prescriptionItems ||
            hcu005.prescriptionItems ||
            []
    );
    const summary = helpers.renderHcu005Summary(hcu005);
    const content = helpers.renderHcu005Content(hcu005);
    const medication = renderPrescriptionMedicationMirror(prescriptionItems);
    const directions = renderPrescriptionDirectionsMirror(prescriptionItems);
    const interconsultForms = helpers.normalizeInterconsultFormSnapshots(
        source?.interconsultForms
    );
    const interconsultReports = helpers.normalizeInterconsultReportSnapshots(
        source?.interconsultReports
    );
    const labOrders = helpers.normalizeLabOrderSnapshots(source?.labOrders);
    const imagingOrders = helpers.normalizeImagingOrderSnapshots(source?.imagingOrders);
    const imagingReports = helpers.normalizeImagingReportSnapshots(
        source?.imagingReports
    );
    const consentForms = normalizeConsentFormSnapshots(source?.consentForms);

    return {
        finalNote: {
            ...defaults.finalNote,
            ...(source.finalNote && typeof source.finalNote === 'object'
                ? source.finalNote
                : {}),
            status: helpers.normalizeString(
                source?.finalNote?.status || defaults.finalNote.status
            ),
            summary,
            content,
            version: Math.max(
                1,
                helpers.normalizeNumber(
                    source?.finalNote?.version || defaults.finalNote.version
                )
            ),
            generatedAt: helpers.normalizeString(source?.finalNote?.generatedAt),
            confidential: source?.finalNote?.confidential !== false,
            sections: {
                hcu001,
                hcu005,
            },
        },
        prescription: {
            ...defaults.prescription,
            ...(source.prescription && typeof source.prescription === 'object'
                ? source.prescription
                : {}),
            status: helpers.normalizeString(
                source?.prescription?.status || defaults.prescription.status
            ),
            medication,
            directions,
            signedAt: helpers.normalizeString(source?.prescription?.signedAt),
            confidential: source?.prescription?.confidential !== false,
            items: prescriptionItems,
        },
        certificate: {
            ...defaults.certificate,
            ...(source.certificate && typeof source.certificate === 'object'
                ? source.certificate
                : {}),
            status: helpers.normalizeString(
                source?.certificate?.status || defaults.certificate.status
            ),
            summary: helpers.normalizeString(source?.certificate?.summary),
            restDays: helpers.normalizeNullableInt(source?.certificate?.restDays),
            signedAt: helpers.normalizeString(source?.certificate?.signedAt),
            confidential: source?.certificate?.confidential !== false,
        },
        carePlan: {
            ...defaults.carePlan,
            ...(source.carePlan && typeof source.carePlan === 'object'
                ? source.carePlan
                : {}),
            status: helpers.normalizeString(
                source?.carePlan?.status || defaults.carePlan.status
            ),
            diagnosis: helpers.normalizeString(source?.carePlan?.diagnosis),
            treatments: helpers.normalizeString(source?.carePlan?.treatments),
            followUpFrequency: helpers.normalizeString(source?.carePlan?.followUpFrequency),
            goals: helpers.normalizeString(source?.carePlan?.goals),
            generatedAt: helpers.normalizeString(source?.carePlan?.generatedAt),
        },
        interconsultForms,
        interconsultReports,
        labOrders,
        imagingOrders,
        imagingReports,
        consentForms,
    };
}

