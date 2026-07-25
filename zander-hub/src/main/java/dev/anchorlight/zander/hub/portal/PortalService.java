package dev.anchorlight.zander.hub.portal;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Runtime-authoritative view of portals: mediates between the persisted store
 * ({@link PortalRepository}) and the lookup structure used by movement detection
 * ({@link PortalSpatialIndex}). All mutation methods persist and re-index before returning.
 */
public class PortalService {
    private final PortalRepository repository;
    private final PortalSpatialIndex index;
    private Map<String, Portal> portals;

    public PortalService(PortalRepository repository, PortalSpatialIndex index) {
        this.repository = repository;
        this.index = index;
        this.portals = repository.load();
        this.index.rebuild(this.portals.values());
    }

    public void reload() {
        this.portals = repository.load();
        this.index.rebuild(this.portals.values());
    }

    public Collection<Portal> all() {
        return this.portals.values();
    }

    public Optional<Portal> find(String id) {
        return Optional.ofNullable(this.portals.get(PortalIdValidator.normalise(id)));
    }

    public void put(Portal portal) {
        this.portals.put(PortalIdValidator.normalise(portal.id()), portal);
        persistAndReindex();
    }

    public boolean delete(String id) {
        Portal removed = this.portals.remove(PortalIdValidator.normalise(id));
        if (removed == null) {
            return false;
        }
        persistAndReindex();
        return true;
    }

    public void setEnabled(String id, boolean enabled) {
        Portal existing = this.portals.get(PortalIdValidator.normalise(id));
        if (existing == null) {
            throw new IllegalArgumentException("No such portal: " + id);
        }
        put(new Portal(existing.id(), existing.displayName(), enabled, existing.region(), existing.destination(),
                existing.permission(), existing.cooldownMs(), existing.sound(),
                existing.successMessage(), existing.deniedMessage()));
    }

    private void persistAndReindex() {
        Map<String, Portal> snapshot = new LinkedHashMap<>(this.portals);
        this.portals = snapshot;
        repository.save(snapshot.values());
        index.rebuild(snapshot.values());
    }
}
