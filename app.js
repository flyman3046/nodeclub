/*!
 * nodeclub - app.js
 */

/**
 * Module dependencies.
 */

require('newrelic');

var fs = require('fs');
var path = require('path');
var Loader = require('loader');
var express = require('express');
var session = require('express-session');
var errorHandler = require('errorhandler');
var ndir = require('ndir');
var config = require('./config').config;
var passport = require('passport');
require('./models');
var GitHubStrategy = require('passport-github').Strategy;
var githubStrategyMiddleware = require('./middlewares/github_strategy');
var routes = require('./routes');
var auth = require('./middlewares/auth');
var MongoStore = require('connect-mongo')(session);
var _ = require('lodash');
var csurf = require('csurf');
var compress = require('compression');

var maxAge = 3600000 * 24 * 30;
var staticDir = path.join(__dirname, 'public');

// assets
var assets = {};
if (config.mini_assets) {
  try {
    assets = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets.json')));
  } catch (e) {
    console.log('You must execute `make build` before start app when mini_assets is true.');
    throw e;
  }
}

// host: http://127.0.0.1
var urlinfo = require('url').parse(config.host);
config.hostname = urlinfo.hostname || config.host;

var app = express();

// configuration in all env
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs-locals'));
app.locals._layoutFile = './layout.html';

app.use(require('response-time')());
app.use(require('body-parser')({uploadDir: config.upload_dir}));
app.use(require('method-override')());
app.use(require('cookie-parser')(config.session_secret));
app.use(session({
  secret: config.session_secret,
  key: 'sid',
  store: new MongoStore({
    db: config.db_name
  })
}));
app.use(compress());

app.use(passport.initialize());

// custom middleware
app.use(require('./controllers/sign').auth_user);
app.use(auth.blockUser());

app.use(Loader.less(__dirname));
app.use('/public', express.static(staticDir));
app.use(errorHandler({ dumpExceptions: true, showStack: true }));
if (!config.debug) {
  app.use(csurf());
  app.set('view cache', true);
}

// set static, dynamic helpers
_.extend(app.locals, {
  config: config,
  Loader: Loader,
  assets: assets
});

_.extend(app.locals, require('./common/render_helpers'));
app.use(function (req, res, next) {
  res.locals.csrf = req.csrfToken ? req.csrfToken() : '';
  next();
});

// github oauth
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (user, done) {
  done(null, user);
});
passport.use(new GitHubStrategy(config.GITHUB_OAUTH, githubStrategyMiddleware));

// routes
routes(app);

app.listen(config.port, function () {
  console.log("NodeClub listening on port %d in %s mode", config.port, app.settings.env);
  console.log("God bless love....");
  console.log("You can debug your app with http://" + config.hostname + ':' + config.port);
});


module.exports = app;
