export function isNumpadEnterEvent(eventInfo, code, key) {
    return (
        code === 'numpadenter' ||
        code === 'kpenter' ||
        (key === 'enter' && Number(eventInfo.location || 0) === 3)
    );
}

export function isNumpadDecimalEvent(code, key) {
    return (
        code === 'numpaddecimal' ||
        code === 'kpdecimal' ||
        key === 'decimal' ||
        key === ',' ||
        key === '.'
    );
}

export function isNumpadSubtractEvent(code, key) {
    return code === 'numpadsubtract' || code === 'kpsubtract' || key === '-';
}

export function isNumpadAddEvent(code, key) {
    return code === 'numpadadd' || code === 'kpadd' || key === '+';
}
