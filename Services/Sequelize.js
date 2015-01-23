var Sequelize = require('sequelize');
var glob = require('glob');
var fs = require('fs');


var SequelizeService = function(kernel, container, dispatcher, config, log) {
	this.kernel = kernel;
	this.container = container;
	this.dispatcher = dispatcher;
	this.config = config;
	this.log = log;
	this.debug = this.kernel.debug;
};
SequelizeService.prototype = {
	kernel: null,
	container: null,
	dispatcher: null,
	config: null,
	log: null,
	debug: false,
	sequelize: null,
	
	console: function(m) {
		if(this.debug === true) {
			this.log.debug('Sequelize', m);
		}
	},
	
	onKernelReady: function(next) {
		var self = this;
		var config = this.config.get('sequelize');
		
		this.create(config);
		this.container.set('sequelize', this.sequelize);
		this.container.set('orm', this.sequelize);
		this.container.set('models', this.sequelize.models);
		this.loadModels();
		this.dispatcher.dispatch('sequelize.load_models', function() {
			self.connection(config, function() {
				self.dispatcher.dispatch('sequelize.connected', function() {
					next();
				});
			});
		});
	},
	
	create: function(config) {
		var self = this;
		var logging = false;
		if(this.debug) {
			logging = function(m) {
				if(m.substr(0, 10) === 'Executing ' && config.showQuery === false) { return; }
				self.console(m);
			};
		}
		this.sequelize = new Sequelize(config.dbname, config.user, config.password, {
			dialect: config.dialect || 'mysql',
			host: config.host || 'localhost',
			port: config.port || '3306',
			charset: config.charset || 'utf8',
			logging: logging,
		});
	},
	
	connection: function(config, callback) {
		var self = this;
		this.sequelize
			.authenticate()
			.complete(function(err) {
				if(err === null) {
					if(self.debug === true) {
						self.console('Database connection successful ('+config.host+':'+config.port+')');
					}
					callback();
				} else {
					if(self.debug === true) {
						err += '\nConfiguration:\n'+JSON.stringify(config, null, '\t');
					}
					throw new Error(err);
				}
			});
	},
	
	loadModels: function() {
		var dir = this.kernel.rootDir+'/app/models';
		if(fs.existsSync(dir) === true) {
			var modelsFile = glob.sync(dir+'/*.js');
			var modelsFileLength = modelsFile.length;
			for(var i=0; i<modelsFileLength; i++) {
				this.sequelize.import(modelsFile[i]);
			}
			for(var modelName in this.sequelize.models) {
				if(this.sequelize.models[modelName].associate !== undefined) {
					this.sequelize.models[modelName].associate(this.sequelize.models);
				}
			}
		}
	},
};


module.exports = SequelizeService;
