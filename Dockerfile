# Kept 1.14.7, the official image, pinned by version and multi-arch index digest
# (ghcr.io/keptinventory/kept, read 2026-11-24).
FROM ghcr.io/keptinventory/kept:1.14.7@sha256:e346925dc007d16e2eaab91a20e1c5313734957acb54eeec456d40d5cf813ab3

# Railway shows a 1 vCPU service the host's 32 CPUs: keep libvips (sharp), libuv and glibc
# arenas small so photo resizing stays inside a 0.5 GB Free-plan service.
ENV VIPS_CONCURRENCY=1 \
    UV_THREADPOOL_SIZE=4 \
    MALLOC_ARENA_MAX=2 \
    KEPT_LOG_LEVEL=info

COPY --chmod=0755 railway-start.sh /usr/local/bin/railway-start

ENTRYPOINT ["/usr/local/bin/railway-start"]
