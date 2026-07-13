const IMAGE_SUFFIX_BY_TYPE = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
};

function isImageFile(file) {
    if (!file) return false;
    if ((file.type || '').startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(file.name || '');
}

function timestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        '-',
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds()),
    ].join('');
}

function normalizeClipboardFile(file, index = 0) {
    if (!file || file.name) return file;
    const suffix = IMAGE_SUFFIX_BY_TYPE[file.type] || 'png';
    return new File([file], `pasted-image-${timestamp()}-${index + 1}.${suffix}`, {
        type: file.type || 'image/png',
        lastModified: Date.now(),
    });
}

export function getImageFilesFromClipboard(clipboardData) {
    if (!clipboardData) return [];

    const files = [];
    const items = Array.from(clipboardData.items || []);
    for (const item of items) {
        if (!item.type?.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (file) files.push(normalizeClipboardFile(file, files.length));
    }

    if (files.length === 0) {
        for (const file of Array.from(clipboardData.files || [])) {
            if (isImageFile(file)) files.push(normalizeClipboardFile(file, files.length));
        }
    }

    return files;
}

export function getImageFilesFromList(fileList) {
    return Array.from(fileList || []).filter(isImageFile);
}

export function mergeImageFiles(currentFiles, incomingFiles, multiple = true) {
    const next = [...(currentFiles || []), ...(incomingFiles || [])];
    return multiple ? next : next.slice(-1);
}
