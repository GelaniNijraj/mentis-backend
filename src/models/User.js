import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import fs from 'fs';

var Schema = mongoose.Schema;
var userSchema = new Schema({
	name: {
		type: String,
		required: [true, 'name is required'],
		minlength: 1
	},
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
	}
});

/*
 * Verifies if username and password matches.
 * username: String - username
 * password: String - passsword
 * callback: Function
 *  - matches: Boolean - whether username password matches or not
 */
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

userSchema.path('username').validate({
	isAsync: true,
	validator: (value, cb) => {
		User.findOne({
			username: value
		}, (err, user) => cb(user == undefined));
	},
	message: 'username already taken'
});

var User = mongoose.model('User', userSchema);

export default User;