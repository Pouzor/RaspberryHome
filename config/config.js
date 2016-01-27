var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
    env = process.env.NODE_ENV || 'development';

var config = {
  development: {
    root: rootPath,
    app: {
      name: 'raspberryhome'
    },
    port: 3000,
    db: 'sqlite://localhost/raspberryhome-development',
    storage: rootPath + '/data/raspberryhome-development'
  },

  test: {
    root: rootPath,
    app: {
      name: 'raspberryhome'
    },
    port: 3000,
    db: 'sqlite://localhost/raspberryhome-test',
    storage: rootPath + '/data/raspberryhome-test'
  },

  production: {
    root: rootPath,
    app: {
      name: 'raspberryhome'
    },
    port: 3000,
    db: 'sqlite://localhost/raspberryhome-production',
    storage: rootPath + 'data/raspberryhome-production'
  }
};

module.exports = config[env];
