import {isFeatureEnabled, required, optional} from '../common'

export default function communityCreationApiRoute(app, config, db, features) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/communitycreation';

    app.get(baseEndpoint + '/get', async function(req, res) {
        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/submit', async function(req, res) {
        const creator = required(req.body, "creator", res);
        const creationName = optional(req.body, "creationName");
        const creationDescription = optional(req.body, "creationDescription");
        const creationLink = required(req.body, "creationLink", res);

        try {
            db.query(`INSERT INTO communityCreations (creatorId, creationName, creationDescription) VALUES ((select userId from users where username=?), ?, ?)`, [creator, creationName, creationDescription], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The creation ${creationName} has been successfully submitted for approval.`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/approve', async function(req, res) {
        const id = required(req.body, "id", res);
         
        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deny', async function(req, res) {
        const id = required(req.body, "id", res);
         
        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const creationId = required(req.body, "creationId", res);

        // ...
        res.send({ success: true });
    });

}