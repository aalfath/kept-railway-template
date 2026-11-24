# Changelog

## 1.14.7 (2026-11-24)

First release of this Railway template.

- Kept 1.14.7, official image pinned by digest (`sha256:e346925d…`).
- PostgreSQL 18 with pgvector 0.8.7 (`pgvector/pgvector:0.8.7-pg18-bookworm`, pinned by digest) on a volume.
- Files in a Railway Bucket (`KEPT_STORAGE=s3`), so the stack needs one volume only.
- Start script runs `kept bootstrap` and `kept migrate` before the server; every failure exits non-zero.
