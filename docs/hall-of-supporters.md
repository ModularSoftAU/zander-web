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

## Detailed Admin Setup Guide

### 1. Planning your Hall
Before creating slots, decide on your sections (ranks) and their priorities. Sections with higher priority numbers will be filled first. Players who belong to multiple sections will only appear in the one with the highest priority.

### 2. Managing Sections
*   **Sign Labels**: This text appears on the second line of the sign below the statue. Use `/hall section setlabel <id> <text>`.
*   **LuckPerms Groups**: Link sections to LP groups using `/hall section addgroup <id> <group>`. A section can have multiple groups.
*   **Priority**: Use `/hall section setpriority <id> <number>` to control assignment order.

### 3. Placing Slots
Slots are the physical "pedestals" for statues.
*   Always ensure there is a sign block below the statue location for the label.
*   Use custom IDs for slots to make them easier to manage (e.g., `vip-row-1`).
*   `/hall slot create <sectionId> [customId]`

### 4. Manual Overrides & Locking
*   **Manual Assignment**: Force a specific player to a slot using `/hall assign <player> <slotId>`.
*   **Locking**: Use `/hall lock <slotId>` to prevent the auto-population system from overwriting a manual assignment or an empty slot.

## Features
- **Auto-population**: Players are automatically assigned to available slots based on their LuckPerms groups and priority.
- **Customizable Statues**: Players can customize their own statue's armor and items via a GUI.
- **Forced Identity**: Statues always display the player's real skin head and username.
- **Particle Effects**: Supporters can choose from various particle effects to surround their statue.
- **Plugin-controlled Signs**: Signs below statues automatically display the player's name and their role label.
- **Manual Overrides**: Admins can manually assign or lock slots for specific players.
- **YAML Persistence**: All data is stored in simple YAML files for easy maintenance.

## Documentation Links
- [User Customization Guide](statue-customization-guide.md)
- [Admin Command Reference](hall-of-supporters.md#commands)

## Administration Commands
... (see [hall-of-supporters.md](hall-of-supporters.md) for full reference)
