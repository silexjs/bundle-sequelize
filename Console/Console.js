var pa = require('path');
var fs = require('fs');
var inflection = require('inflection');

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
			.command('sequelize:db:toModels [dir]')
			.description('Create the models files from the database')
			.option('-f, --force', 'Allows you to force the creation of template files if the folder is not empty')
			.option('-i, --indentation <value>', 'Allows you to choose the type of indentation (t=TABULATION and s=SPACE. Default: t)')
			.action(function() {
				self.commandDbToModels.apply(self, arguments);
			});
		this.cmd
			.command('sequelize:db:migrate [dir]')
			.description('Runs migration files')
			.action(function(dir, options) {
				self.commandDbMigrate.call(self, dir, options, 'up');
			});
		this.cmd
			.command('sequelize:db:migrate:undo [dir]')
			.description('Revert the last migration run')
			.action(function() {
				self.commandDbMigrate.call(self, dir, options, 'down');
			});
	},
	
	lanchSequelize: function(cb) {
		var self = this;
		this.sequelizeService.onKernelReady(function() {
			self.sequelize = self.sequelizeService.sequelize;
			cb();
		});
	},
	
	commandDbToModels: function(dir, options) {
		var self = this;
		var space = (options.indentation || 't').replace(/t/ig, '\t').replace(/s/ig, ' ');
		var lineBreak = options.lineBreak || "\n";
		var freezeTableName = (options.freezeTableName===undefined?true:options.freezeTableName);
		var pluralize = this.sequelize.Utils.pluralize;
		if(dir === undefined) {
			var dirModels = self.container.get('kernel').rootDir+'/app/models';
		} else {
			var dirModels = pa.resolve(dir);
		}
		if(fs.existsSync(dirModels) === false) {
			fs.mkdirSync(dirModels);
		} else if(fs.readdirSync(dirModels).length > 0 && options.force === undefined) {
			console.log('The dir contains templates, use the "--force" parameter to perform the operation.');
			console.log('(dir: '+dirModels+')');
			self.end();
			return;
		}
		this.lanchSequelize(function() {
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
						var type = 'DataTypes.';
						if(field.type.match(/^(smallint|mediumint|tinyint|int)$/i) !== null) {
							type += 'INTEGER';
						} else if(field.type.match(/^(string|varchar|varying)$/i) !== null) {
							type += 'STRING';
						} else if(field.type.match(/^(date)$/i) !== null) {
							type += 'DATEONLY';
						} else if(field.type.match(/^(datetime)$/i) !== null) {
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
						model += space+space+self.fieldToCamelcase(fieldName)+": {"+lineBreak;
						model += space+space+space+"field: '"+fieldName+"',"+lineBreak;
						model += space+space+space+"type: "+type+","+lineBreak;
						model += space+space+space+"primaryKey: "+field.primary+","+lineBreak;
						model += space+space+space+"allowNull: "+field.null+","+lineBreak;
						model += space+space+space+"defaultValue: "+field.default+","+lineBreak;
						model += space+space+space+"autoIncrement: "+field.autoIncrement+","+lineBreak;
						if(field.comment !== '') {
							model += space+space+space+"/* Comment:"+lineBreak;
							model += space+space+space+space+field.comment.replace(/\n/g, lineBreak+space+space+space+space)+lineBreak;
							model += space+space+space+"*/"+lineBreak;
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
	
	commandDbMigrate: function(dir, options, method) {
		var self = this;
		if(dir === undefined) {
			dir = this.container.get('kernel').rootDir+'/app/migrations';
		} else {
			var dir = pa.resolve(dir);
		}
		if(fs.existsSync(dir) === false) {
			fs.mkdirSync(dir);
		}
		this.lanchSequelize(function() {
			console.log('Run migration... (dir: '+dir+')');
			self.sequelize.getMigrator({
				path: dir,
			}).migrate({ method: method }).success(function() {
				console.log('The migration is finished');
				self.end();
			});
		});
	},
};


module.exports = Console;
