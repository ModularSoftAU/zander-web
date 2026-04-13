# Hall of Supporters / Hall of Roles

The Hall of Supporters is a feature for the Zander Hub plugin that automatically populates armor stand statues and signs with eligible players based on their LuckPerms groups.

## Quick Start Guide (First Time Setup)

Follow these steps to get your Hall of Supporters running in minutes:

1.  **Create a Section**: A section represents a group of players sharing a rank.
    *   `/hall section create staff`
    *   `/hall section setlabel staff Staff` (This label appears on the signs below the statues)
    *   `/hall section addgroup staff admin` (Link the section to a LuckPerms group)
2.  **Create Slots**: A slot is a physical location where a statue will stand.
    *   Find the exact spot where you want a statue. **Statues will face the direction you are looking when you run the command.**
    *   **Place a sign block** exactly one block below your feet. The plugin uses this sign to display the player's name and rank label. **Note: The sign block is meant to stay there as a permanent part of the pedestal.**
    *   Run: `/hall slot create staff staff-1`
3.  **Refresh**: Trigger the auto-population system.
    *   `/hall refresh`
4.  **Verification**: Check your work.
    *   `/hall slot list`

## Features
- **Auto-population**: Players are automatically assigned to available slots based on their LuckPerms groups and priority.
- **Customizable Statues**: Players can customize their own statue's armor and items via a GUI.
- **Forced Identity**: Statues always display the player's real skin head and username.
- **Particle Effects**: Supporters can choose from various particle effects to surround their statue.
- **Plugin-controlled Signs**: Signs below statues automatically display the player's name and their role label.
- **Manual Overrides**: Admins can manually assign or lock slots for specific players.
- **YAML Persistence**: All data is stored in simple YAML files for easy maintenance.

## Detailed Administration

### Sections
Sections are the "containers" for ranks.
*   **Priority**: If a player has multiple ranks, they appear in the section with the highest priority number. Use `/hall section setpriority <id> <number>`.
*   **Sign Labels**: Set what appears on the sign below the statue using `/hall section setlabel <id> <text>`.

### Slots
Slots are physical locations.
*   **Rotation**: When creating a slot with `/hall slot create`, the statue's facing direction is set to your current yaw.
*   **Signs**: The sign block below the slot is a mandatory part of the pedestal. The plugin will take control of its text.
*   **Dynamic Sorting**: By default, slots are filled automatically based on player priority (usually LuckPerms weight). If a new, higher-priority player joins the server or gains a rank, they may "bump" an existing player out of their slot or move them to a different one.
*   **Slot Locking**: If you want a specific player to stay in a specific slot permanently, you can use `/hall lock <slotId>`. This prevents the auto-assignment system from moving or replacing the player in that slot.

## Documentation Links
- [User Customization Guide](statue-customization-guide.md)
- [Admin Command Reference](hall-of-supporters.md#commands)

## Administration Commands
... (see [hall-of-supporters.md](hall-of-supporters.md) for full reference)
