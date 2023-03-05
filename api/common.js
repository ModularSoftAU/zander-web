import config from '../config.json' assert {type: "json"};
import fetch from 'node-fetch';
import { readdirSync } from 'fs';

/*
    Check if a specific feature is enabled.

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

    @param body Passing through the req.body
    @param field The name of the field.
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


/*
    Check if an optional field is present in the body object, and return its value if it is.

    @param body Passing through the req.body
    @param field The name of the field.
*/
export function optional(body, field) {
    // Jaedan: I am aware that this is pretty much default behaviour, however
    // this takes into consideration times where no body is included. Without
    // this check requests with only optional fields (that are all unused) will
    // cause a null object to be referenced, causing an error.
    if (!body || !(field in body) || body[field] === null)
        return null;

    return body[field];
}

/*
    Check if a specific web feature is enabled.

    @param isFeatureEnabled The feature to check if enabled.
    @param req Passing through req
    @param res Passing through res
    @param features Passing through features
*/
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

/*
    Check if a user is logged in or not.

    @param req Passing through req
*/
export function isLoggedIn(req) {
    if (req.session.user) return true;
    else return false;
}

/*
    Check if the user has a specific permission.

    @param permissionNode The permission node to check permission of.
    @param req Passing through req
    @param res Passing through res
    @param features Passing through features
*/
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

/*
    Makes a POST API request to the specified postURL with the provided apiPostBody.
    It includes a header with the x-access-token value taken from an environment variable named apiKey.
    If the request is successful, it logs the response data.
    If the request fails, it sets a cookie with a "danger" alert type and an error message, 
    then redirects the user to the specified failureRedirectURL.

    @param postURL The POST url that the apiPostBody will go to in the API.
    @param apiPostBody The request body for the postURL.
    @param failureRedirectURL If the request returns false, where the API will redirect the user to.
    @param res Passing through res.
*/
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

    console.log(data);

    if (data.alertType) {
        setBannerCookie(`${data.alertType}`, `${data.alertContent}`, res);
    }

    if (!data.success) {
        return res.redirect(failureRedirectURL);
    }

    return console.log(data);
}

/*
    Returns the path of a randomly chosen image file from a specified directory. 
    The function first reads the names of the files in the directory using the readdirSync function and 
    then selects a random file from the list using the Math.random() function. 
    Finally, the function returns the path of the chosen file by concatenating the file name with the relative path to the directory.
*/
export async function getGlobalImage() {
    var path = './assets/images/globalImages/';
    var files = await readdirSync(path);

    // Now files is an Array of the name of the files in the folder and you can pick a random name inside of that array.
    let chosenFile = await files[Math.floor(Math.random() * files.length)] 

    return "../images/globalImages/" + chosenFile;
}

/*
    Sets two cookies (alertType and alertContent) with specified values and an expiration time of one second. 
    These cookies are set on the root path and are returned by the function.

    @param alertType The alert content type and colour according to https://getbootstrap.com/docs/4.0/components/alerts/#examples
    @param alertContent The alert content text.
    @param res Passing through res
*/
export function setBannerCookie(alertType, alertContent, res) {
    try {
        var expiryTime = new Date();
        expiryTime.setSeconds(expiryTime.getSeconds() + 1);

        // Set Alert Type
        // res.setCookie('alertType', alertType, {
        //     path: '/',
        //     expires: expiryTime
        // })

        // // Set Content Type
        // res.setCookie('alertContent', alertContent, {
        //     path: '/',
        //     expires: expiryTime
        // })

        console.log(`setBannerCookie is being called.`);

        res.setCookie('alertType', alertType, {
            path: '/',
            expires: expiryTime
        });

        res.setCookie('alertContent', alertContent, {
            path: '/',
            expires: expiryTime
        });

        // return true;

    } catch (error) {
        console.log(error);
    }
}
