var Sequelize = require('sequelize');


var SequelizeService = function(container) {
	this.container = container;
};
SequelizeService.prototype = {
	container: null,
	sequelize: null,
	
	onKernelReady: function(next) {
		var dispatcher = this.container.get('kernel.dispatcher');
		var config = this.container.get('kernel.config').get('sequelize');
		config.debug = this.container.get('kernel').debug;
		this.connection(config, function() {
			dispatcher.dispatch('sequelize.connected', function() {
				next();
			});
		});
	},
	
	connection: function(config, callback) {
		this.sequelize = new Sequelize(config.dbname, config.user, config.password, {
			dialect:	config.dialect || 'mysql',
			host:		config.host || 'localhost',
			port:		config.port || '3306',
			charset:	config.charset || 'utf8',
			logging:	(config.debug===true)?function(text){ console.log('SEQUELIZE: '+text); }:function(){},
		});
		var debug = this.container.get('kernel').debug;
		this.sequelize
			.authenticate()
			.complete(function(err) {
				if(err === null) {
					if(debug === true) {
						console.log('SEQUELIZE: Database connection successful ('+config.host+':'+config.port+')');
					}
					callback();
				} else {
					if(debug === true) {
						err += '\nConfiguration:\n'+JSON.stringify(config, null, '\t');
					}
					throw new Error(err);
				}
			});
	},
};


module.exports = SequelizeService;
