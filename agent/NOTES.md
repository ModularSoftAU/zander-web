# Zander Chat Formatting - Server Operator Notes

This document explains how to configure LuckPerms to display hoverable rank prefixes in the chat.

## Required Meta Keys

For each LuckPerms group that you want to have a custom prefix, you must set two meta keys: `displayname` and `rank_description`.

- `displayname`: The human-readable name of the rank (e.g., "Admin", "Moderator").
- `rank_description`: A short description of the rank's purpose.

### Fallbacks

- If `displayname` is not set, the plugin will try to use the group's prefix. If that is also not set, it will default to "Member".
- If `rank_description` is not set, it will default to "No description set for this rank."

## LuckPerms Commands

Here are the commands to set the required meta keys for a group. Replace `<group>` with the name of the LuckPerms group you want to modify.

### Set Display Name

```
lp group <group> meta set displayname "Rank Name"
```

**Example:**

```
lp group admin meta set displayname "Admin"
```

### Set Rank Description

```
lp group <group> meta set rank_description "A short description of the rank."
```

**Example:**

```
lp group admin meta set rank_description "Has full access to staff & server tools."
```

## Important: Disable Backend Chat Formatters

Because Zander now handles all chat formatting on the proxy, you **must** disable any chat formatting plugins on your backend servers (e.g., Paper, Spigot).

If you do not, you may see **duplicate or incorrectly formatted chat messages**, as both the proxy and the backend server will be trying to format the same message.
