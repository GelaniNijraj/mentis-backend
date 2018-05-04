import fs from 'fs';
import path from 'path';
import walk from 'fs-walk';
import mongoose from 'mongoose';
import validator from 'validator';
import jwt from 'jsonwebtoken';
import rimraf from 'rimraf';
import ncp from 'ncp';

import config from './../../config';
import User from './User';
import Issue from './Issue';

var Schema = mongoose.Schema;
var repoSchema = new Schema({
	name: String,
	owner: {type: Schema.Types.ObjectId, ref: 'User'},
	description: String,
	location: String,
	dir: String,
	createdOn: {type: Date, default: new Date()},
	public: Boolean,
	issuesEnabled: {type: Boolean, default: true},
	issues: [{type: Schema.Types.ObjectId, ref: 'Issue'}],
	issueLabels: [{type: Schema.Types.ObjectId, ref: 'IssueLabel'}],
	permissions: [{type: Schema.Types.ObjectId, ref: 'Permission'}],
	starredBy: [{type: Schema.Types.ObjectId, ref: 'User'}],
	contributors: [{type: Schema.Types.ObjectId, ref: 'User'}]
});

/*
 * Creates a repository on the server and saves it into the database.
 * repoDir: String - directory where the repo is to be initiated
 * callback: Function
 *  - err: Error
 */
repoSchema.methods.create = function(callback){
	let repoDir = path.join(config.storagedir, this.dir);
	Repo.findOne({
		owner: this.owner,
		name: this.name
	}, (err, repo) => {
		if(repo == null){
			fs.access(repoDir, fs.constants.W_OK, (err) => {
				if(err){
					fs.mkdir(repoDir, (err) => {
						if(err){
							callback(new Error('cannot create directory'));
						}else{
							var git = require('simple-git')(repoDir);
							git.init(true, () => {
								git.raw(['update-server-info']);
								walk.walk(repoDir, (baseDir, file, stat, next) => {
									fs.chmod(path.join(baseDir, file), '777', next);
								}, (err) => {
									if(err){
										callback(err);
									}else{
										fs.chmodSync(repoDir, '777');
										this.save((err) => {
											callback(false);
										});
									}
								});
							});
						}
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

repoSchema.methods.getFiles = function(root, callback){
	let git = require('simple-git')(path.join(config.storagedir, this.dir));
	root = root.startsWith('/') ? root.substr(1, root.length) : root;
	git.silent(true).raw(['ls-tree', '--full-tree', '--name-only', '-r', 'HEAD'], (err, out) => {
		if(!err){
			if(out != null){
				out = out.split('\n');
				let final = out
					.filter(x => x.startsWith(root))
					.map(x => {
						x = x.substr(root.length, x.length);
						if(x.startsWith('/'))
							x = x.substr(1, x.length);
						return x;
					})
					.map(x => {
						if(x.search('/') != -1){
							return {type: 'dir', name: x.substr(0, x.search('/'))};
						}else{
							return {type: 'file', name: x};
						}
					})
					.filter(x => x.name.trim() != '' && x.name != undefined);
				final = Array.from(new Set(final));
				callback(err, final);
			}else{
				callback(null, []);
			}
		}else{
			callback(err);
		}
	});
}

repoSchema.methods.getFileContent = function(branch, path, callback){
	console.log(config.storagedir, this.dir);
	let git = require('simple-git')([config.storagedir, this.dir].join('/'));
	console.log(path);
	if(path.startsWith('/'))
		path = path.substr(1, path.length - 1);
	git.raw(['show', [branch, ':', path].join('')], (err, out) => {
		if(!err){
			callback(err, out);
		}else{
			callback(new Error('cannot load content'));
		}
	});
}

repoSchema.methods.getCommitsCount = function(callback){
	let git = require('simple-git')(path.join(config.storagedir, this.dir));
	git.raw(['rev-list', '--all', '--count'], (err, out) => {
		out = parseInt(out);
		if(!err && !isNaN(out)){
			callback(err, out);
		}else{
			callback(new Error('couldn\'t get count'));
		}
	});
}

repoSchema.methods.getBranchCount = function(callback){
	let git = require('simple-git')(path.join(config.storagedir, this.dir));
	git.raw(['branch'], (err, out) => {
		if(out != null){
			out = out.split('\n').length - 1;
			if(out == -1)
				out = 0;
			if(!err){
				callback(err, out);
			}else{
				callback(new Error('couldn\'t get count'));
			}
		}else{
			callback(null, 0);
		}
	});
}

repoSchema.methods.clone = function(repo, cb){
	ncp.ncp(path.join(config.storagedir, this.dir), path.join(config.storagedir, repo.dir), (err) => {
		if(!err){
			let repoDir = path.join(config.storagedir, repo.dir);
			walk.walk(repoDir, (baseDir, file, stat, next) => {
				fs.chmod(path.join(baseDir, file), '777', next);
			}, (err) => {
				if(err){
					callback(err);
				}else{
					fs.chmodSync(repoDir, '777');
					repo.save((err, r) => {
						cb(null, r);
					});
				}
			});
		}else{
			cb(err);
		}
	});
}

repoSchema.methods.hasPermission = function(token, callback){
	jwt.verify(token, config.apisecret, (err, decoded) => {
		if(err && !this.public){
			callback(false);
		}else if(this.public || decoded.userId == this.owner){
			callback(true, decoded == undefined ? null : decoded.userId);
		}else{
			// TODO: check other permissions
			callback(false);
		}
	});
}

// callback(err)
repoSchema.methods.rename = function(newname, callback){
	let newdir = path.join(this.dir.split('/')[0], newname + '.git');
	let olddir = this.dir;
	let oldname = this.name;
	let newpath = path.join(config.storagedir, newdir);
	let oldpath = path.join(config.storagedir, olddir);
	this.dir = newdir;
	this.name = newname;
	this.save((err, raw) => {
		if(err){
			callback(err);
		}else{
			fs.rename(oldpath, newpath, (err) => {
				if(err){
					// revert
					this.dir = olddir;
					this.name = oldname;
					this.save((err) => callback(err));
				}else{
					callback(null);
				}
			});
		}
	})
}

// callback(err)
repoSchema.methods.delete = function(callback){
	rimraf(path.join(config.storagedir, this.dir), () => {
		User.findOne({
			_id: this.owner
		}, (err, user) => {
			if(err){
				callback(err);
			}else{
				// removing ref from user.repos
				user.repos.pull(this._id);
				user.save((err) => {
					if(err){
						callback(err);
					}else{
						// removing issues
						Issue.find({
							repo: this._id
						}).remove((err) => {
							if(err){
								callback(err);
							}else{
								this.remove((err) => {
									this.save();
									if(err)
										callback(err);
									else
										callback(null);
								});
							}
						})
					}
				});
			}
		})
	});
}

repoSchema.statics.findByName = function(username, reponame, callback){
	User.findOne({
		username: username
	}, (err, user) => {
		if(user != null){
			mongoose.model('Repo').findOne({
				owner: mongoose.Types.ObjectId(user._id),
				name: reponame
			}, (err, repo) => {
				if(repo != null){
					callback(null, repo);
				}else{
					callback(new Error('repo not found'));
				}
			});
		}else{
			callback(new Error('repo not found'));
		}
	});
}

repoSchema.statics.findExact = function(user, repo, populate){
	if(populate == undefined)
		return User
			.findOne({
				username: user
			})
			.populate({
				path: 'repos',
				match: {name: repo}
			});
	else
		return User
			.findOne({
				username: user
			})
			.populate({
				path: 'repos',
				match: {name: repo},
				populate: populate
			});

}

repoSchema.statics.existsCheck = function(user){
	return user != undefined && user.repos.length != 0;
}

var Repo = mongoose.model('Repo', repoSchema);

export default Repo;