import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mcpApi from '@/api/mcp';
import './McpToolDetailPage.css';

export default function McpToolDetailPage() {
    const { toolName } = useParams();
    const [tool, setTool] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        mcpApi.getInfo()
            .then(res => {
                if (!alive) return;
                const tools = res.data?.tools || [];
                setTool(tools.find(t => t.name === toolName) || null);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [toolName]);

    // docstring 用 4 空格缩进表示列表/示例，markdown 会当作代码块；
    // 去掉每行公共前导空白，让 markdown 正常渲染列表。
    const doc = (tool?.doc || '').replace(/^[ \t]+/gm, m => (m.length >= 4 ? '' : m));

    return (
        <div className="mcp-tool-detail">
            <Link to="/mcp" className="mcp-back">
                <ArrowLeft size={16} /> 返回 MCP 集成
            </Link>

            {loading ? (
                <div className="mcp-detail-empty">加载中…</div>
            ) : !tool ? (
                <div className="mcp-detail-empty">
                    未找到工具 <code>{toolName}</code>，它可能已下线或名称有误。
                </div>
            ) : (
                <article className="mcp-detail-card">
                    <header className="mcp-detail-head">
                        <Terminal size={20} />
                        <h1><code>{tool.name}</code></h1>
                    </header>
                    {tool.description && <p className="mcp-detail-summary">{tool.description}</p>}
                    <div className="mcp-detail-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc}</ReactMarkdown>
                    </div>
                </article>
            )}
        </div>
    );
}
