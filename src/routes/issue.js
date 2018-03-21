import Express from 'express';
import path from 'path';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import fs from 'fs';
import validator from 'validator';
import jwt from 'jsonwebtoken';

import VerifyToken from './../middlewares/VerifyToken';

import User from './../models/User';
import Issue from './../models/Issue';
import IssueReply from './../models/IssueReply';
import IssueLabel from './../models/IssueLabel';
import Repo from './../models/Repo';

let issueRoutes = require('express').Router();

issueRoutes.post('/create', VerifyToken, (req, res) => {
	Repo.findByName(req.body.username, req.body.reponame, (err, repo) => {
		if(!err){
			repo.hasPermission(req.body.token, (has) => {
				if(has){
					let issue = new Issue({
						repo: mongoose.Types.ObjectId(repo._id),
						createdBy: mongoose.Types.ObjectId(req.decoded.userId),
						title: req.body.title,
						description: req.body.description,
						postedOn: new Date()
					});
					issue.save((err, i, num) => {
						repo.issues.push(issue._id);
						repo.save((err) => {
							if(!err){
								res.json({success: true, id: i.id});
							}else{
								res.json({success: false, message: 'couln\'t submit the issue'});
							}
						});
					});
				}else{
					res.status(401).json({success: false});
				}
			});
		}else{
			res.status(404).json({success: false, message: err.message});
		}
	});
});

issueRoutes.post('/:user/:repo/issues/create', VerifyToken, (req, res) => {
	Repo.findByName(req.params.user, req.params.repo, (err, repo) => {
		if(!err){
			repo.hasPermission(req.body.token, (has) => {
				if(has){
					let issue = new Issue({
						id: undefined,
						repo: mongoose.Types.ObjectId(repo._id),
						createdBy: mongoose.Types.ObjectId(req.decoded.userId),
						title: req.body.title,
						description: req.body.description,
						postedOn: new Date()
					});
					issue.save((err, i, num) => {
						repo.issues.push(issue._id);
						repo.save((err) => {
							if(!err){
								res.json({success: true, id: i.id});
							}else{
								res.json({success: false, message: 'couln\'t submit the issue'});
							}
						});
					});
				}else{
					res.status(401).json({success: false});
				}
			});
		}else{
			res.status(404).json({success: false, message: err.message});
		}
	});
});

issueRoutes.post('/:user/:repo/issues/enable', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				if(repo.owner.toString() == req.decoded.userId){
					if(repo.issuesEnabled){
						res.json({success: true});
					}else{
						repo.issuesEnabled = true;
						repo.save((err) => {
							if(!err)
								res.json({success: true});
							else
								res.json({success: false});
						})
					}
				}else{
					res.status(401).json({success: false});
				}
			}else{
				res.status(404).json({success: false});
			}
		});
});

issueRoutes.post('/:user/:repo/issues/disable', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, user) => {
			if(Repo.existsCheck(user)){
				let repo = user.repos[0];
				if(repo.owner.toString() == req.decoded.userId){
					if(!repo.issuesEnabled){
						res.json({success: true});
					}else{
						repo.issuesEnabled = false;
						repo.save((err) => {
							if(!err)
								res.json({success: true});
							else
								res.json({success: false});
						})
					}
				}else{
					res.status(401).json({success: false});
				}
			}else{
				res.status(404).json({success: false});
			}
		});
});

issueRoutes.get('/:user/:repo/issues/all', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.populate({
			path: 'repos',
			match: {name: req.params.repo},
			populate: {
				path: 'issues',
				populate: [{
					path: 'createdBy',
					select: '-_id username'
				}, {
					path: 'labels',
					select: '-_id title'
				}],
				select: '-_id id title postedOn open',
				options: {sort: '-postedOn'}
			}
		})
		.exec((err, user) => {
			if(user != undefined && user.repos.length > 0){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has) => {
					if(has){
						if(req.query.label == 'undefined'){
							res.json({success: true, issues: repo.issues});
						}else{
							let filtered = repo.issues.filter(i => {
								let matches = i.labels.some(j => {
									if(j.title == req.query.label)
										return true;
								});
								if(matches)
									return i;
							});
							res.json({success: true, issues: filtered});
						}
					}else{
						res.status(401).json({success: false});
					}
				});
			}else{
				res.status(404).json({success: false, message: 'user/repo not found'})
			}
		});
});


issueRoutes.get('/:user/:repo/issues/count', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.populate({
			path: 'repos',
			match: {name: req.params.repo}
		})
		.exec((err, user) => {
			if(user != undefined && user.repos.length > 0){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has) => {
					if(has)
						res.json({success: true, count: repo.issues.length});
					else
						res.status(401).json({success: false});
				});
			}else{
				res.status(404).json({success: false, message: '1user/repo not found'})
			}
		});
});

issueRoutes.get('/:user/:repo/issues/:id', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.populate({
			path: 'repos',
			match: {name: req.params.repo},
			populate: {
				path: 'issues',
				match: {id: req.params.id},
				populate: [{
					path: 'createdBy',
					select: '-_id username'
				}, {
					path: 'replies',
					select: '-_id description postedOn open',
					populate: {
						path: 'from',
						select: '-_id username'
					}
				}, {
					path: 'labels',
					select: '-_id title'
				}]
			}
		})
		.exec((err, user) => {
			if(user != undefined && user.repos.length > 0 && user.repos[0].issues.length > 0){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has, id) => {
					if(has)
						res.json({success: true, issue: repo.issues[0], isOwner: repo.owner == id});
					else
						res.status(401).json({success: false});
				});
			}else{
				res.status(404).json({success: false, message: 'user/repo not found'})
			}
		});
});

issueRoutes.post('/:user/:repo/issues/:id/close', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.populate({
			path: 'repos',
			match: {name: req.params.repo},
			populate: {
				path: 'issues',
				match: {id: req.params.id}
			}
		})
		.exec((err, user) => {
			if(user != undefined && user.repos.length > 0 && user.repos[0].issues.length > 0){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has, id) => {
					let issue = repo.issues[0];
					issue.open = false;
					issue.save((err) => {
						if(!err)
							res.json({success: true});
						else
							res.json({success: false, message: err.message});
					})
				});
			}else{
				res.status(404).json({success: false, message: 'user/repo not found'})
			}
		});
});

issueRoutes.post('/:user/:repo/issues/:id/open', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.populate({
			path: 'repos',
			match: {name: req.params.repo},
			populate: {
				path: 'issues',
				match: {id: req.params.id}
			}
		})
		.exec((err, user) => {
			if(user != undefined && user.repos.length > 0 && user.repos[0].issues.length > 0){
				let repo = user.repos[0];
				repo.hasPermission(req.query.token, (has, id) => {
					let issue = repo.issues[0];
					issue.open = true;
					issue.save((err) => {
						if(!err)
							res.json({success: true});
						else
							res.json({success: false, message: err.message});
					})
				});
			}else{
				res.status(404).json({success: false, message: 'user/repo not found'})
			}
		});
});

issueRoutes.post('/:user/:repo/issues/:id/reply', VerifyToken, (req, res) => {
	console.log(req.params);
	User
		.findOne({
			username: req.params.user
		})
		.populate({
			path: 'repos',
			match: {name: req.params.repo},
			populate: {
				path: 'issues',
				match: {id: req.params.id}
			}
		})
		.exec((err, user) => {
			if(user != undefined && user.repos.length > 0 && user.repos[0].issues.length > 0){
				let repo = user.repos[0];
				let issue = repo.issues[0];
				repo.hasPermission(req.body.token, (has) => {
					if(has && issue.open){
						let reply = new IssueReply();
						reply.issue = issue._id;
						reply.from = req.decoded.userId;
						reply.postedOn = new Date();
						reply.description = req.body.description;
						reply.save((err, i) => {
							issue.replies.push(i._id);
							issue.save((err) => {
								if(!err)
									res.json({success: true});
								else
									res.json({success: false});
							})
						})
					}else{
						res.status(401).json({success: false});
					}
				});
			}else{
				res.status(404).json({success: false, message: 'user/repo not found'})
			}
		});
});

issueRoutes.get('/:user/:repo/issues/labels/all', (req, res) => {
	User
		.find({
			username: req.params.user
		})
		.populate({
			path: 'repos',
			match: {name: req.params.repo},
			populate: {path: 'issueLabels'}
		})
		.exec((err, users) => {
			if(users == undefined || users[0].repos.length == 0){
				res.status(404).json({success: false});
			}else{
				let repo = users[0].repos[0];
				repo.hasPermission(req.query.token, (has) => {
					if(has){
						res.json({success: true, labels: repo.issueLabels});
					}else{
						res.status(401).json({success: false});
					}
				});
			}
		});
});

issueRoutes.post('/:user/:repo/issues/labels/delete/:title', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo, {
			path: 'issueLabels'
		})
		.exec((err, user) => {
			if(err || !Repo.existsCheck(user)){
				res.status(404).json({success: false});
			}else if(user.repos[0].owner.toString() != req.decoded.userId){
				res.status(401).json({success: false});
			}else{
				IssueLabel.findOne({
					title: req.params.title
				}, (err, label) => {
					if(err || !label){
						res.json({success: false});
					}else{
						let repo = user.repos[0];
						label.remove((err) => {
							if(!err){
								repo.issueLabels.pull(label._id);
								repo.save((err) => {
									if(!err){
										res.json({success: true});
									}else{
										res.json({success: false});
									}
								})
							}else{
								res.json({success: false});
							}
						});
					}
				});
			}
		});
});

issueRoutes.post('/:user/:repo/issues/labels/create', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo)
		.exec((err, users) => {
			if(Repo.existsCheck(users)){
				let repo = users.repos[0];
				IssueLabel.exists(repo, req.body.title, (err, exists) => {
					if(!err && !exists){
						IssueLabel.create(repo, req.body.title, (err, label) => {
							if(!err){
								res.json({success: true});
							}else{
								res.json({success: false, message: err.message});
							}
						})
					}else{
						res.json({success: false, message: !err ? 'label already exists' : err.message});
					}
				});
			}else{
				res.status(404).json({success: false});
			}
		});
});


issueRoutes.post('/:user/:repo/issues/:id/labels/assign/:label', VerifyToken, (req, res) => {
	console.log('here ye');
	Repo
		.findExact(req.params.user, req.params.repo, {
			path: 'issues',
			match: {id: req.params.id}
		})
		.exec((err, user) => {
			if(Repo.existsCheck(user) && user.repos[0].issues.length > 0){
				let repo = user.repos[0];
				let issue = repo.issues[0];
				IssueLabel.findOne({
					repo: repo._id,
					title: req.params.label
				}, (err, label) => {
					if(!err){
						console.log(label._id);
						let assigned = issue.labels.some(el => el.toString() == label._id);
						if(!assigned){
							issue.labels.push(label._id);
							issue.save((err) => {
								if(!err)
									res.json({success: true});
								else
									res.json({success: false});
							})
						}else{
							res.json({success: false, message: 'already assigned'});
						}
					}else{
						res.json({success: false, message: 'label does not exist'});
					}
				});
			}else{
				res.status(404).json({success: false});
			}
		})
});


issueRoutes.post('/:user/:repo/issues/:id/labels/resign/:label', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo, {
			path: 'issues',
			match: {id: req.params.id}
		})
		.exec((err, user) => {
			if(Repo.existsCheck(user) && user.repos[0].issues.length > 0){
				let repo = user.repos[0];
				let issue = repo.issues[0];
				IssueLabel.findOne({
					repo: repo._id,
					title: req.params.label
				}, (err, label) => {
					if(!err){
						let assigned = issue.labels.some(el => el.toString() == label._id);
						if(assigned){
							issue.labels.pull(label._id);
							issue.save((err) => {
								if(!err)
									res.json({success: true});
								else
									res.json({success: false});
							})
						}else{
							res.json({success: false, message: 'not assigned'});
						}
					}else{
						res.json({success: false, message: 'label does not exist'});
					}
				});
			}else{
				res.status(404).json({success: false});
			}
		})
});


issueRoutes.get('/:user/:repo/issues/:id/labels/:label', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo, {
			path: 'issues',
			match: {id: req.params.id},
		})
		.exec((err, user) => {
			if(Repo.existsCheck(user) && user.repos[0].issues.length > 0){
				let repo = user.repos[0];
				let issue = repo.issues[0];
				IssueLabel.findOne({
					repo: repo._id,
					title: req.params.label
				}, (err, label) => {
					if(!err){
						console.log(label);
					}else{
						res.json({success: false, message: 'label does not exist'});
					}
				});
			}else{
				res.status(404).json({success: false});
			}
		})
});

issueRoutes.get('/:user/:repo/issues/:id/labels', VerifyToken, (req, res) => {
	Repo
		.findExact(req.params.user, req.params.repo, {
			populate: {
				path: 'issues',
				match: {id: req.params.id},
				populate: {
					path: 'labels',
					select: '-_id title'
				}
			}
		})
		.exec((err, user) => {
			if(Repo.existsCheck(user) && user.repos[0].issues.length > 0){
				let issue = user.repos[0].issues[0];
				res.status({success: true, labels: issue[0].labels});
			}else{
				res.status(404).json({success: false});
			}
		});
});

issueRoutes.post('/:user/:repo/issues/labels/:label/delete', VerifyToken, (req, res) => {
	
});

export default issueRoutes;