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

repoRoutes.get('/repos/search/:query', (req, res) => {
	Repo
		.find({
			name: {$regex: req.params.query, $options: 'i'},
			public: true
		})
		.exec((err, repos) => {
			res.json({success: true, repos: repos});
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
			console.log(repos);
			if(repos)
				res.json({success: true, data: repos});
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



export default repoRoutes;