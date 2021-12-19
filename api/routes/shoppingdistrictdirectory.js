const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/shoppingdistrictdirectory";


// Jaedan: Shops likely need a get route to obtain items from a specific shop


router.get(baseEndpoint + '/get', (req, res, next) => {
    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/create', (req, res, next) => {
    const shopName = req.body.shopName;
    const shopDescription = req.body.shopDescription;
    const shopCreatorId = req.body.shopCreatorId;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/edit', (req, res, next) => {
    const shopId = req.body.shopId;
    const shopName = req.body.shopName;
    const shopDescription = req.body.shopDescription;
    const shopCreatorId = req.body.shopCreatorId;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const shopId = req.body.shopId;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/:shopId/create/item', (req, res, next) => {
    const shopId = req.params.shopId;
    const shopItem = req.body.shopItem;
    const shopPrice = req.body.shopPrice;
    const shopBuyQuantity = req.body.shopBuyQuantity;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/:shopId/edit/item', (req, res, next) => {
    const shopId = req.params.shopId;
    const shopItemId = req.body.shopItemId;
    const shopItem = req.body.shopItem;
    const shopPrice = req.body.shopPrice;
    const shopBuyQuantity = req.body.shopBuyQuantity;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/:shopId/delete/item', (req, res, next) => {
    const shopId = req.params.shopId;
    const shopItemId = req.body.shopItemId;

    // ...
    res.json({ success: true });
});

module.exports = router