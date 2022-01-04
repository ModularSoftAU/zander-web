import config from '../../config.json'

export default function dashbordSiteRoute(fastify) {
    // fastify.use(cors({ origin: true }));

    // 
    // Dashboard
    // 
    fastify.get('/dashboard', async function(request, reply) {
        reply.render('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    fastify.get('/dashboard/view/network', (req, res, next) => {
        res.render('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    fastify.get('/dashboard/view/punishment', (req, res, next) => {
        res.render('dashboard/indexViewPunishment', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    // 
    // Misc
    // 

    // 
    // Player Check
    // 
    fastify.get('/dashboard/usercheck', (req, res, next) => {
        res.render('dashboard/usercheck', {
            "pageTitle": `Dashboard - User Check`,
            config: config
        });
    });

}