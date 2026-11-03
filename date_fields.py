"""Canonical dates for editable case fields (not audit timestamps or case IDs)."""
import re
from datetime import date


def normalize_date(value):
    if not value.strip():
        return ''
    value = value.strip()
    match = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})(.*)', value)
    if match:
        year, month, day = map(int, match.group(1, 2, 3))
    else:
        match = re.fullmatch(r'(\d{1,2})\s*[.,/]\s*(\d{1,2})\s*[.,/]\s*(\d{4}|\d{2})(.*)', value)
        if not match:
            raise ValueError('Use DD.MM.YYYY, optionally followed by HH:MM and a timezone.')
        day, month, year = map(int, match.group(1, 2, 3))
        if len(match.group(3)) == 2:
            year += 2000
    date(year, month, day)  # Reject impossible dates instead of rolling them forward.
    suffix = match.group(4).strip()
    if suffix.startswith('T'):
        suffix = suffix[1:]
    if suffix.lower().startswith('at '):
        suffix = suffix[3:]
    if suffix and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*(?:Z|[A-Z]{2,5}|[+-](?:[01]\d|2[0-3]):?[0-5]\d))?', suffix):
        raise ValueError('Use DD.MM.YYYY, optionally followed by HH:MM and a timezone.')
    return f'{day:02d}.{month:02d}.{year:04d}' + (' ' + suffix if suffix else '')
