export default function verifyToken(req, res, done) {
    // console.log('Verifying that API request includes valid token...');

    // Below is the implementation. Currently disabled.
    done();
    return;

    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (!token) {
        // Token not included
        return res.status(403).send({ 'error': true });
    }
  
    if (token === config.siteConfiguration.apiKey) {
        // Passed
        done();
    } else {
        // Token was incorrect.
        return res.status(403).send({ 'error': true });
    }
}