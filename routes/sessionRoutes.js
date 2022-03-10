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

    app.post('/login', async function(req, res) {
      const username = req.body.username;
      const email = req.body.email;
      const password = req.body.password;

      db.query(`select * from users where username=?`, [username], async function (err, results) {
          if (err) {
              throw err;
          }

          // User has not logged in before.
          if (!results.length) {
              return res.send({
                  success: false,
                  message: `You have not logged in before. You are required to register before becoming a community site member. You can jump on and play here: ${config.siteConfiguration.siteAddress}/play`
              });
          }

          // Check if passwords match
          const salt = await bcrypt.genSalt();
          let hashedPassword = results[0].password;

          bcrypt.compare(password, hashedPassword, function(err, result) {
              if (err) {
                  throw err;
              }

              if (result) {
                  req.session.authenticated = true

                  let userData = results[0];
                  req.session.user = {
                      userId: userData.userId,
                      username: userData.username,
                      uuid: userData.uuid,
                  };

                  return res.redirect(`${config.siteConfiguration.siteAddress}/`)
              }
          });
      });
  });

  app.get('/logout', async function(req, res) {
      if (req.session.authenticated) {
          req.destroySession((err) => {
            if (err) {
                console.log(err);
              throw err;
            } else {
              req.session.authenticated = false
              res.redirect('/')
            }
          })
        } else {
          req.session.authenticated = false
          req.redirect('/')
        }
  });

}