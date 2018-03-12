import Express from 'express';
import path from 'path';
import bcrypt from 'bcrypt';
import fs from 'fs';
import validator from 'validator';
import jwt from 'jsonwebtoken';

import VerifyToken from './../middlewares/VerifyToken';

import User from './../models/User';

let userRoutes = require('express').Router();

// Registration
userRoutes.post('/register', (req, res) => {
	let user = new User({
		username: req.body.username,
		email: req.body.email,
		password: req.body.password
	});
	user.register((err) => {
		if(err){
			res.json({success: false, message: err.message});
		}else{
			let userDir = path.join(req.app.get('storagedir'), user.username);
			fs.mkdir(userDir, (err) => {
				if(!err)
					res.json({success: true});
			});
		}
	});
});

// Auth token generation
userRoutes.post('/authenticate', (req, res) => {
	if(req.body.username && req.body.password){
		User.findOne({
			username: req.body.username
		}, (err, user) => {
			if(err) throw err;
			if(!user){
				res.json({
					success: false, 
					message: 'username/password does not match'
				});
			}else{
				bcrypt.compare(req.body.password, user.password, (err, matches) => {
					if(matches){
						let payload = {success: true, userId: user._id};
						let token = jwt.sign(payload, req.app.get('jsonsecret'), {
							expiresIn: 24 * 60 * 60
						});
						res.json({
							success: true,
							token: token
						});
					}else{
						res.json({
							success: false, 
							message: 'username/password does not match'
						});
					}
				});
			}
		});
	}else{
		res.json({
			success: false,
			message: 'not enough parameters'
		})
	}
});

// test
userRoutes.post('/authonly', VerifyToken, (req, res) => {
});

export default userRoutes;