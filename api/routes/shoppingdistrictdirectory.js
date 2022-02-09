// Jaedan: Shops likely need a get route to obtain items from a specific shop

export default function shoppingDistrictDirectoryApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/shop';

    app.get(baseEndpoint + '/get', async function(req, res) {
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
        const shopOwner = req.body.shopOwner;
        const shopName = req.body.shopName;
        const shopDescription = req.body.shopDescription;
        const serverId = req.body.serverId;

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
        const shopId = req.body.shopId;
        const shopOwner = req.body.shopOwner;
        const shopName = req.body.shopName;
        const shopDescription = req.body.shopDescription;
        const serverId = req.body.serverId;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const shopId = req.body.shopId;

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

    app.post(baseEndpoint + '/:shopId/create/item', async function(req, res) {
        const shopId = req.params.shopId;
        const shopItem = req.body.shopItem;
        const shopPrice = req.body.shopPrice;
        const shopBuyQuantity = req.body.shopBuyQuantity;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/:shopId/edit/item', async function(req, res) {
        const shopId = req.params.shopId;
        const shopItemId = req.body.shopItemId;
        const shopItem = req.body.shopItem;
        const shopPrice = req.body.shopPrice;
        const shopBuyQuantity = req.body.shopBuyQuantity;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/:shopId/delete/item', async function(req, res) {
        const shopId = req.params.shopId;
        const shopItemId = req.body.shopItemId;

        // ...
        res.send({ success: true });
    });

}