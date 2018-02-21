import fs from 'fs';
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
			var repoDir = req.app.get('storagedir') + "/" + user.username + "/" + repoFolder;
			var repoURL = req.app.get('httproot') + user.username + "/" + repoFolder;

			var repo = new Repo({
				name: repoName,
				owner: userId,
				description: req.body.description,
				location: repoURL,
				public: req.body.public == "true"
			});
			repo.create(repoDir, (err) => {
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