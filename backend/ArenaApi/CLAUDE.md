# ArenaApi — service memory

Single .NET 10 service powering Sharp Arena. Five projects:

| Project                            | Owns                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| `ArenaApi.Web`                     | Minimal API host, `Program.cs`, `appsettings.*.json`, endpoint wiring |
| `ArenaApi.Core`                    | Application logic — vertical slices in `Features/`, validators, `Registration.cs` |
| `ArenaApi.Domain`                  | Entities, aggregates, value objects, domain events. No EF dependency  |
| `ArenaApi.Contracts`               | HTTP DTOs. No Domain dependency                                       |
| `ArenaApi.Infrastructure.Postgres` | `ArenaDbContext`, EF configurations, migrations                       |

## Phase 0 status

Only the health endpoint is wired. `Features/` directories are placeholders
ready for vertical slices: `Packages`, `Tasks`, `Runs`, `Progress`, `Scoreboard`,
`Chapters`. See [/docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for the
planned model.

## Adding a new feature

```
ArenaApi.Core/Features/<Name>/
├── UseCases/
│   └── <Action><Name>/
│       ├── <Action><Name>Query.cs       # or Command
│       ├── <Action><Name>Handler.cs     # returns Result<T, Error>
│       └── <Action><Name>Endpoint.cs    # minimal API mapping
├── Repositories/
│   ├── I<Name>sRepository.cs
│   └── <Name>sRepository.cs             # lives in Infrastructure.Postgres
└── Domain/                              # feature-local types if needed
```

Then add an aggregator call in `Web/Endpoints/EndpointMapper.cs` (when that
file appears) or directly in `Program.cs`.

## Conventions

- `Guid.CreateVersion7()` in domain factories. `Guid.NewGuid()` is banned
  (see `backend/BannedSymbols.txt`).
- `Result<T, Error>` for business outcomes — no exceptions.
- Never modify existing migrations. Add a corrective one.
- Default schema is `arena` — see `ArenaDbContext.SchemaName`.
- Connection string key is `Database`; constant in `Core/ConnectionStringNames.cs`.
