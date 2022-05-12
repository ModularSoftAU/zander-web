export function isFeatureEnabled(isFeatureEnabled, res, features, lang) {
    if (isFeatureEnabled)
        return;

    return res.send({
        success: false,
        message: `${lang.api.featureDisabled}`
    });
}

export function required(body, field, res) {
    // Prematurely exits an API request if a required field has not been
    // defined or not null. If the body is defined then we error as well. This
    // can happen when no parameters exist.
    if (!body || !(field in body))
        return res.send({
            success: false,
            message: `Body requires field '${field}'`
        });
    
    if (body[field] === null)
        return res.send({
            success: false,
            message: `Field ${field} cannot be null`
        });
    
    return body[field];
}

export function optional(body, field) {
    // Jaedan: I am aware that this is pretty much default behaviour, however
    // this takes into consideration times where no body is included. Without
    // this check requests with only optional fields (that are all unused) will
    // cause a null object to be referenced, causing an error.
    if (!body || !(field in body) || body[field] === null)
        return null;
    
    return body[field];
}