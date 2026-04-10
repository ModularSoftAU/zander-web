package org.modularsoft.zander.hub.hall.manager;

import org.modularsoft.zander.hub.hall.models.HallSection;
import org.modularsoft.zander.hub.hall.persistence.HallPersistence;

import java.util.Map;

public class SectionManager {
    private final HallPersistence persistence;
    private Map<String, HallSection> sections;

    public SectionManager(HallPersistence persistence) {
        this.persistence = persistence;
        this.sections = persistence.loadSections();
    }

    public Map<String, HallSection> getSections() {
        return sections;
    }

    public void addSection(HallSection section) {
        sections.put(section.getId(), section);
        persistence.saveSections(sections);
    }

    public void removeSection(String id) {
        sections.remove(id);
        persistence.saveSections(sections);
    }

    public void save() {
        persistence.saveSections(sections);
    }
}
