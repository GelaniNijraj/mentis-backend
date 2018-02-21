import Express from 'express';
import bcrypt from 'bcrypt';
import validator from 'validator';
import jwt from 'jsonwebtoken';

import VerifyToken from './../middlewares/VerifyToken';

import User from './../models/User';

var userRoutes = require('express').Router();

// Registration
userRoutes.post('/register', (req, res) => {
	var user = new User({
		name: req.body.name,
		username: req.body.username,
		email: req.body.email
	});
	bcrypt.hash(req.body.password, 10, function(err, hash){
		user.password = hash;
		user.validate(function(err, out){
			if(err) throw(err);
			user.save();
			res.json({success: true});
		});
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
						var payload = {success: true, userId: user._id};
						var token = jwt.sign(payload, req.app.get('jsonsecret'), {
							expiresIn: 1440
						});
						var response = {
							success: true,
							token: token
						}
						res.json(response);
					}else{
						res.json({
							success: false, 
							message: 'Username/password does not match'
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