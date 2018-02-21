import fs from 'fs';
import mongoose from 'mongoose';
import validator from 'validator';

import User from './User';

var Schema = mongoose.Schema;
var repoSchema = new Schema({
	name: String,
	owner: {type: Schema.Types.ObjectId, ref: 'User'},
	description: String,
	location: String,
	public: Boolean
});

/*
 * Creates a repository on the server and saves it into the database.
 * repoDir: String - directory where the repo is to be initiated
 * callback: Function
 *  - err: Error
 */
repoSchema.methods.create = function(repoDir, callback){
	Repo.findOne({
		owner: this.owner,
		name: this.name
	}, (err, repo) => {
		if(repo == null){
			fs.access(repoDir, fs.constants.W_OK, (err) => {
				if(err){
					fs.mkdir(repoDir, (err) => {
						if(err) callback(err);
						var git = require('simple-git')(repoDir);
						git.init(true);
						git.raw(['update-server-info']);
						this.save();
						callback(false);
					});
				}else{
					// directory alredy exists
					callback(new Error('repository with same name already exists'));
				}
			});
		}else{
			// repo already exists
			callback(new Error('repository with same name already exists'));
		}
	});
}

// callback(err)
repoSchema.methods.rename = function(newname, callback){
	repo.name = newname;
	repo.save();
}

// callback(err)
repoSchema.methods.delete = function(callback){

}

var Repo = mongoose.model('Repo', repoSchema);

export default Repo;