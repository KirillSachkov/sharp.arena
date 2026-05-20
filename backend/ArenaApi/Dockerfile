# syntax=docker/dockerfile:1.7
ARG DOTNET_SDK_VERSION=10.0.203
ARG DOTNET_RUNTIME_VERSION=10.0

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_VERSION} AS build
WORKDIR /src

ENV DOTNET_NOLOGO=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_GENERATE_ASPNET_CERTIFICATE=false \
    NUGET_XMLDOC_MODE=skip

# ── csprojs first for restore-cache layer ─────────────────────────────────
COPY ["Directory.Build.props", "."]
COPY ["Directory.Packages.props", "."]
COPY ["BannedSymbols.txt", "."]
COPY [".globalconfig", "."]

COPY ["ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj", "ArenaApi/src/ArenaApi.Contracts/"]
COPY ["ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj", "ArenaApi/src/ArenaApi.Core/"]
COPY ["ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj", "ArenaApi/src/ArenaApi.Infrastructure/"]
COPY ["ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj", "ArenaApi/src/ArenaApi.Web/"]

RUN --mount=type=cache,id=nuget-global,target=/root/.nuget/packages,sharing=locked \
    dotnet restore "ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj"

# ── full source ───────────────────────────────────────────────────────────
COPY ["ArenaApi/", "ArenaApi/"]

RUN --mount=type=cache,id=nuget-global,target=/root/.nuget/packages,sharing=locked \
    dotnet publish "ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj" \
    -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ── runtime ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_RUNTIME_VERSION} AS final
WORKDIR /app

# curl is used by the HEALTHCHECK below; ~3MB.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ARG BUILD_REVISION=unknown
ARG BUILD_VERSION=dev
LABEL org.opencontainers.image.revision="${BUILD_REVISION}" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.title="ArenaApi"

COPY --link --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=5000

USER app

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "ArenaApi.Web.dll"]
