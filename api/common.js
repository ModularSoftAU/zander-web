import config from '../config.json' assert {type: "json"};

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
    // defined or null. If the body is not defined then we error as well.
    // This can happen when no parameters exist.
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

export function isFeatureWebRouteEnabled(isFeatureEnabled, res, features) {
    if (!isFeatureEnabled) {
        return res.view('session/featureDisabled', {
            "pageTitle": `Feature Disabled`,
            config: config,
            request: res,
            features: features
        });
    }
}

export function isLoggedIn(request) {
    if (request.session.user) return true;
    else return false;
}

export function hasPermission(permissionNode, request, reply) {
    if (!isLoggedIn(request)) {
        return reply.view('session/noPermission', {
            "pageTitle": `Access Restricted`,
            config: config,
            request: request
        });        
    }

    const userPermissions = request.session.user.permissions;
    console.log(userPermissions);
    console.log(permissionNode);

    // userPermissions.forEach(node => {
    //     console.log(node);
    //     if (node === permissionNode) {
    //         return;
    //     } else {
    //         return reply.view('session/noPermission', {
    //             "pageTitle": `Access Restricted`,
    //             config: config,
    //             request: request
    //         });
    //     }
    // });

    if (!userPermissions.indexOf(permissionNode) || !userPermissions || !userPermissions instanceof Array) {
        reply.view('session/noPermission', {
            "pageTitle": `Access Restricted`,
            config: config,
            request: request
        });
    }
}