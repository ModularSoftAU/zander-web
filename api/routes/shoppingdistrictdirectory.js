import {isFeatureEnabled, required, optional} from '../common'

// Jaedan: Shops likely need a get route to obtain items from a specific shop
export default function shoppingDistrictDirectoryApiRoute(app, config, db, features) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/shop';

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.shops, res, lang);

        try {
            db.query(`SELECT * FROM shops;`, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.shops, res, lang);
        const shopOwner = required(req.body, "shopOwner", res);
        const shopName = required(req.body, "shopName", res);
        const shopDescription = required(req.body, "shopDescription", res);
        const serverId = required(req.body, "serverId", res);

        try {
            db.query(`INSERT INTO shops (shopCreatorId, shopName, shopDescription, serverId) VALUES ((select userId from users where username=?), ?, ?, ?)`, [shopOwner, shopName, shopDescription, serverId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `${shopOwner}'s shop ${shopName} has been successfully created!`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        isFeatureEnabled(features.shops, res, lang);
        const shopId = required(req.body, "shopId", res);
        const shopOwner = required(req.body, "shopOwner", res);
        const shopName = required(req.body, "shopName", res);
        const shopDescription = required(req.body, "shopDescription", res);
        const serverId = required(req.body, "serverId", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.shops, res, lang);
        const shopId = required(req.body, "shopId", res);

        try {
            db.query(`DELETE FROM shops WHERE shopId = ?;`, [shopId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `Deletion of Shop ${shopId} has been successful`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/items/create', async function(req, res) {
        isFeatureEnabled(features.shops, res, lang);
        const shopId = required(req.body, "shopId");
        const shopItem = required(req.body, "shopItem", res);
        const shopPrice = required(req.body, "shopPrice", res);
        const shopBuyQuantity = required(req.body, "shopBuyQuantity", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/items/edit', async function(req, res) {
        isFeatureEnabled(features.shops, res, lang);
        const shopId = required(req.body, "shopId")
        const shopItemId = required(req.body, "shopItemId", res);
        const shopItem = required(req.body, "shopItem", res);
        const shopPrice = required(req.body, "shopPrice", res);
        const shopBuyQuantity = required(req.body, "shopBuyQuantity", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/items/delete', async function(req, res) {
        isFeatureEnabled(features.shops, res, lang);
        const shopId = required(req.body, "shopId")
        const shopItemId = required(req.body, "shopItemId", res);

        // ...
        res.send({ success: true });
    });

}