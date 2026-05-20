import { Panel, SegmentedTabs } from "@/shared/ui";
import type { TaskDetail } from "@/entities/task";

export function TaskStatementPanel({ task }: { task: TaskDetail }) {
  return (
    <Panel className="flex min-h-[420px] flex-col overflow-hidden lg:h-full lg:min-h-0">
      <div className="border-b border-border-subtle px-5 pt-3">
        <SegmentedTabs
          items={[
            { id: "task", label: "Задача" },
            { id: "submissions", label: "Попытки" },
          ]}
          defaultActiveId="task"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-auto p-5">
        <header>
          <h2 className="text-2xl font-semibold text-text">{task.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-dim">
            {task.description}
          </p>
        </header>

        {task.examples.length > 0 ? (
          <div className="space-y-4">
            {task.examples.map((ex, i) => (
              <div
                key={i}
                className="rounded-md border border-border-subtle bg-bg-elevated/70 p-4 font-mono text-[13px] leading-relaxed text-text"
              >
                <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-text-dim">
                  Пример {i + 1}
                </p>
                <p>
                  <span className="text-text-muted">Ввод:</span> {ex.input}
                </p>
                <p>
                  <span className="text-text-muted">Вывод:</span> {ex.output}
                </p>
                {ex.explanation ? (
                  <p className="mt-2 text-text-dim">
                    <span className="text-text-muted">Пояснение:</span>{" "}
                    {ex.explanation}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {task.constraints.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-dim">
              Ограничения
            </h3>
            <ul className="mt-2 space-y-1 font-mono text-[13px] text-text">
              {task.constraints.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-text-muted" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {task.hints.length > 0 ? (
          <details className="rounded-md border border-border-subtle bg-bg-elevated/70 p-4 text-sm text-text-dim">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Подсказки
            </summary>
            <ul className="mt-3 space-y-2">
              {task.hints.map((h, i) => (
                <li key={i}>
                  <span className="font-mono text-text-muted">#{i + 1}</span>{" "}
                  {h}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Panel>
  );
}
