import config from '../../config.json'
import db from '../../controllers/databaseController'
const baseEndpoint = config.siteConfiguration.apiRoute + "/communitycreation";

export default function communityCreationApiRoute(app) {

    app.get(baseEndpoint + '/get', async function(req, res) {
        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/submit', async function(req, res) {
        const creator = req.body.creator;
        const creationName = req.body.creationName;
        const creationDescription = req.body.creationDescription;

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

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const creationId = req.body.creationId;

        // ...
        res.send({ success: true });
    });

}