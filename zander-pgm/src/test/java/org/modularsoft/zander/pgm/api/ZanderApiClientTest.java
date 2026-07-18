package org.modularsoft.zander.pgm.api;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ZanderApiClientTest {

    @Test
    void bearerTokenPrefixesMixedToken() {
        assertEquals("Bearer mixed-secret", ZanderApiClient.bearerToken("mixed-secret"));
    }

    @Test
    void resolveUrlAvoidsDuplicatingApiSegment() {
        assertEquals("https://craftingforchrist.net/api/mixed/events",
                ZanderApiClient.resolveUrl("https://craftingforchrist.net/api", "/api/mixed/events"));
        assertEquals("https://craftingforchrist.net/api/mixed/events",
                ZanderApiClient.resolveUrl("https://craftingforchrist.net", "/api/mixed/events"));
    }
}
