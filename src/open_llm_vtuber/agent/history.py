"""Bounded working history; persisted chat archives are not modified."""


def bounded_history(messages, max_messages=24, max_chars=16000):
    """Keep recent complete dialogue turns; archive remains untouched."""
    turns = []
    for message in messages:
        if message.get("role") == "user" or not turns:
            turns.append([])
        turns[-1].append(message)
    kept, count, size = [], 0, 0
    for turn in reversed(turns):
        cost = sum(len(str(m.get("content", ""))) for m in turn)
        if count + len(turn) > max_messages or size + cost > max_chars:
            break
        kept.insert(0, turn)
        count += len(turn)
        size += cost
    return [message for turn in kept for message in turn]
