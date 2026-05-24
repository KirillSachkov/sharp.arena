import type { TaskTopic } from "./types";

export const TOPIC_LABEL: Record<TaskTopic, string> = {
  /* Legacy algorithm labels. */
  arrays: "Массивы",
  strings: "Строки",
  "hash-map": "Хеш-таблица",
  "linked-list": "Связный список",
  "binary-search": "Бинарный поиск",
  "dynamic-programming": "ДП",
  graphs: "Графы",
  trees: "Деревья",
  math: "Математика",
  /* Sharp Arena curriculum. */
  "csharp-basics": "C# Basics",
  oop: "OOP",
  collections: "Collections",
  linq: "LINQ",
  async: "Async",
  algorithms: "Algorithms",
  "data-structures": "Data Structures",
  "aspnet-core": "ASP.NET Core",
  "web-api": "Web API",
  websockets: "WebSockets",
  "ef-core": "EF Core",
  sql: "SQL",
  /* Sub-tags. */
  fundamentals: "Fundamentals",
  "control-flow": "Control Flow",
  "real-time": "Real-time",
  concurrency: "Concurrency",
  database: "Database",
  array: "Array",
};
