var pa = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var Umzug = require('umzug');

var Analyzer = USE('Silex.SequelizeBundle.Analyzer.Analyzer');


var Console = function(cmd, sequelize, container, end) {
	this.cmd = cmd;
	this.sequelizeService = sequelize;
	this.container = container;
	this.end = end || function(){};
};
Console.prototype = {
	cmd: null,
	sequelizeService: null,
	sequelize: null,
	container: null,
	end: null,
	
	registerCmd: function() {
		var self = this;
		this.cmd
			.command('sequelize:generate:models [dir]')
			.description('Create the models files from the database')
			.option('-f, --force', 'Allows you to force the creation of template files if the folder is not empty')
			.option('-i, --indentation <value>', 'Allows you to choose the type of indentation (t=TABULATION and s=SPACE. Default: t)')
			.action(function() {
				self.commandGenerateModels.apply(self, arguments);
			});
		this.cmd
			.command('sequelize:migrate:status [dir]')
			.description('Show list of migrations')
			.action(function(dir) {
				self.commandMigrateStatus.call(self, dir);
			});
		this.cmd
			.command('sequelize:migrate:up [dir]')
			.description('Runs migration files')
			.action(function(dir) {
				self.commandMigrateUpDown.call(self, dir, 'up');
			});
		this.cmd
			.command('sequelize:migrate:undo [dir]')
			.description('Revert the last migration run')
			.action(function(dir) {
				self.commandMigrateUpDown.call(self, dir, 'down');
			});
	},
	
	lanchSequelize: function(callback) {
		var self = this;
		console.log('Lanch Sequelize...');
		this.sequelizeService.onKernelReady(function() {
			self.sequelize = self.sequelizeService.sequelize;
			callback(self.sequelize);
		});
	},
	
	commandGenerateModels: function(dir, options) {
		var self = this;
		var space = (options.indentation || 't').replace(/t/ig, '\t').replace(/s/ig, ' ');
		var lineBreak = options.lineBreak || "\n";
		var freezeTableName = (options.freezeTableName===undefined?true:options.freezeTableName);
		if(dir === undefined) {
			var dirModels = self.container.get('kernel').dir.app+'/orm/models';
		} else {
			var dirModels = pa.resolve(dir);
		}
		if(fs.existsSync(dirModels) === false) {
			mkdirp.sync(dirModels);
		} else if(fs.readdirSync(dirModels).length > 0 && options.force === undefined) {
			console.log('The dir contains templates, use the "--force" parameter to perform the operation.');
			console.log('(dir: '+dirModels+')');
			self.end();
			return;
		}
		this.lanchSequelize(function() {
			var pluralize = self.sequelize.Utils.pluralize;
			console.log('Analyzing of the database...');
			var analyzer = new Analyzer(self.sequelize);
			analyzer.getInfo(function(tables) {
				console.log('Creating files...');
				var tablesList = Object.keys(tables);
				for(var tableName in tables) {
					var table = tables[tableName];
					var fieldsList = Object.keys(table.fields);
					var model = '';
					
					model += "module.exports = function(sequelize, DataTypes) {"+lineBreak;
					model += space+"return sequelize.define('"+self.tableToCamelcase(tableName)+"', {"+lineBreak;
					
					for(var fieldName in table.fields) {
						var field = table.fields[fieldName];
						var fieldNameCamelcase = self.fieldToCamelcase(fieldName);
						var defaultType = null;
						var type = 'DataTypes.';
						if(field.type.match(/^(smallint|mediumint|tinyint|int)$/i) !== null) {
							defaultType = 0;
							type += 'INTEGER';
						} else if(field.type.match(/^(decimal|numeric)$/i) !== null) {
							defaultType = 0.0;
							type += 'DECIMAL';
						} else if(field.type.match(/^(string|varchar|varying)$/i) !== null) {
							defaultType = '';
							type += 'STRING';
						} else if(field.type.match(/^(date)$/i) !== null) {
							defaultType = '00-00-00';
							type += 'DATEONLY';
						} else if(field.type.match(/^(datetime)$/i) !== null) {
							defaultType = '00-00-00 00:00:00';
							type += 'DATE';
						} else {
							type += field.type.toUpperCase();
						}
						if(field.typeValue[0] !== undefined && field.type.match(/^(date|time)/i) === null) {
							type += '('+field.typeValue[0];
							if(field.typeValue[1] !== undefined) {
								type += ', '+field.typeValue[1];
							}
							type += ')';
						}
						if(field.unsigned === true && field.type.match(/^(smallint|mediumint|tinyint|int|bigint)/) !== null) {
							type += '.UNSIGNED';
						}
						model += space+space+fieldNameCamelcase+": {"+lineBreak;
						model += space+space+space+"field: '"+fieldName+"',"+lineBreak;
						model += space+space+space+"type: "+type+","+lineBreak;
						model += space+space+space+"primaryKey: "+field.primary+","+lineBreak;
						if(fieldName !== 'created_at'
						&& fieldName !== 'updated_at'
						&& fieldName !== 'deleted_at') {
							model += space+space+space+"allowNull: "+field.null+","+lineBreak;
							if(field.autoIncrement === false) {
								if(field.null === false && field.default === null && defaultType !== null) {
									model += space+space+space+"defaultValue: "+JSON.stringify(defaultType)+","+lineBreak;
								} else if((field.null === false && field.default !== null) || field.null === true) {
									var _default = field.default;
									if(_default !== null) {
										if(field.type.match(/^(smallint|mediumint|tinyint|int)$/i) !== null) {
											_default = parseInt(_default);
										} else if(field.type.match(/^(decimal|numeric)$/i) !== null) {
											_default = parseFloat(_default);
										}
									}
									model += space+space+space+"defaultValue: "+JSON.stringify(_default)+","+lineBreak;
								}
							}
						}
						model += space+space+space+"autoIncrement: "+field.autoIncrement+","+lineBreak;
						if(field.comment !== '') {
							model += space+space+space+"/**"+lineBreak;
							model += space+space+space+" * Comment:"+lineBreak;
							model += space+space+space+" * "+field.comment.replace(/\n/g, lineBreak+space+space+space+" * ")+lineBreak;
							model += space+space+space+" */"+lineBreak;
						}
						model += space+space+"},"+lineBreak;
					}
					
					model += space+"}, {"+lineBreak;
					model += space+space+"name: { singular: '"+self.fieldToCamelcase(tableName)+"', plural: '"+pluralize(self.fieldToCamelcase(tableName))+"' },"+lineBreak;
					model += space+space+"tableName: '"+tableName+"',"+lineBreak;
					model += space+space+"freezeTableName: "+freezeTableName+","+lineBreak;
					
					if(fieldsList.indexOf('created_at') === -1) {
						model += space+space+"createdAt: false,"+lineBreak;
					}
					if(fieldsList.indexOf('updated_at') === -1) {
						model += space+space+"updatedAt: false,"+lineBreak;
					}
					if(fieldsList.indexOf('deleted_at') >= 0) {
						model += space+space+"deletedAt: '"+self.fieldToCamelcase('deleted_at')+"',"+lineBreak;
					}
					
					model += space+space+"classMethods: {"+lineBreak;
					model += space+space+space+"associate: function(models) {"+lineBreak;
					
					for(var i in table.associations.hasOne) {
						var as = table.associations.hasOne[i];
						model += space+space+space+space+"models."+self.tableToCamelcase(tableName)+".hasOne(models."+self.tableToCamelcase(as.foreignTable)+", { foreignKey: '"+self.fieldToCamelcase(as.foreignKey)+"' });"+lineBreak;
					}
					for(var i in table.associations.hasMany) {
						var as = table.associations.hasMany[i];
						model += space+space+space+space+"models."+self.tableToCamelcase(tableName)+".hasMany(models."+self.tableToCamelcase(as.foreignTable)+", { foreignKey: '"+self.fieldToCamelcase(as.foreignKey)+"' });"+lineBreak;
					}
					for(var i in table.associations.belongsTo) {
						var as = table.associations.belongsTo[i];
						model += space+space+space+space+"models."+self.tableToCamelcase(tableName)+".belongsTo(models."+self.tableToCamelcase(as.foreignTable)+", { foreignKey: '"+self.fieldToCamelcase(as.foreignKey)+"' });"+lineBreak;
					}
					for(var i in table.associations.belongsToMany) {
						var as = table.associations.belongsToMany[i];
						model += space+space+space+space+"models."+self.tableToCamelcase(tableName)+".belongsToMany(models."+self.tableToCamelcase(as.foreignTable)+", {"+lineBreak;
						model += space+space+space+space+space+"through: '"+self.tableToCamelcase(as.through)+"',"+lineBreak;
						model += space+space+space+space+space+"foreignKey: '"+self.fieldToCamelcase(as.foreignKey)+"',"+lineBreak;
						model += space+space+space+space+space+"otherKey: '"+self.fieldToCamelcase(as.otherKey)+"',"+lineBreak;
						model += space+space+space+space+"});"+lineBreak;
					}
					
					model += space+space+space+"},"+lineBreak;
					model += space+space+"},"+lineBreak;
					model += space+"});"+lineBreak;
					model += "};"+lineBreak;
					
					
					fs.writeFileSync(dirModels+'/'+self.tableToCamelcase(tableName)+'.js', model);
				}
				console.log(tablesList.length+' models created! (in '+dirModels+')');
				self.end();
			});
		});
	},
	fieldToCamelcase: function(fieldName) {
		return fieldName.toLowerCase().replace(/_([a-z])/g, function(match, content, offset, string) {
			return content.toUpperCase();
		});
	},
	tableToCamelcase: function(tableName) {
		tableName = this.fieldToCamelcase(tableName);
		return tableName[0].toUpperCase()+tableName.substr(1);
	},
	
	
	lanchSequelizeUmzug: function(dir, callback) {
		this.lanchSequelize(function(sequelize) {
			var umzug = new Umzug({
				storage: 'sequelize',
				storageOptions: {
					sequelize: sequelize,
				},
				migrations: {
					params: [sequelize.getQueryInterface(), sequelize.constructor],
					path: dir,
				},
				logging: console.log,
			});
			callback(umzug);
		});
	},
	commandMigrateStatus: function(dir) {
		var self = this;
		if(dir === undefined) {
			dir = this.container.get('kernel').dir.app+'/orm/migrations';
		} else {
			var dir = pa.resolve(dir);
		}
		if(fs.existsSync(dir) === false) {
			mkdirp.sync(dir);
		}
		this.lanchSequelizeUmzug(dir, function(umzug) {
			console.log('Load migration... (dir: '+dir+')');
			umzug.executed().then(function(migrations) {
				console.log('-------------------------------------------------------------------------------');
				console.log('List already run migration: ('+migrations.length+')');
				if(migrations.length-1 >= 0) {
					for(var i in migrations) {
						console.log(' - '+migrations[i].file);
					}
				} else {
					console.log(' - No migration');
				}
				console.log('-------------------------------------------------------------------------------');
				return umzug.pending().then(function(migrations) {
					console.log('List of not yet run migration: ('+migrations.length+')');
					if(migrations.length-1 >= 0) {
						for(var i in migrations) {
							console.log(' - '+migrations[i].file);
						}
					} else {
						console.log(' - No migration');
					}
					console.log('-------------------------------------------------------------------------------');
					self.end();
				});
			});
		});
	},
	commandMigrateUpDown: function(dir, method) {
		var self = this;
		if(dir === undefined) {
			dir = this.container.get('kernel').dir.app+'/orm/migrations';
		} else {
			var dir = pa.resolve(dir);
		}
		if(fs.existsSync(dir) === false) {
			mkdirp.sync(dir);
		}
		this.lanchSequelizeUmzug(dir, function(umzug) {
			umzug[(method==='up'?'pending':'executed')]().then(function(migrations) {
				if(method === 'up') {
					console.log('List of migration files to be executed: ('+migrations.length+')');
					if(migrations.length-1 >= 0) {
						for(var i in migrations) {
							console.log(' - '+migrations[i].file);
						} 
					} else {
						console.log(' - No migration');
					}
				} else {
					console.log('Migration file to cancel ('+migrations.length+'):');
					if(migrations.length-1 >= 0) {
						console.log(' - '+migrations[migrations.length-1].file);
					} else {
						console.log(' - No migration');
					}
				}
				console.log('Run migration');
				console.log('-------------------------------------------------------------------------------');
				return umzug[method]().then(function() {
					console.log('-------------------------------------------------------------------------------');
					console.log('The migration is finished');
					self.end();
				});
			});
		});
	},
};


module.exports = Console;
