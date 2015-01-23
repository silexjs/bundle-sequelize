var Analyzer = function(sequelize) {
	this.sequelize = sequelize;
	this.dbName = sequelize.config.database;
};
Analyzer.prototype = {
	sequelize: null,
	dbName: null,
	
	getInfo: function(cb) {
		var self = this;
		var db = {};
		this.getTables(function(tables) {
			var tablesLength = tables.length;
			for(var i=0; i<tablesLength; i++) {
				var table = tables[i];
				db[table] = {
					fields: {},
					associations: null,
				};
				(function(self, cb, db, table, i, tablesLength) {
					self.getFields(tables[i], function(fields) {
						var fieldsLength = fields.length;
						for(var j=0; j<fieldsLength; j++) {
							var field = fields[j];
							var f = db[table].fields[field.Field] = {};
							
							var typeInfo = field.Type.toLowerCase().match(/^([a-z]+)(\(([0-9]+)(,([0-9]+))?\))?(\s+(unsigned))?/i);
							f.type = typeInfo[1];
							f.typeValue = [];
							if(typeInfo[3] !== undefined) {
								f.typeValue.push(typeInfo[3]);
								if(typeInfo[5] !== undefined) {
									f.typeValue.push(typeInfo[5]);
								}
							}
							f.unsigned = (typeInfo[7] !== undefined);
							f.primary = (field.Key.toLowerCase() === 'pri');
							f.autoIncrement = (field.Extra.toLowerCase().match(/auto_increment/) !== null);
							f.null = (field.Null.toLowerCase() === 'yes');
							f.default = field.Default;
							f.comment = field.Comment;
						}
						if(i >= tablesLength-1) {
							self.setAssociations(db, function() {
								cb(db);
							});
						}
					});
				})(self, cb, db, table, i, tablesLength);
			}
		});
	},
	
	getTables: function(cb) {
		this.sequelize.query('SHOW TABLES').then(function(result) {
			cb(result);
		});
	},
	getFields: function(table, cb) {
		this.sequelize.query('SHOW FULL COLUMNS FROM '+table).then(function(result) {
			cb(result);
		});
	},
	setAssociations: function(db, cb) {
		var self = this;
		var tables = Object.keys(db);
		var tablesLength = tables.length;
		var tablesNow = 0;
		tables.forEach(function(tableName) {
			var ts = db[tableName].associations = {
				hasOne: [],
				hasMany: [],
				belongsToMany: [],
			};
			var query  = 'SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME ';
				query += 'FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE ';
				query += 'WHERE CONSTRAINT_CATALOG = \'def\' ';
				query += 'AND REFERENCED_TABLE_SCHEMA = \''+self.dbName+'\' ';
				query += 'AND REFERENCED_TABLE_NAME = \''+tableName+'\' ';
			self.sequelize.query(query).then(function(associations) {
				tablesNow++;
				if(tableName.match(/^(.*)(_has_)(.*)$/i) !== null) {
					return;
				}
				for(var i in associations) {
					var as = associations[i];
					var asInfo = as.TABLE_NAME.match(/^(.*)(_has_)(.*)$/i);
					if(asInfo !== null && (asInfo[1] === as.REFERENCED_TABLE_NAME || asInfo[3] === as.REFERENCED_TABLE_NAME)) {
						if(asInfo[1] === as.REFERENCED_TABLE_NAME) {
							var foreignTable = asInfo[3];
							var otherKey = asInfo[1]+'_id';
						} else {
							var foreignTable = asInfo[1];
							var otherKey = asInfo[3]+'_id';
						}
						ts.belongsToMany.push({
							foreignTable: foreignTable,
							through: as.TABLE_NAME,
							foreignKey: foreignTable+'_id',
							otherKey: otherKey,
						});
					} else {
						if(db[as.TABLE_NAME].fields.id === undefined
						&& db[as.TABLE_NAME].fields[tableName+'_id'] !== undefined
						&& db[as.TABLE_NAME].fields[tableName+'_id'].primary === true) {
							ts.hasOne.push({
								foreignTable: as.TABLE_NAME,
								foreignKey: as.COLUMN_NAME,
							});
						} else {
							ts.hasMany.push({
								foreignTable: as.TABLE_NAME,
								foreignKey: as.COLUMN_NAME,
							});
						}
						db[as.TABLE_NAME].associations.hasOne.push({
							foreignTable: as.REFERENCED_TABLE_NAME,
							foreignKey: as.REFERENCED_COLUMN_NAME,
						});
					}
				}
				if(tablesNow >= tablesLength) {
					cb(db);
				}
			});
		});
	},
};


module.exports = Analyzer;
