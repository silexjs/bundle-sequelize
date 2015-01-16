var SilexSequelizeBundle = function() {};
SilexSequelizeBundle.prototype = {
	registerCommands: function(cmd) {
		cmd.registerRaw('sequelize', function(argv, query, result) {
			console.log(argv);
			console.log(query);
			console.log(result);
		});
	},
};


module.exports = SilexSequelizeBundle;
