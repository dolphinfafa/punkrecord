import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { kbApi } from '@/api/kb';
import {
    Search, Upload, Trash2, FileText, FileSpreadsheet, Image,
    File, ChevronLeft, ChevronRight, Filter, X
} from 'lucide-react';
import { format } from 'date-fns';
import UploadDocumentModal from './components/UploadDocumentModal';
import './DocumentListPage.css';

const FILE_TYPE_ICONS = {
    pdf: FileText,
    doc: FileText,
    docx: FileText,
    xls: FileSpreadsheet,
    xlsx: FileSpreadsheet,
    csv: FileSpreadsheet,
    txt: FileText,
    png: Image,
    jpg: Image,
    jpeg: Image,
    gif: Image,
    webp: Image,
};

const STATUS_CONFIG = {
    processing: { label: '处理中', className: 'kb-status-processing' },
    ready: { label: '已就绪', className: 'kb-status-ready' },
    failed: { label: '处理失败', className: 'kb-status-failed' },
};

function formatFileSize(bytes) {
    if (!bytes || !Number.isFinite(bytes)) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export default function DocumentListPage() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [tags, setTags] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const pageSize = 20;

    const loadDocuments = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, page_size: pageSize };
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (statusFilter) params.status = statusFilter;
            if (tagFilter) params.tag = tagFilter;
            const res = await kbApi.getDocuments(params);
            const data = res.data || res;
            setDocuments(data.items || []);
            setTotal(data.total || 0);
            setTotalPages(Math.ceil((data.total || 0) / pageSize) || 1);
            setError(null);
        } catch (err) {
            setError(err.message || '加载文档列表失败');
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery, statusFilter, tagFilter]);

    const loadTags = useCallback(async () => {
        try {
            const res = await kbApi.getTags();
            setTags((res.data || res) || []);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    useEffect(() => {
        loadTags();
    }, [loadTags]);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('确定要删除这个文档吗？删除后不可恢复。')) return;
        try {
            await kbApi.deleteDocument(id);
            loadDocuments();
        } catch (err) {
            alert(err.message || '删除失败');
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        loadDocuments();
    };

    const handleRowClick = (id) => {
        navigate(`/kb/documents/${id}`);
    };

    const handleUploadSuccess = () => {
        setUploadModalOpen(false);
        setPage(1);
        loadDocuments();
    };

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('');
        setTagFilter('');
        setPage(1);
    };

    const hasActiveFilters = searchQuery || statusFilter || tagFilter;

    return (
        <div className="kb-doc-container">
            <div className="kb-doc-header">
                <h1>知识库文档</h1>
                <button className="kb-btn kb-btn-primary" onClick={() => setUploadModalOpen(true)}>
                    <Upload size={18} />
                    上传文档
                </button>
            </div>

            <div className="kb-doc-toolbar">
                <form className="kb-search-form" onSubmit={handleSearch}>
                    <div className="kb-search-input-wrapper">
                        <Search size={16} className="kb-search-icon" />
                        <input
                            type="text"
                            className="kb-search-input"
                            placeholder="搜索文档标题..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </form>
                <div className="kb-filter-group">
                    <div className="kb-select-wrapper">
                        <Filter size={14} className="kb-select-icon" />
                        <select
                            className="kb-select"
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">全部状态</option>
                            <option value="processing">处理中</option>
                            <option value="ready">已就绪</option>
                            <option value="failed">处理失败</option>
                        </select>
                    </div>
                    <div className="kb-select-wrapper">
                        <Filter size={14} className="kb-select-icon" />
                        <select
                            className="kb-select"
                            value={tagFilter}
                            onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">全部标签</option>
                            {tags.map((tag) => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    </div>
                    {hasActiveFilters && (
                        <button className="kb-btn kb-btn-ghost" onClick={clearFilters}>
                            <X size={14} />
                            清除筛选
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="kb-error-banner">{error}</div>
            )}

            {loading ? (
                <div className="kb-loading">加载中...</div>
            ) : documents.length === 0 ? (
                <div className="kb-empty-state">
                    <FileText size={48} strokeWidth={1} />
                    <p>暂无文档</p>
                    <span>点击"上传文档"按钮开始添加</span>
                </div>
            ) : (
                <>
                    <div className="kb-table-container">
                        <table className="kb-table">
                            <thead>
                                <tr>
                                    <th>文档标题</th>
                                    <th>类型</th>
                                    <th>大小</th>
                                    <th>标签</th>
                                    <th>状态</th>
                                    <th>上传时间</th>
                                    <th>上传人</th>
                                    <th style={{ width: 60 }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((doc) => {
                                    const ext = getFileExtension(doc.file_name || doc.title);
                                    const IconComponent = FILE_TYPE_ICONS[ext] || File;
                                    const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.processing;
                                    return (
                                        <tr key={doc.id} onClick={() => handleRowClick(doc.id)} className="kb-table-row-clickable">
                                            <td>
                                                <div className="kb-doc-title-cell">
                                                    <IconComponent size={18} className="kb-doc-type-icon" />
                                                    <span className="kb-doc-title-text">{doc.title || doc.file_name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="kb-file-ext">{ext.toUpperCase() || '-'}</span>
                                            </td>
                                            <td>{formatFileSize(doc.file_size)}</td>
                                            <td>
                                                <div className="kb-tags-cell">
                                                    {(doc.tags || []).map((tag) => (
                                                        <span key={tag} className="kb-tag-badge">{tag}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`kb-status-badge ${statusCfg.className}`}>
                                                    {statusCfg.label}
                                                </span>
                                            </td>
                                            <td>
                                                {doc.created_at
                                                    ? format(new Date(doc.created_at), 'yyyy-MM-dd HH:mm')
                                                    : '-'}
                                            </td>
                                            <td>{doc.uploader_name || doc.uploader || '-'}</td>
                                            <td>
                                                <button
                                                    className="kb-icon-btn kb-icon-btn-danger"
                                                    onClick={(e) => handleDelete(e, doc.id)}
                                                    title="删除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="kb-pagination">
                        <span className="kb-pagination-info">共 {total} 条记录</span>
                        <div className="kb-pagination-controls">
                            <button
                                className="kb-btn kb-btn-sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                <ChevronLeft size={16} />
                                上一页
                            </button>
                            <span className="kb-pagination-current">
                                {page} / {totalPages}
                            </span>
                            <button
                                className="kb-btn kb-btn-sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                下一页
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {uploadModalOpen && (
                <UploadDocumentModal
                    onClose={() => setUploadModalOpen(false)}
                    onSuccess={handleUploadSuccess}
                />
            )}
        </div>
    );
}
