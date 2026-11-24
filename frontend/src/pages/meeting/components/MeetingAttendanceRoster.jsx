import { Save } from 'lucide-react';

export default function MeetingAttendanceRoster({
    roster, people, dirty, busy, error, onChange, onMarkAllPresent, onSave, onReload,
}) {
    const pending = people.filter(person => person.status === 'pending').length;
    const present = people.filter(person => person.status === 'present').length;
    const absence = people.length - pending - present;
    let status = roster.settled_version === roster.version ? '已结算' : '已保存，未结算';
    if (dirty) status = '有未保存修改';
    else if (!roster.version) status = '未确认';
    else if (roster.needs_confirmation) status = '应到名单已变更';

    return (
        <section className="detail-section attendance-roster" aria-labelledby="daily-attendance-heading">
            <div className="section-header">
                <h2 className="section-title" id="daily-attendance-heading">当日早会考勤</h2>
                <span className="attendance-roster-status" role="status">{status}</span>
            </div>
            <div className="attendance-roster-toolbar">
                <span>出勤 {present} · 缺席 {absence} · 待确认 {pending}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onMarkAllPresent}
                    disabled={busy || present === people.length}>全部标为出勤</button>
            </div>
            {people.length ? (
                <ul className="attendance-roster-list">
                    {people.map(person => (
                        <li key={person.user_id}>
                            <label htmlFor={`attendance-${person.user_id}`}>
                                {person.name}
                                {person.suggested_present && <span className="attendance-roster-evidence">有转录记录</span>}
                            </label>
                            <select id={`attendance-${person.user_id}`} value={person.status}
                                onChange={event => onChange(person.user_id, event.target.value)} disabled={busy}>
                                <option value="pending">待确认</option>
                                <option value="present">出勤</option>
                                <option value="absent">缺席</option>
                            </select>
                        </li>
                    ))}
                </ul>
            ) : <p className="attendance-roster-empty">当日无应到员工</p>}
            {error && (
                <div className="attendance-roster-error" role="alert">
                    {error}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={onReload} disabled={busy}>重新加载</button>
                </div>
            )}
            <div className="attendance-roster-actions">
                <button className="btn btn-primary btn-sm" type="button" onClick={onSave}
                    disabled={busy || pending > 0 || (!dirty && roster.version > 0 && !roster.needs_confirmation)}>
                    <Save size={16} /> 确认并保存名单
                </button>
            </div>
        </section>
    );
}
