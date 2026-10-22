"""Resolve attendance identities separately from transcript display names."""
from collections import defaultdict

from sqlmodel import select

from app.models.meeting import MeetingTranscriptSegment


def resolve_participants(session, meetings, users, historical_names=None):
    by_id = {str(user.id): user.id for user in users}
    usernames, names = defaultdict(set), defaultdict(set)
    for user in users:
        if user.username:
            usernames[user.username.strip()].add(user.id)
        name = (historical_names or {}).get(user.id, user.display_name).strip()
        names[name].add(user.id)
    present, ambiguous = set(), set()
    for meeting in meetings:
        segments = session.exec(select(MeetingTranscriptSegment).where(
            MeetingTranscriptSegment.meeting_id == meeting.id)).all()
        used = {segment.speaker_id for segment in segments}
        bindings = meeting.speaker_user_mapping or {}
        labels = []
        if used:
            for sid in used:
                if sid in bindings:
                    # Explicit null means an external attendee, never a name fallback.
                    employee_id = by_id.get(str(bindings[sid]))
                    if employee_id:
                        present.add(employee_id)
                else:
                    labels.append((meeting.speaker_mapping or {}).get(sid, sid))
        else:
            labels = meeting.attendees or []
        for label in labels:
            label = str(label).strip()
            if not label:
                continue
            candidates = usernames.get(label) or names.get(label, set())
            if len(candidates) == 1:
                present.update(candidates)
            elif len(candidates) > 1:
                ambiguous.add(label)
    return present, sorted(ambiguous)
