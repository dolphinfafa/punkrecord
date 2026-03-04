import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { todoApi } from '@/api/todo';
import './TodoImagePreview.css';

export default function TodoImagePreview({ todoId, image }) {
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [zoom, setZoom] = useState(1);

    const imageId = image?.id;
    const fileName = image?.file_name || '任务图片';
    const canShow = Boolean(todoId && imageId);

    useEffect(() => {
        let revokedUrl = '';
        let alive = true;
        const loadImage = async () => {
            if (!canShow) return;
            try {
                setLoading(true);
                const res = await todoApi.downloadImage(todoId, imageId);
                const payload = res?.data ?? res;
                const blob = payload instanceof Blob
                    ? payload
                    : new Blob([payload], { type: image?.content_type || 'application/octet-stream' });
                revokedUrl = URL.createObjectURL(blob);
                if (!alive) return;
                setImageUrl(revokedUrl);
            } catch {
                if (!alive) return;
                setImageUrl('');
            } finally {
                if (alive) setLoading(false);
            }
        };
        loadImage();
        return () => {
            alive = false;
            if (revokedUrl) URL.revokeObjectURL(revokedUrl);
        };
    }, [todoId, imageId, image?.content_type, canShow]);

    const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);
    if (!canShow) return null;

    return (
        <>
            <button
                type="button"
                className="todo-image-trigger"
                onClick={(e) => {
                    e.stopPropagation();
                    if (!imageUrl) return;
                    setZoom(1);
                    setViewerOpen(true);
                }}
                disabled={loading || !imageUrl}
                title={fileName}
            >
                {imageUrl ? <img src={imageUrl} alt={fileName} className="todo-image-thumb" /> : <span>加载中...</span>}
            </button>
            {viewerOpen && (
                <div className="todo-image-viewer" onClick={() => setViewerOpen(false)}>
                    <div className="todo-image-viewer-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="todo-image-toolbar">
                            <strong>{fileName}</strong>
                            <div className="todo-image-actions">
                                <button type="button" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))}><Minus size={14} /></button>
                                <span>{zoomLabel}</span>
                                <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}><Plus size={14} /></button>
                                <button type="button" onClick={() => setZoom(1)}>重置</button>
                                <button type="button" onClick={() => setViewerOpen(false)}><X size={14} /></button>
                            </div>
                        </div>
                        <div className="todo-image-stage">
                            <img src={imageUrl} alt={fileName} style={{ transform: `scale(${zoom})` }} className="todo-image-full" />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
