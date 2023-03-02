import config from '../config.json' assert {type: "json"};
import fetch from 'node-fetch';
import { readdirSync } from 'fs';

/*
    Check if a specific feature is enabled

    @param isFeatureEnabled The feature to check if enabled.
    @param res Passing through res.
    @param lang Passing through lang.
*/
export function isFeatureEnabled(isFeatureEnabled, res, lang) {
    if (isFeatureEnabled)
        return;

    return res.send({
        success: false,
        message: `${lang.api.featureDisabled}`
    });
}

/*
    Ensure that a required field is present and has a non-null value, 
    and to return an error message if this is not the case.

    @param body
    @param field 
    @param res Passing through res.
*/
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

export async function isFeatureWebRouteEnabled(isFeatureEnabled, req, res, features) {
    if (!isFeatureEnabled) {
        res.view('session/featureDisabled', {
            "pageTitle": `Feature Disabled`,
            config: config,
            req: req,
            res: res,
            features: features,
            globalImage: await getGlobalImage(),
        });
        return false;
    }
    return true;
}

export function isLoggedIn(req) {
    if (req.session.user) return true;
    else return false;
}

export async function hasPermission(permissionNode, req, res, features) {
    if (!isLoggedIn(req)) {
        res.view('session/noPermission', {
            "pageTitle": `Access Restricted`,
            config: config,
            req: req,
            res: res,
            features: features,
            globalImage: await getGlobalImage(),
        });
        return false;
    }

    const userPermissions = req.session.user.permissions;

    function hasSpecificPerm(node, permissionArray) {
        return userPermissions.some(node => node === permissionNode);
    }

    if (!hasSpecificPerm(permissionNode, userPermissions)) {
        res.view('session/noPermission', {
            "pageTitle": `Access Restricted`,
            config: config,
            req: req,
            res: res,
            features: features,
            globalImage: await getGlobalImage(),
        });
        return false;
    }
    return true;
}

export function setBannerCookie(alertType, alertContent, res) {
    var expiryTime = new Date();
    expiryTime.setSeconds(expiryTime.getSeconds() + 1);

    // Set Alert Type
    res.setCookie('alertType', alertType, {
        path: '/',
        expires: expiryTime
    })

    // Set Content Type
    res.setCookie('alertContent', alertContent, {
        path: '/',
        expires: expiryTime
    })
    return true
}

export async function postAPIRequest(postURL, apiPostBody, failureRedirectURL, res) {
    const response = await fetch(postURL, {
        method: 'POST',
        body: JSON.stringify(apiPostBody),
        headers: {
            'Content-Type': 'application/json',
            'x-access-token': process.env.apiKey
        }
    });
    const data = await response.json();

    if (!data.success) {
        setBannerCookie("danger", `Failed to Process: ${data.message}`, res);
        return res.redirect(failureRedirectURL);
    }

    return console.log(data);
}

export async function getGlobalImage() {
    var path = './assets/images/globalImages/';
    var files = await readdirSync(path);

    // Now files is an Array of the name of the files in the folder and you can pick a random name inside of that array.
    let chosenFile = await files[Math.floor(Math.random() * files.length)] 

    return "../images/globalImages/" + chosenFile;
}