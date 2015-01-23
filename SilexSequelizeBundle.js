var exec = require('child_process').exec;

var Bundle = USE('Silex.Component.Kernel.Bundle');


var SilexSequelizeBundle = function() {
	Bundle.apply(this, arguments);
};
SilexSequelizeBundle.prototype = Object.create(Bundle.prototype);
SilexSequelizeBundle.prototype.constructor = SilexSequelizeBundle;

SilexSequelizeBundle.prototype.registerCommands = function(cmd) {
	var Console = USE('Silex.SequelizeBundle.Console.Console');
	var sequelize = this.container.get('silex.sequelize.service');
	var end = function() {
		if(sequelize.sequelize !== null) {
			sequelize.sequelize.close();
		}
	};
	var cons = new Console(cmd, sequelize, this.container, end);
	cons.registerCmd();
};


module.exports = SilexSequelizeBundle;
