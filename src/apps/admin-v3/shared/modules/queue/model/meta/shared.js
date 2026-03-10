import { asArray } from '../../helpers.js';

export function getQueueMetaCounts(meta) {
    return meta.counts && typeof meta.counts === 'object' ? meta.counts : {};
}

export function getCallingByConsultorio(meta) {
    if (
        meta.callingNowByConsultorio &&
        typeof meta.callingNowByConsultorio === 'object'
    ) {
        return meta.callingNowByConsultorio;
    }
    if (
        meta.calling_now_by_consultorio &&
        typeof meta.calling_now_by_consultorio === 'object'
    ) {
        return meta.calling_now_by_consultorio;
    }
    return {};
}

export function getCallingNowList(meta) {
    return asArray(meta.callingNow).concat(asArray(meta.calling_now));
}
