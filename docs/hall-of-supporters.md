# Hall of Supporters / Hall of Roles

The Hall of Supporters is a feature for the Zander Hub plugin that automatically populates armor stand statues and signs with eligible players based on their LuckPerms groups.

## Quick Start Guide (First Time Setup)

Follow these steps to get your Hall of Supporters running in minutes:

1.  **Create a Section**: Define a role group (e.g., Staff).
    *   `/hall section create staff`
    *   `/hall section setlabel staff Staff`
    *   `/hall section addgroup staff admin`
    *   `/hall section addgroup staff moderator`
2.  **Create Slots**: Place physical statue locations.
    *   Stand where you want a statue.
    *   Place a sign block exactly one block below your feet.
    *   `/hall slot create staff staff-1`
    *   (Repeat for more slots, e.g., `/hall slot create staff staff-2`)
3.  **Refresh**: Trigger the auto-population.
    *   `/hall refresh`
4.  **Verification**: Check what was created.
    *   `/hall slot list`
    *   `/hall section list`

## Features
- **Auto-population**: Players are automatically assigned to available slots based on their LuckPerms groups and priority.
- **Customizable Statues**: Players can customize their own statue's armor and items via a GUI.
- **Forced Identity**: Statues always display the player's real skin head and username, which cannot be changed by the player.
- **Plugin-controlled Signs**: Signs below statues automatically display the player's name and their role label.
- **Manual Overrides**: Admins can manually assign or lock slots for specific players.
- **YAML Persistence**: All data is stored in simple YAML files for easy maintenance.

## Administration

### Configuration
The feature is configured in the main `config.yml` of `zander-hub`.

```yaml
hall:
  enabled: true
  refresh-interval: 30 # Minutes between auto-refreshes
  allowed-materials:
    - IRON_CHESTPLATE
    - GOLDEN_CHESTPLATE
    - DIAMOND_CHESTPLATE
    - NETHERITE_CHESTPLATE
    - LEATHER_CHESTPLATE
  debug: false
```

### Sections
Sections represent different roles or ranks (e.g., Staff, Diamond Supporter). Each section has a priority and is linked to one or more LuckPerms groups.

Sections are stored in `plugins/zander-hub/hall/sections.yml`.

### Commands
- `/hall reload`: Reloads the hall configuration. (`hall.admin`)
- `/hall refresh`: Forces an immediate refresh of all assignments and re-renders all statues. (`hall.refresh`)
- `/hall section list`: Lists all sections. (`hall.section.manage`)
- `/hall section info <id>`: Shows detailed info for a section. (`hall.section.manage`)
- `/hall section create <id>`: Creates a new section. (`hall.section.manage`)
- `/hall section setlabel <id> <text>`: Sets the sign label for a section. (`hall.section.manage`)
- `/hall section setpriority <id> <number>`: Sets the priority for a section. (`hall.section.manage`)
- `/hall section addgroup <id> <group>`: Adds a LuckPerms group to a section. (`hall.section.manage`)
- `/hall slot list`: Lists all slots and current assignments. (`hall.slot.manage`)
- `/hall slot info <id>`: Shows detailed info for a slot. (`hall.slot.manage`)
- `/hall slot create <sectionId> [customId]`: Creates a new slot at your current location. (`hall.slot.manage`)
- `/hall slot remove <slotId>`: Removes a slot. (`hall.slot.manage`)
- `/hall assign <player> <slotId>`: Manually assigns a player to a specific slot. (`hall.assign.manage`)
- `/hall unassign <slotId>`: Removes the assignment from a slot. (`hall.assign.manage`)
- `/hall lock <slotId>`: Locks a slot, preventing auto-population from changing it. (`hall.slot.manage`)
- `/hall unlock <slotId>`: Unlocks a slot. (`hall.slot.manage`)
- `/hall preview <player>`: Previews a player's statue (if assigned). (`hall.preview`)
- `/mystatue`: Opens the customization GUI for players who have an assigned statue. (`hall.customize`)

### Permissions
- `hall.admin`: Reload config.
- `hall.refresh`: Manually refresh the hall.
- `hall.section.manage`: Manage sections.
- `hall.slot.manage`: Manage slots and locking.
- `hall.assign.manage`: Manual assignment overrides.
- `hall.customize`: Use `/mystatue`.
- `hall.customize.offhand`: Allows offhand customization in GUI.
- `hall.preview`: Use `/hall preview`.

## How it works
1. **Eligibility**: The system scans online players (and those with existing assignments) to see if they belong to any groups defined in the sections.
2. **Sorting**: Players are sorted within each section based on the `sort-mode` (e.g., `weight_desc`, `username_asc`).
3. **Assignment**: The system fills available slots in order of section priority and then slot display order. Assignments are performed asynchronously to prevent main-thread lag.
4. **Rendering**: Armor stands and signs are spawned/updated based on the assignments and any player customizations. Render checks if chunks are loaded before rendering.
5. **Persistence**: All settings, slots, assignments, and player customizations are saved in the `plugins/zander-hub/hall/` directory.
