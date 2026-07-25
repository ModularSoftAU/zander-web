package dev.anchorlight.zander.hub.portal;

/**
 * An axis-aligned block-coordinate cuboid within a single world. The canonical
 * constructor normalises corners so callers never need to sort min/max themselves.
 */
public record PortalRegion(String world, int minX, int minY, int minZ, int maxX, int maxY, int maxZ) {
    public PortalRegion {
        if (minX > maxX) {
            int tmp = minX;
            minX = maxX;
            maxX = tmp;
        }
        if (minY > maxY) {
            int tmp = minY;
            minY = maxY;
            maxY = tmp;
        }
        if (minZ > maxZ) {
            int tmp = minZ;
            minZ = maxZ;
            maxZ = tmp;
        }
    }

    public boolean contains(int x, int y, int z) {
        return x >= minX && x <= maxX
                && y >= minY && y <= maxY
                && z >= minZ && z <= maxZ;
    }

    public int minChunkX() {
        return minX >> 4;
    }

    public int maxChunkX() {
        return maxX >> 4;
    }

    public int minChunkZ() {
        return minZ >> 4;
    }

    public int maxChunkZ() {
        return maxZ >> 4;
    }
}
