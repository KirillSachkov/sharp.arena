"use client";

import { useState } from "react";
import { Panel, SegmentedTabs, TestRow } from "@/shared/ui";

const TESTS = [
  { id: 1, status: "passed" as const, durationMs: 2 },
  { id: 2, status: "passed" as const, durationMs: 1 },
  { id: 3, status: "passed" as const, durationMs: 1 },
  { id: 4, status: "passed" as const, durationMs: 1 },
];

export function TaskTestsPanel() {
  const [tab, setTab] = useState<"tests" | "console">("tests");

  return (
    <Panel className="flex min-h-[260px] flex-col overflow-hidden lg:h-full lg:min-h-0">
      <div className="border-b border-border-subtle px-5 pt-3">
        <SegmentedTabs
          items={[
            { id: "tests", label: "Тесты" },
            { id: "console", label: "Консоль" },
          ]}
          defaultActiveId="tests"
          onChange={(id) => setTab(id as "tests" | "console")}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "tests" ? (
          <div className="flex h-full flex-col">
            <div className="flex-1">
              {TESTS.map((t) => (
                <TestRow
                  key={t.id}
                  index={t.id}
                  status={t.status}
                  durationMs={t.durationMs}
                />
              ))}
            </div>
            <div className="space-y-1 border-t border-border-subtle bg-bg-elevated/40 px-5 py-3 font-mono text-xs">
              <p className="text-accent-green">All tests passed!</p>
              <p className="text-text-dim">
                <span className="text-text-muted">Runtime:</span> 12ms
              </p>
              <p className="text-text-dim">
                <span className="text-text-muted">Memory:</span> 18.3 MB
              </p>
            </div>
          </div>
        ) : (
          <pre className="m-0 h-full overflow-auto p-5 font-mono text-[12px] leading-relaxed text-text-dim">
            <span className="text-text-muted">$</span> dotnet run --project
            harness{"\n"}
            <span className="text-accent-green">→ Compilation succeeded.</span>
            {"\n"}
            <span className="text-accent-green">→ 4/4 tests passed.</span>
            {"\n"}
            <span className="text-text-muted"># exit 0</span>
          </pre>
        )}
      </div>
    </Panel>
  );
}
