"""Live airport weather (METAR) from the public aviationweather.gov API.

Optional: needs internet. Results are cached for 10 minutes; on any failure the
browser shows its demo weather instead.
"""
import re
import time
import urllib.request

ICAO = {'SNN': 'EISN', 'DUB': 'EIDW', 'LHR': 'EGLL', 'LGW': 'EGKK', 'MAN': 'EGCC', 'EDI': 'EGPH', 'FRA': 'EDDF',
        'BER': 'EDDB', 'MUC': 'EDDM', 'HAM': 'EDDH', 'DUS': 'EDDL', 'MAD': 'LEMD', 'LIS': 'LPPT', 'CDG': 'LFPG',
        'AMS': 'EHAM', 'BRU': 'EBBR', 'CPH': 'EKCH', 'OSL': 'ENGM', 'ARN': 'ESSA', 'HEL': 'EFHK', 'WAW': 'EPWA',
        'PRG': 'LKPR', 'VIE': 'LOWW', 'ZRH': 'LSZH', 'FCO': 'LIRF', 'IST': 'LTFM', 'KEF': 'BIKF', 'YQX': 'CYQX',
        'BOS': 'KBOS', 'JFK': 'KJFK', 'DXB': 'OMDB'}
URL = 'https://aviationweather.gov/api/data/metar?format=raw&ids={}'
_cache = {}


def metar(iata, timeout=4.0):
    iata = (iata or '').upper()
    icao = ICAO.get(iata)
    if not icao:
        return {'available': False, 'error': 'Unknown airport'}
    hit = _cache.get(icao)
    if hit and time.monotonic() - hit[0] < (600 if hit[1]['available'] else 60):
        return hit[1]
    try:
        req = urllib.request.Request(URL.format(icao), headers={'User-Agent': 'IFSD-Response-Hub-prototype'})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode('utf-8', 'replace').strip().splitlines()
        raw = raw[0].strip() if raw else ''
        if not re.match(r'^(METAR |SPECI )?[A-Z]{4} \d{6}Z', raw):
            raise ValueError('no METAR')
        result = {'available': True, 'icao': icao, 'metar': raw}
    except Exception as error:  # offline, timeout, unexpected format
        result = {'available': False, 'icao': icao, 'error': str(error)[:120]}
    _cache[icao] = (time.monotonic(), result)
    return result
