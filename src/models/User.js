import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';

import config from './../../config';

var Schema = mongoose.Schema;
var userSchema = new Schema({
	email: {
		type: String,
		required: [true, 'email is required']
	},
	username: {
		type: String,
		required: [true, 'username is required'],
		minlength: 1
	},
	password: {
		type: String,
		required: [true, 'password is required'],
		minlength: [8, 'minimum password length is 8 characters']
	},
	repos: [{type: Schema.Types.ObjectId, ref: 'Repo'}]
});

userSchema.methods.register = function(cb){
	User.find()
		.or([{username: this.username}, {email: this.email}])
		.exec((err, users) => {
			if(users.length != 0){
				cb(new Error('username/email already taken'));
			}else{
				this.validate((err) => {
					if(err)
						cb(err);
					else{
						bcrypt.hash(this.password, 10, (err, hash) => {
							this.password = hash;
							this.save();
							cb(false);
						});
					}
				});
			}
		});
}

userSchema.statics.matches = function(username, password, callback){
	User.findOne({
		username: username
	}, (err, user) => {
		if(err) callback(false);
		bcrypt.compare(password, user.password, (err, matches) => {
			callback(matches);
		});
	});
}

userSchema.statics.getId = function(token, callback){
	jwt.verify(token, config.apisecret, (err, decoded) => {
		if(err){
			callback(null);
		}else{
			callback(decoded.userId);
		}
	});
}

var User = mongoose.model('User', userSchema);

export default User;