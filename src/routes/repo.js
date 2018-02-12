import fs from 'fs';
import mongoose from 'mongoose';

import User from '../models/User';
import Repo from '../models/Repo';
import VerifyToken from '../middlewares/VerifyToken';

var repoRoutes = require('express').Router();

repoRoutes.get('/', (req, res) => {res.send('Repo root')});

repoRoutes.post('/create', VerifyToken, (req, res) => {
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
			description: '',
			location: repoURL,
			public: true
		});
		repo.create(repoDir, (err) => {
			if(!err)
				res.json({success: true, url: repo.location});
			else
				res.json({success: false});
		});
	});
});

export default repoRoutes;