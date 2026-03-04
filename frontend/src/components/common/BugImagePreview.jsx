import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import projectApi from '@/api/project';
import './BugImagePreview.css';

export default function BugImagePreview({ projectId, bugImage, compact = false }) {
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [zoom, setZoom] = useState(1);

    const attachmentId = bugImage?.attachment_id;
    const fileName = bugImage?.file_name || 'Bug 图片';
    const canShow = Boolean(projectId && attachmentId);

    useEffect(() => {
        let revokedUrl = '';
        let alive = true;
        const loadImage = async () => {
            if (!canShow) return;
            try {
                setLoading(true);
                setError('');
                const res = await projectApi.downloadProjectAttachment(projectId, attachmentId);
                const blob = new Blob([res.data], { type: bugImage?.content_type || 'application/octet-stream' });
                revokedUrl = URL.createObjectURL(blob);
                if (!alive) return;
                setImageUrl(revokedUrl);
            } catch (err) {
                if (!alive) return;
                setError(err?.response?.data?.message || err?.message || '图片加载失败');
            } finally {
                if (alive) setLoading(false);
            }
        };

        loadImage();
        return () => {
            alive = false;
            if (revokedUrl) URL.revokeObjectURL(revokedUrl);
        };
    }, [projectId, attachmentId, bugImage?.content_type, canShow]);

    const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

    if (!canShow) return null;

    return (
        <>
            <button
                type="button"
                className={`bug-image-trigger ${compact ? 'compact' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!imageUrl) return;
                    setZoom(1);
                    setViewerOpen(true);
                }}
                title={error || fileName}
                disabled={loading || !imageUrl}
            >
                {imageUrl ? (
                    <img src={imageUrl} alt={fileName} className="bug-image-thumb" />
                ) : (
                    <span className="bug-image-placeholder">{loading ? '加载中...' : '图片不可用'}</span>
                )}
                {!compact && <span className="bug-image-name">{fileName}</span>}
            </button>

            {viewerOpen && (
                <div className="bug-image-viewer" onClick={() => setViewerOpen(false)}>
                    <div className="bug-image-viewer-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="bug-image-toolbar">
                            <strong>{fileName}</strong>
                            <div className="bug-image-toolbar-actions">
                                <button type="button" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))}><Minus size={14} /></button>
                                <span>{zoomLabel}</span>
                                <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}><Plus size={14} /></button>
                                <button type="button" onClick={() => setZoom(1)}>重置</button>
                                <button type="button" onClick={() => setViewerOpen(false)}><X size={14} /></button>
                            </div>
                        </div>
                        <div className="bug-image-stage">
                            <img
                                src={imageUrl}
                                alt={fileName}
                                style={{ transform: `scale(${zoom})` }}
                                className="bug-image-full"
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
