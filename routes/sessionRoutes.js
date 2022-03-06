export default function sessionSiteRoute(app, fetch, moment, config) {

    // 
    // Session
    // 
    app.get('/login', async function(request, reply) {
        reply.view('session/login', {
            "pageTitle": `Login`,
            config: config,
            request: request
        });
    });

    app.get('/register', async function(request, reply) {
        reply.view('session/register', {
            "pageTitle": `Register`,
            config: config,
            request: request
        });
    });

    app.get('/logout', async function(request, reply) {
        if (request.session.authenticated) {
            request.destroySession((err) => {
              if (err) {
                  console.log(err);
                throw err;
              } else {
                res.redirect('/')
              }
            })
          } else {
            reply.redirect('/')
          }
    });

}