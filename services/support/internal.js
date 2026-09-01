/**
 * services/support/internal.js
 *
 * Shared internals for the support-ticket service modules. Small, dependency-light
 * helpers used across more than one concern file (and by the
 * controllers/supportTicketController.js barrel). Not part of the public API — do
 * not re-export from the controller.
 *
 * Extracted from controllers/supportTicketController.js (Phase 7 decomposition).
 */

import { hashEmail } from "../../api/common.js";

/**
 * Build an avatar URL for a user row / profile, honouring their configured
 * profile-picture source. Returns null when no avatar can be derived.
 */
export async function buildAvatarUrl(profile) {
    if (!profile) return null;

    try {
        if (profile.profilePicture_type === "GRAVATAR" && profile.profilePicture_email) {
            const emailHash = await hashEmail(profile.profilePicture_email);
            return `https://gravatar.com/avatar/${emailHash}?size=200`;
        }

        if (profile.profilePicture_type === "CRAFTATAR" && profile.uuid) {
            return `https://crafthead.net/helm/${profile.uuid}`;
        }
    } catch (avatarError) {
        console.error("buildAvatarUrl: failed to build avatar", avatarError);
    }

    return null;
}
