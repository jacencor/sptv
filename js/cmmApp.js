/*
 ***
 *** DATOS PRINCIPALES
 *** @jacencor
 ***
 ***
 * ***************** 
 * ***************** 
 *      TIPOS:
 * ***************** 
 *   OPEN: Funciona sin rectricciones HLS o DASH
 *   OPEN-DRM: Funciona sin rectricciones con ClearKey
 *   LINK: Enlace a pagina externa donde funciona con su propio player
 *   IFRAME: Funciona con su propio player dentro de un IFRAME
 *
 */
const tv = [{
        "source": "aHR0cHM6Ly9saXZlLWV2ZzEudHYzNjAuYml0ZWwuY29tLnBlL2JpdGVsL2FtZXJpY2F0di9wbGF5bGlzdC5tM3U4",
        "key": null,
        "poster": "aHR0cHM6Ly93d3cudHZ5dmlkZW8uY29tL2ltYWdlcy9zdG9yaWVzL1RWVi8yMDIxL0FtZXJpY2FfVGVsZXZpc2lvbl9tZWpvcmFfc3VfcHJvZHVjY2lvbl9jb25fUm9zc19WaWRlby5qcGc=",
        "tipo": "T1BFTg==",
        "name": "QW1lcmljYSBUVg"
    },
    {
        "source": "aHR0cHM6Ly9hbGJhLWVjLXJ0cy1ydHMuc3RyZWFtLm1lZGlhdGlxdWVzdHJlYW0uY29tL2luZGV4Lm0zdTg=",
        "key": null,
        "poster": "aHR0cHM6Ly91cGxvYWQud2lraW1lZGlhLm9yZy93aWtpcGVkaWEvY29tbW9ucy8xLzEzL1J0c19sb2dvLnBuZw==",
        "tipo": "T1BFTg==",
        "name": "UlRT"
    },
    {
        "source": "aHR0cHM6Ly9qaXJlaC0xLWhscy12aWRlby1hci1pc3AuZHBzLmxpdmUvaGxzLXZpZGVvL2M1NGFjMjc5OTg3NDM3NWM4MWMxNjcyYWJiNzAwODcwNTM3YzUyMjMvZWN1YXZpc2EvZWN1YXZpc2Euc21pbC9wbGF5bGlzdC5tM3U4",
        "key": null,
        "poster": "aHR0cHM6Ly91cGxvYWQud2lraW1lZGlhLm9yZy93aWtpcGVkaWEvY29tbW9ucy90aHVtYi9mL2YyL0VjdWF2aXNhX0xvZ29fMjAxOS5wbmcvNjQwcHgtRWN1YXZpc2FfTG9nb18yMDE5LnBuZw==",
        "tipo": "T1BFTg==",
        "name": "RWN1YXZpc2E="
    },
    {
        "source": "aHR0cHM6Ly90ZWxlYW1hem9uYXMtbGl2ZS5jZG4udnVzdHJlYW1zLmNvbS9saXZlLzQzOTUzY2FhLTUzZmYtNDUyNS05ZjllLTIwMmExMmJmMjY0ZS9saXZlLmlzbWwvNDM5NTNjYWEtNTNmZi00NTI1LTlmOWUtMjAyYTEyYmYyNjRlLm0zdTggICAgICAgIA==",
        "key": null,
        "poster": "aHR0cHM6Ly91cGxvYWQud2lraW1lZGlhLm9yZy93aWtpcGVkaWEvY29tbW9ucy90aHVtYi9lL2UwL1RlbGVhbWF6b25hc19Mb2dvLnBuZy82NDBweC1UZWxlYW1hem9uYXNfTG9nby5wbmc=",
        "tipo": "T1BFTg==",
        "name": "VGVsZWFtYXpvbmFz"
    },
    {
        "source": "aHR0cHM6Ly9zdHJlYW0tcHVsbC1iLnlvbG9saXYuY29tL3lvbG9saXYvMTE0NDI3ODM2ODU0NDM1ODQwMV95bzcyMHAzMGYubTN1OA==",
        "key": null,
        "poster": "aHR0cHM6Ly91cGxvYWQud2lraW1lZGlhLm9yZy93aWtpcGVkaWEvY29tbW9ucy85Lzk0L0dhbWF2aXNp824yMDE4bmV3LnBuZw==",
        "tipo": "T1BFTg==",
        "name": "R2FtYXZpc2nzbg=="
    },
    {
        "source": "aHR0cHM6Ly92aWRlbzEubWFrcm9kaWdpdGFsLmNvbS9ydHUvcnR1L3BsYXlsaXN0Lm0zdTg=",
        "key": null,
        "poster": "aHR0cHM6Ly9jYW5hbHJ0dS50di93cC1jb250ZW50L3VwbG9hZHMvMjAyMi8wNy9ydHUucG5n",
        "tipo": "T1BFTg==",
        "name": "UlRV"
    },
    {
        "source": "aHR0cHM6Ly9hbGJhLWVjLXR2Yy10dmMuc3RyZWFtLm1lZGlhdGlxdWVzdHJlYW0uY29tL2luZGV4Lm0zdTg=",
        "key": null,
        "poster": "aHR0cHM6Ly93d3cudHZjLmNvbS5lYy93cC1jb250ZW50L3VwbG9hZHMvMjAyMy8wNy9sb2dvLnBuZw==",
        "tipo": "T1BFTg==",
        "name": "VFZD"
    },
    {
        "source": "aHR0cHM6Ly9zYW1zb24uc3RyZWFtZXJyLmNvOjgwODEvc2hvZ3VuL2luZGV4Lm0zdTg=",
        "key": null,
        "poster": "aHR0cHM6Ly91cGxvYWQud2lraW1lZGlhLm9yZy93aWtpcGVkaWEvY29tbW9ucy90aHVtYi84LzgzL0VjdWFkb3JUVl9sb2dvLnBuZy80NjVweC1FY3VhZG9yVFZfbG9nby5wbmc=",
        "tipo": "T1BFTg==",
        "name": "RUMgVFY="
    },
    {
        "source": "aHR0cHM6Ly9kd2FtZHN0cmVhbTEwNC5ha2FtYWl6ZWQubmV0L2hscy9saXZlLzIwMTU1MzAvZHdzdHJlYW0xMDQvaW5kZXgubTN1OA==",
        "key": null,
        "poster": "aHR0cHM6Ly91cGxvYWQud2lraW1lZGlhLm9yZy93aWtpcGVkaWEvY29tbW9ucy90aHVtYi83Lzc1L0RldXRzY2hlX1dlbGxlX3N5bWJvbF8yMDEyLnN2Zy82NDBweC1EZXV0c2NoZV9XZWxsZV9zeW1ib2xfMjAxMi5zdmcucG5n",
        "tipo": "T1BFTg==",
        "name": "RFcgRXNwYfFvbA=="
    }
];