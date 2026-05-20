#!/usr/bin/env bash
# Sharp Arena C# runner — Phase 0 STUB.
#
# Phase 1 will:
#   1. Read submitted code paths from env / stdin (UserCode, Harness, Tests).
#   2. Assemble a small test project on disk.
#   3. Run `dotnet test` with a timeout.
#   4. Emit a JSON verdict on stdout for ITestFormat to parse.
#
# Until then this exits non-zero so the placeholder Dockerfile can be
# detected by smoke checks.
set -euo pipefail
echo "sharp-arena/runner-csharp: Phase 0 stub — not implemented" >&2
exit 99
