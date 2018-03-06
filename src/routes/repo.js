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
				description: req.body.description,
				location: repoURL,
				public: req.body.public == "true"
			});
			repo.create((err) => {
				if(!err)
					res.json({
						success: true, 
						message: 'repo created successfully', 
						data: {url: repo.location}
					});
				else
					res.json({success: false, message: err.message});
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
				if(!err){
					repo.hasPermission(req.query.token, (has) => {
						if(!err && has){
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

repoRoutes.get('/info', (req, res) => {
	let username = req.query.username;
	let reponame = req.query.reponame;
	Repo.findByName(username, reponame, (err, repo) => {
		if(err){
			res.json({success: false, message: err.message});
		}else{
			repo.hasPermission(req.query.token, (has) => {
				if(has){
					repo.getCommitsCount((err, commits) => {
						let out = {
							name: repo.name,
							url: repo.location,
							description: repo.description,
							stars: repo.stars,
							commits: commits,
							issues: repo.issues,
							branches: repo.branches
						};
						res.json({success: true, data: out});
					});
				}else{
					res.status(401).json({success: false, message: 'permission denied'});
				}
			});
		}
	});
});

repoRoutes.post('/all', VerifyToken, (req, res) => {
	var userId = req.decoded.userId;
	Repo.find({
		owner: userId
	}, (err, repos) => {
		if(repos)
			res.json({success: true, data: repos});
	});
});



export default repoRoutes;