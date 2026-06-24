import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plug, Key, Plus, Copy, Check, Terminal, Boxes, Zap, ChevronRight } from 'lucide-react';
import agentTokenApi from '@/api/agentToken';
import mcpApi from '@/api/mcp';
import './McpPage.css';

function copyText(text) {
    try {
        navigator.clipboard.writeText(text);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }
}

function CopyBtn({ text, small }) {
    const [done, setDone] = useState(false);
    return (
        <button
            className={small ? 'mcp-copy-sm' : 'mcp-copy'}
            onClick={() => { copyText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
        >
            {done ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制</>}
        </button>
    );
}

const PLACEHOLDER = 'YOUR_API_KEY';

export default function McpPage() {
    const [info, setInfo] = useState({ url: '', tools: [] });
    const [tokens, setTokens] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', expires_in_days: '' });
    const [newToken, setNewToken] = useState(null);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [transport, setTransport] = useState('http'); // 'http' | 'stdio'

    const loadTokens = async () => {
        try { const res = await agentTokenApi.list(); setTokens(res.data || []); } catch { /* ignore */ }
    };

    useEffect(() => {
        mcpApi.getInfo().then(res => setInfo(res.data || { url: '', tools: [] })).catch(() => {});
        loadTokens();
    }, []);

    const url = info.url || '';

    const httpSnippet = `{
  "mcpServers": {
    "punkrecord": {
      "url": "${url}",
      "headers": {
        "Authorization": "Bearer ${PLACEHOLDER}"
      }
    }
  }
}`;

    const stdioSnippet = `{
  "mcpServers": {
    "punkrecord": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${url}",
        "--header",
        "Authorization: Bearer ${PLACEHOLDER}"
      ]
    }
  }
}`;

    const claudeCodeCmd = `claude mcp add --transport http punkrecord "${url}" --header "Authorization: Bearer ${PLACEHOLDER}"`;

    return (
        <div className="mcp-page">
            {/* Intro */}
            <div className="mcp-hero">
                <div className="mcp-hero-icon"><Plug size={28} /></div>
                <div>
                    <h1>MCP 集成</h1>
                    <p>
                        通过 <b>Model Context Protocol（MCP）</b> 把 PunkRecord 接入 Claude Desktop / Claude Code /
                        Cursor / Cherry Studio 等 AI 客户端。配置好 API 密钥后，AI 即可代你查看与创建待办、管理项目、
                        提交请假、检索知识库等。
                    </p>
                    <div className="mcp-stats">
                        <span><b>{info.tools.length}</b> 个工具</span>
                        <span><b>Streamable HTTP / Stdio</b> 双传输</span>
                        <span><b>3 步</b> 接入</span>
                    </div>
                </div>
            </div>

            {/* API Key */}
            <section className="mcp-card">
                <div className="mcp-card-head">
                    <h2><Key size={18} /> API 密钥</h2>
                    <button className="mcp-btn" onClick={() => { setShowCreate(true); setNewToken(null); setForm({ name: '', expires_in_days: '' }); }}>
                        <Plus size={14} /> 生成密钥
                    </button>
                </div>
                <p className="mcp-muted">MCP 使用 PunkRecord 密钥（pat_）认证，密钥代表你的身份与权限。</p>

                {showCreate && (
                    <div className="mcp-create">
                        {newToken ? (
                            <div>
                                <div className="mcp-muted" style={{ marginBottom: 8 }}>密钥已生成，请立即复制保存（关闭后无法再查看）：</div>
                                <div className="mcp-token-row">
                                    <code className="mcp-token">{newToken}</code>
                                    <button className="mcp-btn" onClick={() => { copyText(newToken); setTokenCopied(true); setTimeout(() => setTokenCopied(false), 2000); }}>
                                        {tokenCopied ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制</>}
                                    </button>
                                </div>
                                <button className="mcp-btn mcp-btn-grey" style={{ marginTop: 8 }} onClick={() => { setShowCreate(false); setNewToken(null); }}>关闭</button>
                            </div>
                        ) : (
                            <div className="mcp-create-form">
                                <label>
                                    <span>名称</span>
                                    <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如：我的 Claude" />
                                </label>
                                <label>
                                    <span>有效期</span>
                                    <select value={form.expires_in_days} onChange={e => setForm(p => ({ ...p, expires_in_days: e.target.value }))}>
                                        <option value="">永久</option>
                                        <option value="30">30 天</option>
                                        <option value="90">90 天</option>
                                        <option value="180">180 天</option>
                                    </select>
                                </label>
                                <button className="mcp-btn" onClick={async () => {
                                    try {
                                        const res = await agentTokenApi.create({ name: form.name || 'MCP Key', expires_in_days: form.expires_in_days ? parseInt(form.expires_in_days) : null });
                                        setNewToken(res.data.token);
                                        loadTokens();
                                    } catch (err) { alert(err?.response?.data?.message || '创建失败'); }
                                }}>生成</button>
                                <button className="mcp-btn mcp-btn-ghost" onClick={() => setShowCreate(false)}>取消</button>
                            </div>
                        )}
                    </div>
                )}

                {tokens.length === 0 && !showCreate ? (
                    <div className="mcp-empty">暂无密钥，生成后填入下方客户端配置即可使用。</div>
                ) : (
                    <div className="mcp-token-list">
                        {tokens.map(t => (
                            <div key={t.id} className="mcp-token-item">
                                <div>
                                    <div className="mcp-token-name">{t.name} <code>{t.token_preview}</code></div>
                                    <div className="mcp-token-meta">
                                        创建: {t.created_at?.slice(0, 10)}
                                        {t.expires_at && ` · 到期: ${t.expires_at.slice(0, 10)}`}
                                        {t.last_used_at && ` · 最后使用: ${t.last_used_at.slice(0, 16).replace('T', ' ')}`}
                                    </div>
                                </div>
                                <button className="mcp-del" onClick={async () => {
                                    if (!window.confirm('确认删除此密钥？使用该密钥的客户端将无法继续访问。')) return;
                                    try { await agentTokenApi.remove(t.id); loadTokens(); }
                                    catch (err) { alert(err?.response?.data?.message || '删除失败'); }
                                }}>删除</button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Endpoint */}
            <section className="mcp-card">
                <h2><Zap size={18} /> 服务端点</h2>
                <div className="mcp-endpoint">
                    <code>{url || '加载中…'}</code>
                    {url && <CopyBtn text={url} small />}
                </div>
                <p className="mcp-muted">所有请求携带请求头 <code>Authorization: Bearer 你的密钥</code>。</p>
            </section>

            {/* Client config */}
            <section className="mcp-card">
                <h2><Boxes size={18} /> 客户端配置</h2>
                <div className="mcp-tabs">
                    <button className={transport === 'http' ? 'active' : ''} onClick={() => setTransport('http')}>Streamable HTTP（Cursor / Cherry Studio）</button>
                    <button className={transport === 'stdio' ? 'active' : ''} onClick={() => setTransport('stdio')}>Stdio（Claude Desktop / Code）</button>
                </div>

                {transport === 'http' ? (
                    <>
                        <p className="mcp-muted">支持直连远程 MCP 的客户端（Cursor 的 <code>.cursor/mcp.json</code>、Cherry Studio、Cline 等）：</p>
                        <div className="mcp-codeblock">
                            <CopyBtn text={httpSnippet} small />
                            <pre>{httpSnippet}</pre>
                        </div>
                        <p className="mcp-muted">Claude Code（命令行）：</p>
                        <div className="mcp-codeblock">
                            <CopyBtn text={claudeCodeCmd} small />
                            <pre>{claudeCodeCmd}</pre>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="mcp-muted">
                            Claude Desktop / VS Code 等仅支持 stdio 的客户端，用 <code>npx mcp-remote</code> 桥接（需 Node.js）。
                            写入 <code>claude_desktop_config.json</code>：
                        </p>
                        <div className="mcp-codeblock">
                            <CopyBtn text={stdioSnippet} small />
                            <pre>{stdioSnippet}</pre>
                        </div>
                    </>
                )}
                <p className="mcp-tip">将配置中的 <code>{PLACEHOLDER}</code> 替换为上方生成的密钥。</p>
            </section>

            {/* Tools */}
            <section className="mcp-card">
                <h2><Terminal size={18} /> 可用工具（{info.tools.length}）</h2>
                <p className="mcp-muted">点击任意工具查看完整参数说明与用法文档。</p>
                <div className="mcp-tools">
                    {info.tools.map(t => (
                        <Link key={t.name} to={`/mcp/tools/${t.name}`} className="mcp-tool">
                            <div className="mcp-tool-main">
                                <code>{t.name}</code>
                                <span>{t.description}</span>
                            </div>
                            <ChevronRight size={16} className="mcp-tool-arrow" />
                        </Link>
                    ))}
                </div>
            </section>

            {/* Quick start */}
            <section className="mcp-card">
                <h2>快速开始</h2>
                <ol className="mcp-steps">
                    <li>在上方「API 密钥」生成一个密钥并复制。</li>
                    <li>选择你的客户端，复制对应配置，把 <code>{PLACEHOLDER}</code> 换成密钥。</li>
                    <li>重启 AI 客户端，即可让它调用 PunkRecord 工具。</li>
                </ol>
            </section>
        </div>
    );
}
