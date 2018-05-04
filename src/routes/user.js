import Express from 'express';
import path from 'path';
import bcrypt from 'bcrypt';
import fs from 'fs';
import validator from 'validator';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import mime from 'mime';

import VerifyToken from './../middlewares/VerifyToken';
import config from './../../config';

import User from './../models/User';

let uploadPath = path.join(config.storagedir, '../uploads');
let upload = multer({ dest: uploadPath })
let userRoutes = require('express').Router();

// Registration
userRoutes.post('/register', (req, res) => {
	let user = new User({
		username: req.body.username,
		email: req.body.email,
		registeredOn: new Date(),
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

userRoutes.get('/:user/stars', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.populate({
			path: 'stars',
			select: '-_id name description public',
			populate: {
				path: 'owner',
				select: '-_id username'
			}
		})
		.exec((err, user) => {
			if(!err){
				res.json({success: true, stars: user.stars});
			}else{
				res.status(404).json({success: false});
			}
		});
});

userRoutes.get('/users/search/:query', (req, res) => {
	User
		.find({
			username: {$regex: req.params.query, $options: 'i'}
		})
		.select('-_id username')
		.exec((err, users) => {
			res.json({success: true, users: users});
		});
});

userRoutes.post('/:user/settings', VerifyToken, (req, res) => {
	User
		.findOne({
			_id: req.decoded.userId
		})
		.exec((err, user) => {
			if(!err){
				// password
				if(req.body.newpass){
					let oldpass = req.body.oldpass;
					let newpass = req.body.newpass.trim();
					bcrypt.compare(oldpass, user.password, (err, matches) => {
						if(!matches){
							res.json({success: false, message: 'incorrect old password'});
						}else if(!User.validatePassword(newpass)){
							res.json({success: false, message: 'invalid new password'});
						}else{
							bcrypt.hash(newpass, 10, (err, hash) => {
								if(!err){
									user.password = hash;
									user.save((err) => {
										if(!err){
											res.json({success: true});
										}else{
											res.json({success: false});
										}
									});
								}
							});
						}
					});
				}
				// about
				if(req.body.about != undefined){
					let about = req.body.about;
					user.about = about;
					user.save((err) => {
						if(!err)
							res.json({success: true});
						else
							res.json({success: false});
					})
				}
			}else{
				res.status(404).json({success: false});
			}
		});
});

userRoutes.post('/:user/settings/profilepic', [upload.single('profilepic'), VerifyToken], (req, res) => {
	User
		.findOne({
			_id: req.decoded.userId
		}, (err, user) => {
			if(!err){
				// TODO: delete old pic
				let originalPath = path.join(uploadPath, req.file.filename);
				let renamedFile = req.file.filename + '.' + mime.getExtension(req.file.mimetype);
				let renamedPath = path.join(uploadPath, renamedFile);
				user.profilepic = renamedFile;
				fs.rename(originalPath, renamedPath, (err) => {
					if(!err){
						user.save((err) => {
							if(!err){
								res.json({success: true});
							}else{
								res.json({success: false});
							}
						})
					}else{
						res.json({success: false});
					}
				})
			}else{
				res.status(404).json({success: false});
			}
		});
});


userRoutes.get('/:user/stars/count', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.exec((err, user) => {
			if(!err){
				res.json({success: true, count: user.stars.length});
			}else{
				res.status(404).json({success: false});
			}
		});
});

userRoutes.get('/:user/profile', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.select('-_id username about')
		.exec((err, user) => {
			if(!err){
				res.json({success: true, about: user.about});
			}else{
				res.status(404).json({success: false});
			}
		});
});

userRoutes.get('/:user/profile/pic', (req, res) => {
	User
		.findOne({
			username: req.params.user
		})
		.exec((err, user) => {
			if(!err){
				if(user.profilepic != null){
					let image = path.join(uploadPath, user.profilepic);
					res.header('Content-type', mime.getType(image));
					res.sendFile(image);
				}else{
					let image = path.join(uploadPath, 'default.png');
					res.header('Content-type', mime.getType(image));
					res.sendFile(image);
				}
			}else{
				res.status(404).json({success: false});
			}
		});
});

// test
userRoutes.post('/authonly', VerifyToken, (req, res) => {
});

export default userRoutes;