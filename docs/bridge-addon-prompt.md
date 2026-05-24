# zander-addon — Bridge Executor Implementation Prompt

Use this document as a prompt when implementing or extending the server-side Bridge executor in zander-addon. It describes the exact API contract, the polling loop, and what the addon must do with each task.

---

## Context

zander-web exposes a Bridge API at `/api/bridge`. The Minecraft server addon (zander-addon) is responsible for:

1. Polling for pending tasks assigned to this server.
2. Executing each task as a console command on the Minecraft server.
3. Reporting the result (success or failure) back to zander-web.

The server does **not** receive push notifications. It must poll on a fixed interval (recommended: every 5 seconds).

---

## Configuration the addon needs

| Key | Description |
|-----|-------------|
| `bridgeUrl` | Base URL of zander-web, e.g. `https://craftingforchrist.net` |
| `bridgeToken` | Shared secret sent as `Authorization: Bearer <token>` on every request |
| `serverSlug` | This server's unique slug, e.g. `survival`. Used to filter tasks for this server only. |
| `pollIntervalMs` | How often to poll, default `5000` (5 seconds) |

---

## Step 1 — Poll for pending tasks

```
GET {bridgeUrl}/api/bridge/processor/get
  ?status=pending
  &claim=true
  &slug={serverSlug}
  &limit=50

Headers:
  Authorization: Bearer {bridgeToken}
  Content-Type: application/json
```

- `claim=true` atomically marks the returned tasks as `processing` so another server instance cannot claim the same tasks.
- `slug` filters to only tasks for this server.
- `limit` is capped at 250 server-side. 50 is a safe default.

### Success response

```json
{
  "success": true,
  "data": [
    {
      "executorTaskId": 42,
      "slug": "survival",
      "command": "lp user Notch parent add vip",
      "status": "processing",
      "routineSlug": null,
      "metadata": { "purchaseId": 7, "username": "Notch" },
      "result": null,
      "priority": 0,
      "executedBy": null,
      "createdAt": "2026-05-24T10:00:00.000Z",
      "updatedAt": "2026-05-24T10:00:01.000Z",
      "processedAt": null
    }
  ],
  "meta": {
    "status": "pending",
    "claimed": true,
    "count": 1
  }
}
```

If `data` is an empty array, there are no tasks to run. Sleep until the next poll interval.

---

## Step 2 — Execute each command

For each task in `data`:

1. Read `task.command`. The command has already been normalised (leading slashes stripped, placeholders resolved). Run it verbatim via `Bukkit.dispatchCommand(Bukkit.getConsoleSender(), task.command)` or the equivalent for your platform.
2. Capture whether the dispatch succeeded or threw an exception.
3. Proceed to Step 3 immediately — do not wait for the next poll cycle to report.

**Do not re-resolve placeholders.** zander-web already substitutes `{{ username }}`, `{{ purchaseId }}`, etc. before inserting the task. The `command` field in the API response is the final, ready-to-run string.

---

## Step 3 — Report the result

After executing (or failing to execute) a task, POST the result back:

```
POST {bridgeUrl}/api/bridge/processor/task/{executorTaskId}/report

Headers:
  Authorization: Bearer {bridgeToken}
  Content-Type: application/json

Body (JSON):
{
  "status": "completed",          // or "failed"
  "result": "Command dispatched", // human-readable result or error message
  "executedBy": "survival"        // your serverSlug — identifies which server ran it
}
```

### Status values

| Value | When to use |
|-------|-------------|
| `completed` | Command was dispatched without error |
| `failed` | An exception was thrown or the command string was empty/invalid |

### Success response

```json
{
  "success": true,
  "message": "Task 42 marked as completed",
  "data": { "executorTaskId": 42, "status": "completed", ... }
}
```

---

## Error handling

| Scenario | What to do |
|----------|------------|
| HTTP error on poll (4xx/5xx) | Log the error, skip this cycle, retry next interval |
| `success: false` in poll response | Log the message, skip this cycle |
| Command dispatch throws | Report `status=failed`, `result=<exception message>` |
| HTTP error on report | Retry the report up to 3 times with 2 s back-off; log and abandon after 3 failures |
| Task already `processing` elsewhere | Will not be returned by the API (claimed atomically) — no action needed |

---

## Polling loop (pseudocode)

```
every pollIntervalMs:
  tasks = GET /api/bridge/processor/get?status=pending&claim=true&slug={serverSlug}&limit=50

  if tasks is empty:
    continue

  for each task in tasks:
    try:
      dispatchConsoleCommand(task.command)
      POST /api/bridge/processor/task/{task.executorTaskId}/report
        { status: "completed", result: "ok", executedBy: serverSlug }
    catch exception:
      POST /api/bridge/processor/task/{task.executorTaskId}/report
        { status: "failed", result: exception.message, executedBy: serverSlug }
```

Run the inner loop sequentially (one command at a time) to avoid flooding the server console. If you need parallel execution for performance, batch by `routineSlug` but keep the per-task report requirement.

---

## Optional endpoints

### Reset a stuck task (back to `pending`)

```
POST {bridgeUrl}/api/bridge/processor/task/{executorTaskId}/reset
Headers: Authorization: Bearer {bridgeToken}
```

Use this if a task got stuck in `processing` (e.g. the server crashed mid-execution).

### Clear completed/failed tasks

```
POST {bridgeUrl}/api/bridge/processor/clear
Headers: Authorization: Bearer {bridgeToken}
Body: { "status": "completed" }
```

---

## Relevant zander-web source files

| File | Purpose |
|------|---------|
| `api/routes/bridge.js` | Bridge API route handlers — the authoritative source of truth |
| `controllers/webstoreController.js` | `enqueueCommands()` — how tasks are created after a purchase |
| `cron/bridgeCleanupCron.js` | Automatic cleanup of old completed/failed tasks |
| `views/dashboard/bridge.ejs` | Admin dashboard view for inspecting the task queue |
