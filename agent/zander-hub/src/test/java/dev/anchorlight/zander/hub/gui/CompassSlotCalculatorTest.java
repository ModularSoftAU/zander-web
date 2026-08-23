package dev.anchorlight.zander.hub.gui;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class CompassSlotCalculatorTest {
    @Test
    void explicitSlotIsHonoured() {
        var result = CompassSlotCalculator.assign(List.of("survival"), Map.of("survival", 3), 9);
        assertEquals(3, result.get(0).slot());
    }

    @Test
    void centredSlotForSingleEntryWithNoExplicitSlot() {
        var result = CompassSlotCalculator.assign(List.of("survival"), Map.of(), 9);
        assertEquals(4, result.get(0).slot());
    }

    @Test
    void multipleEntriesAreEvenlySpacedWhenUnassigned() {
        var result = CompassSlotCalculator.assign(List.of("a", "b", "c"), Map.of(), 9);
        assertEquals(3, result.size());
        assertEquals(9, result.stream().map(CompassSlotCalculator.SlotAssignment::slot).distinct().count() * 3);
    }

    @Test
    void rejectsDuplicateExplicitSlots() {
        assertThrows(IllegalArgumentException.class, () ->
                CompassSlotCalculator.assign(List.of("a", "b"), Map.of("a", 2, "b", 2), 9));
    }

    @Test
    void rejectsOutOfRangeExplicitSlot() {
        assertThrows(IllegalArgumentException.class, () ->
                CompassSlotCalculator.assign(List.of("a"), Map.of("a", 20), 9));
        assertThrows(IllegalArgumentException.class, () ->
                CompassSlotCalculator.assign(List.of("a"), Map.of("a", -1), 9));
    }

    @Test
    void explicitAndAutoAssignedEntriesDoNotCollide() {
        var result = CompassSlotCalculator.assign(List.of("a", "b"), Map.of("a", 4), 9);
        int autoSlot = result.stream().filter(r -> r.entryId().equals("b")).findFirst().orElseThrow().slot();
        assertNotEquals(4, autoSlot);
    }
}
