const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/shoppingdistrictdirectory";
const db = require('../../controllers/databaseController');

// Jaedan: Shops likely need a get route to obtain items from a specific shop

export default function shoppingDistrictDirectoryApiRoute(app) {

    app.get(baseEndpoint + '/get', (req, res, next) => {
        try {
            db.query(`SELECT * FROM shops;`, function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const shopOwner = req.body.shopOwner;
        const shopName = req.body.shopName;
        const shopDescription = req.body.shopDescription;
        const serverId = req.body.serverId;

        try {
            db.query(`INSERT INTO shops (shopCreatorId, shopName, shopDescription, serverId) VALUES ((select userId from users where username=?), ?, ?, ?)`, [shopOwner, shopName, shopDescription, serverId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `${shopOwner}'s shop ${shopName} has been successfully created!`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/edit', (req, res, next) => {
        const shopId = req.body.shopId;
        const shopName = req.body.shopName;
        const shopDescription = req.body.shopDescription;
        const shopCreatorId = req.body.shopCreatorId;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/delete', (req, res, next) => {
        const shopId = req.body.shopId;

        try {
            db.query(`DELETE FROM shops WHERE shopId = ?;`, [shopId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `Deletion of Shop ${shopId} has been successful`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/:shopId/create/item', (req, res, next) => {
        const shopId = req.params.shopId;
        const shopItem = req.body.shopItem;
        const shopPrice = req.body.shopPrice;
        const shopBuyQuantity = req.body.shopBuyQuantity;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/:shopId/edit/item', (req, res, next) => {
        const shopId = req.params.shopId;
        const shopItemId = req.body.shopItemId;
        const shopItem = req.body.shopItem;
        const shopPrice = req.body.shopPrice;
        const shopBuyQuantity = req.body.shopBuyQuantity;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/:shopId/delete/item', (req, res, next) => {
        const shopId = req.params.shopId;
        const shopItemId = req.body.shopItemId;

        // ...
        res.json({ success: true });
    });

}
