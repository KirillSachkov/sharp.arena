# syntax=docker/dockerfile:1.7
#
# Sharp Arena C# runner — Phase 0 STUB.
#
# This image is intentionally non-functional. Phase 1 fills it in.
# See docs/ROADMAP.md (Phase 1 — Arena MVP).
#
# Planned shape:
#   - FROM mcr.microsoft.com/dotnet/sdk:10.0 (compile + run inside the container)
#   - Or a slim ASP.NET runtime + pre-built test harness
#   - entrypoint.sh writes UserCode + HarnessCode + TestsCode to disk,
#     runs `dotnet test`, prints JSON-shaped verdict to stdout
#   - Container is launched per-submission with:
#       docker run --rm --cpus=1 --memory=256m --network=none \
#                  --pids-limit=64 sharp-arena/runner-csharp
#   - stdout is parsed by ITestFormat into a RunVerdict.
#
# Do not extend this stub with partial work. Replace it wholesale in Phase 1.

FROM scratch
CMD ["false"]
