import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

import User from '../models/User';
import Repo from '../models/Repo';
import VerifyToken from '../middlewares/VerifyToken';

var repoRoutes = require('express').Router();

repoRoutes.post('/create', VerifyToken, (req, res) => {
	if(req.body.name == undefined || req.body.public == undefined){
		res.status(422).json({success: false, message: 'missing required parameters'});
	}else{
		var userId = req.decoded.userId;
		User.findOne({
			_id: userId
		}, (err, user) => {
			if(err) res.json({success: false}); // shouldn't happen
			// gathering variables
			var repoName = req.body.name;
			var repoFolder = repoName + '.git';
			var repoDir = path.join(user.username, repoFolder);
			var repoURL = req.app.get('httproot') + 'git/' + user.username + '/' + repoFolder;

			var repo = new Repo({
				name: repoName,
				owner: userId,
				dir: repoDir,
				createdOn: new Date(),
				description: req.body.description,
				location: repoURL,
				public: req.body.public
			});
			repo.create((err) => {
				if(!err){
					user.repos.push(repo._id);
					user.save();
					res.json({
						success: true, 
						message: 'repo created successfully', 
						data: {url: repo.location}
					});
				}else{
					res.json({success: false, message: err.message});
				}
			});
		});	
	}
});

repoRoutes.get('/files', (req, res) => {
	User.findOne({
		username: req.query.username
	}, (err, user) => {
		if(user != null){
			Repo.findOne({
				owner: mongoose.Types.ObjectId(user._id),
				name: req.query.reponame
			}, (err, repo) => {
				if(!err && repo != null){
					repo.hasPermission(req.query.token, (has) => {
						if(has){
							repo.getFiles(req.query.root, (err, files) => {
								if(!err)
									res.json({success: true, files: files});
								else
									res.json({success: false, message: err.message});
							});
						}else{
							res.json({success: false, message: 'repo doesn\'t exist'});
						}
					});
				}else{
					res.json({success: false});
				}
			})
		}else{
			res.json({success: false, message: 'repo doesn\'t exist'});
		}
	});
});

repoRoutes.get('/:user/:repo/files/content', (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has) => {
					if(has){
						let branch = req.query.branch == undefined ? 'master' : req.query.branch;
						repo.getFileContent(branch, req.query.file, (err, content) => {
							if(!err)
								res.json({success: true, content: content});
							else
								res.json({success: false});
						});
					}else{
						res.status(401).json({success: false});
					}
				})
			}
		});
});

repoRoutes.post('/:user/:repo/rename', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has) => {
					if(has && repo.owner.toString() == req.decoded.userId){
						repo.rename(req.body.name, (err) => {
							if(!err)
								res.json({success: true});
							else
								res.json({success: false});
						});
					}else{
						res.status(401).json({success: false});
					}
				})
			}
		});
});

repoRoutes.get('/repos/search/:query', (req, res) => {
	Repo
		.find({
			name: {$regex: req.params.query, $options: 'i'},
			public: true
		})
		.select('-_id name description')
		.populate({
			path: 'owner',
			select: '-_id username'
		})
		.exec((err, repos) => {
			res.json({success: true, repos: repos.map(e => {
				e.location = [e.owner.username, e.name].join('/');
				return e;
			})});
		});
});

repoRoutes.get('/:user/:repo/info', (req, res) => {
	let username = req.params.user;
	let reponame = req.params.repo;
	Repo
		.findExact(username, reponame)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has, userId) => {
					if(has){
						res.json({
							success: true, 
							description: repo.description, 
							url: repo.location, 
							name: repo.name,
							issuesEnabled: repo.issuesEnabled,
							public: repo.public,
							starred: repo.starredBy.some(e => e.toString() == userId),
							isOwner: repo.owner.toString() == userId
						});
					}else{
						res.status(401).message({success: false});
					}
				});
			}else{
				res.status(404).json({success: false});
			}
		});
});

repoRoutes.get('/:user/:repo/commits/count', (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has) => {
					if(has){
						repo.getCommitsCount((err, count) => {
							if(!err)
								res.json({success: true, count: count});
							else
								res.json({success: false});
						});
					}else{
						res.status(401).json({success: false});
					}
				});
			}else{
				res.status(404).json({success: false});
			}
		});
});


repoRoutes.get('/:user/:repo/branches/count', (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has) => {
					if(has){
						repo.getBranchCount((err, count) => {
							if(!err)
								res.json({success: true, count: count});
							else
								res.json({success: false});
						});
					}else{
						res.status(401).json({success: false});
					}
				});
			}else{
				res.status(404).json({success: false});
			}
		});
});

repoRoutes.post('/all', VerifyToken, (req, res) => {
	var userId = req.decoded.userId;
	Repo
		.find({
			owner: userId
		})
		.pupulate({
			path: 'owner',
			select: '-_id username'
		})
		.exec((err, repos) => {
			if(repos)
				res.json({success: true, data: repos});
		});
});

repoRoutes.post('/:user/:repo/clone', [VerifyToken], (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			User.findOne({
				_id: req.decoded.userId
			}, (err, u) => {
				if(!err){
					if(Repo.existsCheck(user)){
						let repo = user.repos[0];

						var repoName = req.body.name;
						var repoFolder = repoName + '.git';
						var repoDir = path.join(u.username, repoFolder);
						var repoURL = req.app.get('httproot') + 'git/' + u.username + '/' + repoFolder;

						var newrepo = new Repo({
							name: repoName,
							owner: req.decoded.userId,
							dir: repoDir,
							createdOn: new Date(),
							description: req.body.description,
							location: repoURL,
							public: true
						});

						repo.clone(newrepo, (err, r) => {
							if(!err){
								u.repos.push(r._id);
								u.save((err) => {
									if(!err)
										res.json({success: true});
									else
										res.json({success: false});
								})
							}else{
								res.json({success: false});
							}
						});
					}else{
						res.status(404).json({success: false});
					}
				}else{
					res.json({success: false});
				}
			});
		});
});

repoRoutes.post('/:user/:repo/star', VerifyToken, (req, res) => {
	var userId = req.decoded.userId;
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				let starred = repo.starredBy.some(e => e.toString() == req.decoded.userId);
				if(!starred){
					repo.starredBy.push(req.decoded.userId);
					repo.save((err) => {
						if(!err){
							User.findOne({_id: req.decoded.userId}, (err, u) => {
								if(!err){
									u.stars.push(repo._id);
									u.save((err) => {
										if(!err){
											res.json({success: true});
										}else{
											res.json({success: false});
										}
									});
								}else{
									res.json({success: false});
								}
							});
						}else{
							res.json({success: false});
						}
					})
				}else{
					res.json({success: false, message: 'already starred'});
				}
			}else{
				res.status(404).json({success: false});
			}
		});
});

repoRoutes.get('/:user/:repo/stars/count', (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				res.json({success: true, count: repo.starredBy.length});
			}else{
				res.status(404).json({success: false});
			}
		});
});

repoRoutes.post('/:user/:repo/unstar', VerifyToken, (req, res) => {
	var userId = req.decoded.userId;
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				repo.starredBy.pull(req.decoded.userId);
				repo.save((err) => {
					if(!err){
						User.findOne({_id: req.decoded.userId}, (err, u) => {
							if(!err){
								u.stars.pull(repo._id);
								u.save((err) => {
									if(!err){
										res.json({success: true});
									}else{
										res.json({success: false});
									}
								});
							}else{
								res.json({success: false});
							}
						});
					}else{
						res.json({success: false});
					}
				})
			}else{
				res.status(404).json({success: false});
			}
		});
});


repoRoutes.get('/:user/repos/all', (req, res) => {
	User.getId(req.query.token, (id) => {
		console.log(id, req.params.user);
		User
			.findOne({
				username: req.params.user
			})
			.populate({
				path: 'repos',
				populate: {
					path: 'owner',
					select: '-_id username'
				}
			})
			.exec((err, user) => {
				console.log(user.repos.length);
				if(user != undefined){
					if(id == user._id.toString())
						res.json({success: true, repos: user.repos});
					else
						res.json({success: true, repos: user.repos.filter(r => r.public)});
				}else{
					res.status(404).json({success: false, message: 'user/repo not found'})
				}
			});
	})
});

repoRoutes.get('/:user/repos/count', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.exec((err, user) => {
			if(user != undefined){
				res.json({success: true, count: user.repos.length});
			}else{
				res.status(404).json({success: false, message: 'user/repo not found'})
			}
		});
});

repoRoutes.post('/delete', VerifyToken, (req, res) => {
	User
		.findOne({
			username: req.body.owner
		})
		.populate({
			path: 'repos',
			match: {name: req.body.repo},
			populate: {path: 'issues'}
		})
		.exec((err, user) => {
			if(user != undefined && user.repos.length > 0){
				if(user._id == req.decoded.userId){
					let repo = user.repos[0];
					repo.delete((err) => {
						if(!err)
							res.json({success: true});
						else
							res.json({success: false});
					});
				}else{
					res.status(401).json({success: false});
				}
			}else{
				res.status(404).json({success: false, message: 'user/repo not found'})
			}
		});
});

// contributors

repoRoutes.get('/:user/:repo/contributors', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo, {
			path: 'contributors',
			select: '-_id username' 
		})
		.exec((err, user) => {
			if(!Repo.existsCheck(user)){
				res.status(404).json({success: false});
			}else if(user.repos[0].owner.toString() != req.decoded.userId){
				res.stars(401).json({success: false});
			}else{
				let repo = user.repos[0];
				res.json({success: true, contributors: repo.contributors});
			}
		});
});

repoRoutes.post('/:user/:repo/contributors/add/:contributor', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(!Repo.existsCheck(user)){
				res.status(404).json({success: false});
			}else if(user.repos[0].owner.toString() != req.decoded.userId){
				res.stars(401).json({success: false});
			}else{
				let repo = user.repos[0];
				User
					.findOne({
						username: req.params.contributor
					}, (err, cont) => {
						if(!err && cont){
							let exists = repo.contributors.some((e) => e == cont._id.toString());
							if(!exists){
								repo.contributors.push(cont._id);
								repo.save((err) => {
									if(!err)
										res.json({success: true});
									else
										res.json({success: false});
								});
							}else{
								res.json({success: false, message: 'already exists'});
							}
						}else{
							res.json({success: false, message: 'user not found'});
						}
					});
			}
		});
});


repoRoutes.post('/:user/:repo/contributors/remove/:contributor', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo, {
			path: 'contributors'
		})
		.exec((err, user) => {
			if(!Repo.existsCheck(user)){
				res.status(404).json({success: false});
			}else if(user.repos[0].owner.toString() != req.decoded.userId){
				res.stars(401).json({success: false});
			}else{
				let repo = user.repos[0];
				User
					.findOne({
						username: req.params.contributor
					}, (err, cont) => {
						if(!err && cont){
							let exists = repo.contributors.some((e) => e == cont._id.toString());
							if(!exists){
								repo.contributors.pull(cont._id);
								repo.save((err) => {
									if(!err)
										res.json({success: true});
									else
										res.json({success: false});
								});
							}else{
								res.json({success: false, message: 'does not exist'});
							}
						}else{
							res.json({success: false, message: 'user not found'});
						}
					});
			}
		});
});

repoRoutes.post('/:user/:repo/contributors', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(!Repo.existsCheck(user)){
				res.status(404).json({success: false});
			}else if(user.repos[0].owner.toString() != req.decoded.userId){
				res.stars(401).json({success: false});
			}else{
				let repo = user.repos[0];
				User
					.findOne({
						username: req.paramas.contributor
					}, (err, cont) => {
						if(!err && user){
							repo.contributors.push(cont._id);
							repo.save((err) => {
								if(!err)
									res.json({success: true});
								else
									res.json({success: false});
							});
						}else{
							res.json({success: false, message: 'user not found'});
						}
					});
			}
		});
});


export default repoRoutes;