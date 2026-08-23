package org.modularsoft.zander.hub.hall.models;

import java.util.List;

public class HallSection {
    private String id;
    private String displayName;
    private String signLabel;
    private List<String> groups;
    private int priority;
    private String sortMode;
    private boolean allowCustomization;
    private boolean enabled;

    public HallSection(String id, String displayName, String signLabel, List<String> groups, int priority, String sortMode, boolean allowCustomization, boolean enabled) {
        this.id = id;
        this.displayName = displayName;
        this.signLabel = signLabel;
        this.groups = groups;
        this.priority = priority;
        this.sortMode = sortMode;
        this.allowCustomization = allowCustomization;
        this.enabled = enabled;
    }

    public String getId() { return id; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getSignLabel() { return signLabel; }
    public void setSignLabel(String signLabel) { this.signLabel = signLabel; }
    public List<String> getGroups() { return groups; }
    public void setGroups(List<String> groups) { this.groups = groups; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public String getSortMode() { return sortMode; }
    public void setSortMode(String sortMode) { this.sortMode = sortMode; }
    public boolean isAllowCustomization() { return allowCustomization; }
    public void setAllowCustomization(boolean allowCustomization) { this.allowCustomization = allowCustomization; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
