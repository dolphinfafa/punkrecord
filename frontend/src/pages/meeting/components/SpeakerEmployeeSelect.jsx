import { useId, useRef, useState } from 'react';

export default function SpeakerEmployeeSelect({ speakerId, name, employeeId, employees, disabled, onChange, onSave }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const dirty = useRef(false);
    const listId = useId();
    const matches = employees.filter(employee => `${employee.display_name} ${employee.username || ''}`.toLowerCase().includes(query.toLowerCase()));
    const options = [...matches.map(employee => ({ name: employee.display_name, id: employee.id,
        label: `${employee.display_name}${employee.username ? `（${employee.username}）` : ''}` })),
        ...(query.trim() ? [{ name: query.trim(), id: null, label: `外部人员：${query.trim()}` }] : [])];
    const selected = employees.find(employee => employee.id === employeeId);
    const choose = option => {
        dirty.current = false;
        onChange(option.name, option.id);
        onSave(option.name, option.id);
        setOpen(false);
    };
    return <div className="speaker-employee-select">
        <input className="speaker-name-input" aria-label={`${speakerId} 姓名`} role="combobox"
            aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
            disabled={disabled} value={name} placeholder="选择员工或填写外部姓名"
            title={selected ? `${selected.display_name}（${selected.username || ''}）` : name}
            onFocus={() => { setQuery(''); setActive(0); setOpen(true); }}
            onChange={event => { dirty.current = true; setQuery(event.target.value); setActive(0); setOpen(true); onChange(event.target.value, null); }}
            onBlur={() => { setOpen(false); if (dirty.current) { dirty.current = false; onSave(name.trim(), null); } }}
            onKeyDown={event => {
                if (event.key === 'Escape') { setOpen(false); return; }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault(); setOpen(true);
                    setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
                }
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (open && options[active]) choose(options[active]);
                    else { dirty.current = false; onSave(name.trim(), employeeId ?? null); setOpen(false); }
                }
            }} />
        {selected?.username && <span className="speaker-employee-username">{selected.username}</span>}
        {open && <ul id={listId} role="listbox" className="speaker-employee-options" aria-label="公司员工">
            {options.map((option, index) => <li key={option.id || 'external'} id={`${listId}-${index}`} role="option" aria-selected={active === index}>
                <button type="button" tabIndex={-1} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>{option.label}</button>
            </li>)}
            {!options.length && <li className="speaker-employee-empty">暂无可选员工</li>}
        </ul>}
    </div>;
}
