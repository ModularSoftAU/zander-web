# Private Messaging (Zander Velocity)

Zander Velocity provides a private messaging system with direct messages, reply shortcuts, ignore lists, and per-player message toggles.

## Commands

### /message

Aliases: `m`, `msg`, `w`, `whisper`, `tell`, `t`  
Permission: `zander.command.message`

Usage:

```
/msg <player> <message...>
/tell <player> <message...>
```

Behavior:

- Sends a private message from the sender to the target player.
- Blocks messaging yourself.
- Rejects offline or unknown targets.
- Respects the target's `/togglemessages` preference and ignore list.
- Updates the reply mapping for both players when a message is sent.

Sender sees: `To <target>: <message>`  
Target sees: `From <sender>: <message>`

### /reply

Alias: `r`  
Permission: `zander.command.reply`

Usage:

```
/r <message...>
```

Behavior:

- Sends a private message to the last player you messaged (or who messaged you).
- If no target exists, returns `No one to reply to.`
- Re-checks all message rules (online, toggle, ignore).
- Clears the reply target when the target is offline.

### /ignore

Aliases: `ignores`  
Base permission: `zander.command.ignore`

Subcommands:

```
/ignore add <player>    # permission: zander.command.ignore.add
/ignore remove <player> # permission: zander.command.ignore.remove
/ignore list            # permission: zander.command.ignore.list
```

Behavior:

- Ignore lists store UUIDs and persist across restarts.
- Prevents ignoring yourself and duplicate entries.
- `/ignore list` shows up to 10 entries and includes a summary if more exist.
- If player B ignores player A, player A cannot message or reply to player B.

### /togglemessages

Alias: `toggle-messages`  
Permission: `zander.command.togglemessages`

Behavior:

- Toggles whether you can receive private messages.
- When disabled, inbound `/message` and `/reply` attempts are blocked.
- Outbound messaging remains allowed by default.

## Data Storage

- Persistent:
  - `messagesDisabled[uuid]` (boolean)
  - `ignoreList[uuid]` (set of UUIDs)
- In-memory (resets on restart):
  - `lastConversation[uuid]` (UUID)
